param(
  [ValidateSet("start", "doctor", "stop", "open")]
  [string]$Command = "start",
  [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $BundleRoot "compose.yml"
$RuntimeImageTar = Join-Path $BundleRoot "runtime\ecorione-image.tar"
$DataRoot = if ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA "ECORIONE"
} else {
  Join-Path $HOME ".ecorione"
}
$EnvFile = Join-Path $DataRoot "desktop.env"
$AiPort = 17020
$AiUrl = "http://127.0.0.1:$AiPort"

function Write-Info([string]$Message) {
  Write-Host "[ECORIONE] $Message"
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

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Read-DesktopEnv {
  $result = @{}
  if (-not (Test-Path -LiteralPath $EnvFile)) {
    return $result
  }
  foreach ($rawLine in [System.IO.File]::ReadAllLines($EnvFile)) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) { continue }
    $index = $line.IndexOf("=")
    if ($index -le 0) { continue }
    $key = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1).Trim()
    $result[$key] = $value
  }
  return $result
}

function Ensure-DesktopEnv {
  if (-not (Test-Path -LiteralPath $DataRoot)) {
    New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
  }
  if (Test-Path -LiteralPath $EnvFile) {
    return Read-DesktopEnv
  }

  $lines = @(
    "ECORIONE_DESKTOP_IMAGE=ecorione:desktop",
    "ECORIONE_AI_PORT=17020",
    "ECORIONE_INTERNAL_TOKEN=$(New-Base64UrlSecret)",
    "ECORIONE_CONNECT_VAULT_MASTER_KEY=$(New-Base64UrlSecret)",
    "TEMPORAL_POSTGRES_PASSWORD=$(New-Base64UrlSecret)",
    "ECORIONE_HOSTED_PROVIDER=anthropic",
    "ECORIONE_LOCAL_BASE_URL=http://host.docker.internal:11434/v1",
    "ECORIONE_LOCAL_MODEL=qwen3:8b-instruct-q4_K_M",
    "ECORIONE_COST_KILL_SWITCH=1",
    "ECORIONE_SPEND_DAILY_USD=1",
    "ECORIONE_SPEND_MONTHLY_USD=10"
  )
  Write-Utf8NoBom $EnvFile (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
  Write-Info "Local config dibuat di $EnvFile"
  return Read-DesktopEnv
}

function Get-ConfiguredAiPort([hashtable]$Config) {
  $raw = [string]$Config["ECORIONE_AI_PORT"]
  if (-not $raw) { return 17020 }
  $value = 0
  if (-not [int]::TryParse($raw, [ref]$value) -or $value -lt 1 -or $value -gt 65535) {
    throw "ECORIONE_AI_PORT tidak valid: $raw"
  }
  if ($value -ge 17021 -and $value -le 17028) {
    throw "ECORIONE_AI_PORT $value bentrok dengan reserved service port 17021-17028."
  }
  return $value
}

function Test-PortAvailable([int]$Port) {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  try { $listener.Start(); return $true } catch { return $false } finally { try { $listener.Stop() } catch {} }
}

function Set-DesktopAiPort([int]$Port) {
  $lines = [System.IO.File]::ReadAllLines($EnvFile)
  $found = $false
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].TrimStart().StartsWith("ECORIONE_AI_PORT=")) {
      $lines[$i] = "ECORIONE_AI_PORT=$Port"
      $found = $true
      break
    }
  }
  if (-not $found) { $lines += "ECORIONE_AI_PORT=$Port" }
  Write-Utf8NoBom $EnvFile (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Select-FreeAiPort([int]$PreferredPort) {
  $candidates = @($PreferredPort, 17020) + (17029..17039)
  $seen = @{}
  foreach ($candidate in $candidates) {
    if ($candidate -ge 17021 -and $candidate -le 17028) { continue }
    if ($seen.ContainsKey($candidate)) { continue }
    $seen[$candidate] = $true
    if (Test-PortAvailable $candidate) { return [int]$candidate }
  }
  throw "Tidak ada Ai port kosong. Preferred $PreferredPort dan fallback 17020, 17029-17039 sedang terpakai."
}

function Set-AiEndpoint([int]$Port) {
  $script:AiPort = $Port
  $script:AiUrl = "http://127.0.0.1:$Port"
}

function Test-ComposeAiRunning {
  $id = & docker compose --env-file $EnvFile -f $ComposeFile ps -q ai 2>$null
  if ($LASTEXITCODE -ne 0) { return $false }
  return -not [string]::IsNullOrWhiteSpace(($id -join ""))
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop belum terpasang. Install Docker Desktop, buka sampai status Engine running, lalu jalankan ECORIONE lagi."
  }

  & docker version --format "{{.Server.Version}}" *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop terpasang tetapi engine belum reachable. Buka Docker Desktop dan tunggu sampai engine running."
  }

  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose plugin tidak tersedia pada Docker Desktop ini."
  }
}

