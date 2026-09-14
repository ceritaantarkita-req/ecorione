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
$AiUrl = "http://127.0.0.1:3000"

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
  & docker image inspect $Image *> $null
  return $LASTEXITCODE -eq 0
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
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
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
    if (-not (Test-AiReady)) {
      throw "ECORIONE belum reachable di $AiUrl. Jalankan Start-ECORIONE.cmd terlebih dahulu."
    }
    Start-Process $AiUrl
  }
}
