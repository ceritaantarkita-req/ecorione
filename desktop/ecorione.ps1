param(
  [ValidateSet("start", "doctor", "stop", "open")]
  [string]$Command = "start",
  [switch]$NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$BundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeRoot = Join-Path $BundleRoot "runtime"
$NodeExe = Join-Path $RuntimeRoot "node\node.exe"
$TemporalExe = Join-Path $RuntimeRoot "temporal\temporal.exe"
$AppRoot = Join-Path $RuntimeRoot "app"
$Supervisor = Join-Path $AppRoot "scripts\desktop-native-supervisor.mjs"
$ManifestPath = Join-Path $BundleRoot "RELEASE-MANIFEST.json"
$DataRoot = if ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA "ECORIONE"
} else {
  Join-Path $HOME ".ecorione"
}
$EnvFile = Join-Path $DataRoot "desktop.env"
$StateFile = Join-Path $DataRoot "runtime\native-state.json"
$LogRoot = Join-Path $DataRoot "logs"
$StdoutLog = Join-Path $LogRoot "desktop-runtime.log"
$StderrLog = Join-Path $LogRoot "desktop-runtime-error.log"

function Write-Info([string]$Message) {
  Write-Host "[ECORIONE] $Message"
}

function Assert-NativeBundle {
  foreach ($path in @($NodeExe, $TemporalExe, $Supervisor, $ManifestPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Native runtime bundle tidak lengkap: $path"
    }
  }
  $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  if ($manifest.runtime -ne "native-windows") {
    throw "Installer ini bukan native Windows runtime ECORIONE. runtime=$($manifest.runtime)"
  }
}

function Get-NativeState {
  if (-not (Test-Path -LiteralPath $StateFile -PathType Leaf)) { return $null }
  try {
    return Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Test-ProcessAlive([object]$PidValue) {
  if ($null -eq $PidValue) { return $false }
  $pidNumber = 0
  if (-not [int]::TryParse([string]$PidValue, [ref]$pidNumber) -or $pidNumber -le 0) {
    return $false
  }
  return $null -ne (Get-Process -Id $pidNumber -ErrorAction SilentlyContinue)
}

function Test-AiReady([string]$Url) {
  if ([string]::IsNullOrWhiteSpace($Url)) { return $false }
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500 -and $response.Content -match "ECORIONE"
  } catch {
    return $false
  }
}

function Invoke-Supervisor([string]$Mode) {
  & $NodeExe $Supervisor $Mode `
    --app-root $AppRoot `
    --data-root $DataRoot `
    --env-file $EnvFile `
    --node-exe $NodeExe `
    --temporal-exe $TemporalExe
  return $LASTEXITCODE
}

function Start-Ecorione {
  Assert-NativeBundle
  New-Item -ItemType Directory -Path $LogRoot -Force | Out-Null

  $state = Get-NativeState
  if ($null -ne $state -and (Test-ProcessAlive $state.supervisorPid) -and (Test-AiReady $state.aiUrl)) {
    Write-Info "ECORIONE sudah berjalan: $($state.aiUrl)"
    if (-not $NoOpen -and $env:ECORIONE_DESKTOP_NO_OPEN -ne "1") {
      Start-Process $state.aiUrl
    }
    return
  }

  if (Test-Path -LiteralPath $StateFile) {
    Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
  }

  Write-Info "Menyalakan native Windows runtime. Docker tidak diperlukan."
  $quotedArgs = @(
    "`"$Supervisor`"",
    "start",
    "--app-root", "`"$AppRoot`"",
    "--data-root", "`"$DataRoot`"",
    "--env-file", "`"$EnvFile`"",
    "--node-exe", "`"$NodeExe`"",
    "--temporal-exe", "`"$TemporalExe`""
  )
  $process = Start-Process -FilePath $NodeExe `
    -ArgumentList $quotedArgs `
    -WorkingDirectory $AppRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds(180)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($process.HasExited) {
      $detail = if (Test-Path -LiteralPath $StderrLog) {
        (Get-Content -LiteralPath $StderrLog -Tail 40 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
      } else { "" }
      throw "Native runtime berhenti sebelum ready (exit $($process.ExitCode)). $detail"
    }
    $state = Get-NativeState
    if ($null -ne $state -and (Test-AiReady $state.aiUrl)) {
      Write-Info "Ready: $($state.aiUrl)"
      if (-not $NoOpen -and $env:ECORIONE_DESKTOP_NO_OPEN -ne "1") {
        Start-Process $state.aiUrl
      }
      return
    }
    Start-Sleep -Milliseconds 750
  }
  throw "ECORIONE native runtime belum ready setelah 180 detik. Lihat $StderrLog"
}

function Stop-Ecorione {
  Assert-NativeBundle
  $code = Invoke-Supervisor "stop"
  if ($code -ne 0) { throw "Native runtime stop gagal dengan exit code $code." }
  Write-Info "ECORIONE stopped. Data user tetap di $DataRoot"
}

function Show-Doctor {
  Assert-NativeBundle
  $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  Write-Host "ECORIONE Desktop Doctor"
  Write-Host ""
  Write-Host "[OK] Runtime: native Windows (Docker tidak diperlukan)"
  Write-Host "[OK] Bundled Node: $($manifest.nodeVersion)"
  Write-Host "[OK] Bundled Temporal CLI: $($manifest.temporalVersion)"
  $code = Invoke-Supervisor "doctor"
  if ($code -ne 0) { exit $code }
}

function Open-Ecorione {
  Assert-NativeBundle
  $state = Get-NativeState
  if ($null -eq $state -or -not (Test-ProcessAlive $state.supervisorPid) -or -not (Test-AiReady $state.aiUrl)) {
    throw "ECORIONE belum berjalan. Jalankan Start-ECORIONE.cmd terlebih dahulu."
  }
  Start-Process $state.aiUrl
}

switch ($Command) {
  "start" { Start-Ecorione }
  "doctor" { Show-Doctor }
  "stop" { Stop-Ecorione }
  "open" { Open-Ecorione }
}
