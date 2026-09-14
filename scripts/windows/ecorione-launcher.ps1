param(
  [ValidateSet("start", "doctor", "status", "stop")]
  [string]$Action = "start"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ComposeFile = Join-Path $RepoRoot "deploy\desktop-compose.yml"
$TemplateFile = Join-Path $RepoRoot "deploy\desktop.env.example"
$BundleImage = Join-Path $RepoRoot "release\ecorione-image.tar"
$DataRoot = if ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA "ECORIONE"
} else {
  Join-Path $HOME ".ecorione"
}
$EnvFile = Join-Path $DataRoot "desktop.env"
$ExpectedServices = @(
  "temporal-db",
  "temporal",
  "rnd",
  "context",
  "connect",
  "hub",
  "artifact",
  "sandbox",
  "flow",
  "flow-worker",
  "space",
  "ai"
)

function Write-Ok([string]$Message) {
  Write-Host "[OK] $Message"
}

function Write-Warn([string]$Message) {
  Write-Host "[!] $Message"
}

function New-Base64UrlSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Read-EnvMap([string]$Path) {
  $result = @{}
  if (-not (Test-Path $Path)) {
    return $result
  }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }
    $index = $trimmed.IndexOf("=")
    if ($index -le 0) {
      continue
    }
    $key = $trimmed.Substring(0, $index).Trim()
    $value = $trimmed.Substring($index + 1).Trim()
    $result[$key] = $value
  }
  return $result
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
  $lines = if (Test-Path $Path) { [System.Collections.Generic.List[string]](Get-Content -LiteralPath $Path) } else { [System.Collections.Generic.List[string]]::new() }
  $prefix = "$Key="
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].TrimStart().StartsWith($prefix)) {
      $lines[$i] = "$Key=$Value"
      $found = $true
      break
    }
  }
  if (-not $found) {
    $lines.Add("$Key=$Value")
  }
  Set-Content -LiteralPath $Path -Value $lines -Encoding utf8
}

function Ensure-LocalEnvironment {
  if (-not (Test-Path $ComposeFile)) {
    throw "Desktop compose tidak ditemukan: $ComposeFile"
  }
  if (-not (Test-Path $TemplateFile)) {
    throw "Desktop environment template tidak ditemukan: $TemplateFile"
  }
  New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
  if (-not (Test-Path $EnvFile)) {
    Copy-Item -LiteralPath $TemplateFile -Destination $EnvFile
  }

  $values = Read-EnvMap $EnvFile
  foreach ($key in @("ECORIONE_INTERNAL_TOKEN", "ECORIONE_CONNECT_VAULT_MASTER_KEY", "TEMPORAL_POSTGRES_PASSWORD")) {
    if (-not $values.ContainsKey($key) -or -not $values[$key]) {
      Set-EnvValue $EnvFile $key (New-Base64UrlSecret)
      $values = Read-EnvMap $EnvFile
    }
  }
  return $values
}

function Assert-Docker {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    throw "Docker Desktop belum tersedia. Install dan jalankan Docker Desktop, lalu buka ECORIONE lagi."
  }
  & docker version --format "{{.Server.Version}}" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop ditemukan tetapi engine belum ready. Jalankan Docker Desktop lalu coba lagi."
  }
}

function Invoke-Compose([string[]]$Arguments) {
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose gagal: $($Arguments -join ' ')"
  }
}

function Ensure-DesktopImage([hashtable]$Values) {
  $image = if ($Values.ContainsKey("ECORIONE_IMAGE") -and $Values["ECORIONE_IMAGE"]) { $Values["ECORIONE_IMAGE"] } else { "ecorione:local" }
  & docker image inspect $image *> $null
  if ($LASTEXITCODE -eq 0) {
    return $image
  }
  if (Test-Path $BundleImage) {
    Write-Host "Loading ECORIONE desktop image..."
    & docker load --input $BundleImage
    if ($LASTEXITCODE -ne 0) {
      throw "Bundled ECORIONE image gagal dimuat."
    }
    & docker image inspect $image *> $null
    if ($LASTEXITCODE -eq 0) {
      return $image
    }
  }
  throw "ECORIONE desktop image '$image' belum tersedia. Bundle release harus menyertakan release/ecorione-image.tar atau image tersebut harus sudah dimuat ke Docker."
}