function Test-DockerImage([string]$Image) {
  $ids = & docker image ls --quiet --filter "reference=$Image" 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Gagal memeriksa Docker image '$Image'."
  }
  return @($ids | Where-Object { $_ }).Count -gt 0
}

function Ensure-RuntimeImage([hashtable]$Config) {
  $image = [string]$Config["ECORIONE_DESKTOP_IMAGE"]
  if (-not $image) {
    throw "ECORIONE_DESKTOP_IMAGE tidak ada di $EnvFile."
  }
  if (Test-DockerImage $image) {
    return $image
  }

  if (-not (Test-Path -LiteralPath $RuntimeImageTar)) {
    throw "Runtime image '$image' belum terpasang dan bundle tidak memiliki runtime\ecorione-image.tar. Gunakan bundle/installer ECORIONE resmi."
  }

  Write-Info "Memasang runtime image lokal untuk pertama kali..."
  & docker load --input $RuntimeImageTar
  if ($LASTEXITCODE -ne 0 -or -not (Test-DockerImage $image)) {
    throw "Runtime image gagal dimuat dari bundle."
  }
  return $image
}

function Invoke-Compose([string[]]$Arguments) {
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & docker compose --env-file $EnvFile -f $ComposeFile @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  foreach ($line in @($output)) {
    Write-Host ([string]$line)
  }
  if ($exitCode -ne 0) {
    throw "Docker Compose gagal: $($Arguments -join ' ')"
  }
}

function Test-AiReady {
  try {
    $response = Invoke-WebRequest -Uri $AiUrl -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-AiReady([int]$TimeoutSeconds = 120) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-AiReady) { return }
    Start-Sleep -Milliseconds 750
  }
  throw "ECORIONE belum ready setelah $TimeoutSeconds detik. Jalankan Doctor-ECORIONE.cmd untuk diagnosis."
}

function Start-Ecorione {
  Assert-Docker
  if (-not (Test-Path -LiteralPath $ComposeFile)) {
    throw "Desktop compose tidak ditemukan: $ComposeFile"
  }
  $config = Ensure-DesktopEnv
  $configuredPort = Get-ConfiguredAiPort $config
  if (Test-ComposeAiRunning) {
    Set-AiEndpoint $configuredPort
    Write-Info "ECORIONE desktop sudah berjalan; memakai endpoint $AiUrl."
  } else {
    $selectedPort = Select-FreeAiPort $configuredPort
    if ($selectedPort -ne $configuredPort) {
      Write-Info "Ai port $configuredPort sedang dipakai aplikasi lain; memakai fallback $selectedPort."
    }
    Set-DesktopAiPort $selectedPort
    Set-AiEndpoint $selectedPort
    $config = Read-DesktopEnv
  }
  $image = Ensure-RuntimeImage $config
  Write-Info "Menyalakan ECORIONE ($image)..."
  Invoke-Compose @("up", "-d")
  Wait-AiReady
  Write-Info "Ready: $AiUrl"
  if (-not $NoOpen) {
    Start-Process $AiUrl
  }
}

function Stop-Ecorione {
  Assert-Docker
  if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Info "Belum ada local config; tidak ada desktop stack yang perlu dihentikan."
    return
  }
  Invoke-Compose @("down", "--remove-orphans")
  Write-Info "ECORIONE stopped. Data volume tetap dipertahankan."
}

function Show-Doctor {
  Write-Host "ECORIONE Desktop Doctor"
  Write-Host ""

  try {
    Assert-Docker
    Write-Host "[OK] Docker Desktop + Compose reachable"
  } catch {
    Write-Host "[FAIL] $($_.Exception.Message)"
    exit 1
  }

  $config = Ensure-DesktopEnv
    Set-AiEndpoint (Get-ConfiguredAiPort $config)
    $image = [string]$config["ECORIONE_DESKTOP_IMAGE"]
  if ($image -and (Test-DockerImage $image)) {
    Write-Host "[OK] Runtime image: $image"
  } elseif (Test-Path -LiteralPath $RuntimeImageTar) {
    Write-Host "[WARN] Runtime image belum loaded; bundle image tersedia untuk first start"
  } else {
    Write-Host "[FAIL] Runtime image tidak tersedia"
  }

  if (Test-AiReady) {
    Write-Host "[OK] Ai reachable: $AiUrl"
  } else {
    Write-Host "[INFO] Ai belum reachable"
  }

  Write-Host ""
  Write-Host "Container status:"
  & docker compose --env-file $EnvFile -f $ComposeFile ps
}

switch ($Command) {
  "start" { Start-Ecorione }
  "doctor" { Show-Doctor }
  "stop" { Stop-Ecorione }
  "open" {
      $config = Ensure-DesktopEnv
      Set-AiEndpoint (Get-ConfiguredAiPort $config)
      if (-not (Test-AiReady)) {
      throw "ECORIONE belum reachable di $AiUrl. Jalankan Start-ECORIONE.cmd terlebih dahulu."
    }
    Start-Process $AiUrl
  }
}