function Get-AiUrl([hashtable]$Values) {
  $port = if ($Values.ContainsKey("ECORIONE_AI_PORT") -and $Values["ECORIONE_AI_PORT"]) { $Values["ECORIONE_AI_PORT"] } else { "3000" }
  return "http://127.0.0.1:$port"
}

function Get-RunningServices {
  $output = & docker compose --env-file $EnvFile -f $ComposeFile ps --services --filter status=running
  if ($LASTEXITCODE -ne 0) {
    return @()
  }
  return @($output | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
}

function Wait-DesktopReady([string]$AiUrl, [int]$TimeoutSeconds = 120) {
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTimeOffset]::UtcNow -lt $deadline) {
    $running = Get-RunningServices
    $missing = @($ExpectedServices | Where-Object { $_ -notin $running })
    if ($missing.Count -eq 0) {
      try {
        $response = Invoke-WebRequest -Uri $AiUrl -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
          return
        }
      } catch {
        # Continue until the deadline; container startup is asynchronous.
      }
    }
    Start-Sleep -Seconds 2
  }
  $running = Get-RunningServices
  $missing = @($ExpectedServices | Where-Object { $_ -notin $running })
  if ($missing.Count -gt 0) {
    throw "ECORIONE belum ready. Service belum running: $($missing -join ', ')."
  }
  throw "ECORIONE containers running tetapi UI belum reachable di $AiUrl."
}

function Show-Status([hashtable]$Values) {
  $running = Get-RunningServices
  foreach ($service in $ExpectedServices) {
    if ($service -in $running) {
      Write-Ok "$service running"
    } else {
      Write-Warn "$service stopped/not ready"
    }
  }
  Write-Host "UI: $(Get-AiUrl $Values)"
}

function Start-Ecorione {
  Assert-Docker
  $values = Ensure-LocalEnvironment
  $image = Ensure-DesktopImage $values
  Write-Ok "Docker ready"
  Write-Ok "Using image $image"
  Write-Host "Starting ECORIONE..."
  Invoke-Compose @("up", "-d", "--remove-orphans")
  $aiUrl = Get-AiUrl $values
  try {
    Wait-DesktopReady $aiUrl
  } catch {
    Write-Warn "Startup belum sehat. Menampilkan status container."
    Show-Status $values
    throw
  }
  Write-Ok "ECORIONE ready at $aiUrl"
  Start-Process $aiUrl
}

function Doctor-Ecorione {
  Assert-Docker
  $values = Ensure-LocalEnvironment
  Write-Ok "Docker engine reachable"
  try {
    $image = Ensure-DesktopImage $values
    Write-Ok "Desktop image available: $image"
  } catch {
    Write-Warn $_.Exception.Message
  }
  Show-Status $values
  $aiUrl = Get-AiUrl $values
  try {
    $response = Invoke-WebRequest -Uri $aiUrl -UseBasicParsing -TimeoutSec 3
    Write-Ok "UI reachable: HTTP $($response.StatusCode)"
  } catch {
    Write-Warn "UI not reachable at $aiUrl"
  }
  Write-Host "Local data/config: $DataRoot"
}

function Stop-Ecorione {
  Assert-Docker
  Ensure-LocalEnvironment | Out-Null
  Invoke-Compose @("down", "--remove-orphans")
  Write-Ok "ECORIONE stopped. Persistent volumes were preserved."
}

try {
  switch ($Action) {
    "start" { Start-Ecorione }
    "doctor" { Doctor-Ecorione }
    "status" {
      Assert-Docker
      $values = Ensure-LocalEnvironment
      Show-Status $values
    }
    "stop" { Stop-Ecorione }
  }
} catch {
  Write-Error "ECORIONE launcher error: $($_.Exception.Message)"
  exit 1
}
