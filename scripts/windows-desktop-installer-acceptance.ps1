param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [string]$ChecksumPath = "",
  [string]$ExpectedSourceRevision = "",
  [string]$ReportDir = "traces",
  [switch]$KeepAcceptanceFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InstallerFullPath = [System.IO.Path]::GetFullPath($InstallerPath)
$AcceptanceId = [Guid]::NewGuid().ToString("N")
$AcceptanceRoot = Join-Path $env:TEMP "ECORIONE-W11-NATIVE-$AcceptanceId"
$InstallRoot = Join-Path $AcceptanceRoot "app"
$AcceptanceLocalAppData = Join-Path $AcceptanceRoot "localappdata"
$DesktopDataRoot = Join-Path $AcceptanceLocalAppData "ECORIONE"
$StateFile = Join-Path $DesktopDataRoot "runtime\native-state.json"
$ReportRoot = [System.IO.Path]::GetFullPath($ReportDir)
$OriginalPath = $env:PATH
$OriginalLocalAppData = $env:LOCALAPPDATA
$OriginalNoOpen = $env:ECORIONE_DESKTOP_NO_OPEN
$OriginalNonInteractive = $env:ECORIONE_DESKTOP_NONINTERACTIVE
$Protected17020 = $null
$Installed = $false
$RuntimeStarted = $false
$Report = [ordered]@{
  schemaVersion = 2
  startedAt = [DateTime]::UtcNow.ToString("o")
  platform = [Environment]::OSVersion.VersionString
  installer = [System.IO.Path]::GetFileName($InstallerFullPath)
  result = "RUNNING"
  phases = [ordered]@{}
}

function Write-Step([string]$Message) { Write-Host "[W11] $Message" }
function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

function Test-TcpReachable([int]$Port, [int]$TimeoutMs = 700) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch { return $false } finally { $client.Dispose() }
}

function Wait-PortClosed([int]$Port, [int]$TimeoutSeconds = 30) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Test-TcpReachable $Port)) { return $true }
    Start-Sleep -Milliseconds 400
  }
  return -not (Test-TcpReachable $Port)
}

function Invoke-Launcher([string]$Path) {
  $output = & $Path 2>&1 | Out-String
  return [ordered]@{ code = $LASTEXITCODE; output = $output.Trim() }
}

function Get-State {
  if (-not (Test-Path -LiteralPath $StateFile -PathType Leaf)) { return $null }
  try { return Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json } catch { return $null }
}

function Test-Http([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch { return $false }
}

function Write-Report {
  if (-not (Test-Path -LiteralPath $ReportRoot)) { New-Item -ItemType Directory -Path $ReportRoot -Force | Out-Null }
  $stamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH-mm-ss-fffZ")
  $path = Join-Path $ReportRoot "w11-windows-installer-acceptance-$stamp.json"
  $Report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
  return $path
}

try {
  Assert-True ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) "W11 acceptance harus dijalankan pada Windows asli."
  Assert-True (Test-Path -LiteralPath $InstallerFullPath -PathType Leaf) "Installer tidak ditemukan: $InstallerFullPath"

  foreach ($port in @(7233,17021,17022,17023,17024,17025,17026,17027,17028)) {
    Assert-True (-not (Test-TcpReachable $port)) "Port $port sudah dipakai sebelum W11; hentikan runtime ECORIONE lain dahulu."
  }

  if ($ChecksumPath) {
    $checksumFullPath = [System.IO.Path]::GetFullPath($ChecksumPath)
    Assert-True (Test-Path -LiteralPath $checksumFullPath -PathType Leaf) "Checksum file tidak ditemukan: $checksumFullPath"
    $installerName = [System.IO.Path]::GetFileName($InstallerFullPath)
    $line = Get-Content -LiteralPath $checksumFullPath | Where-Object { $_ -match "\s+$([regex]::Escape($installerName))$" } | Select-Object -First 1
    Assert-True (-not [string]::IsNullOrWhiteSpace($line)) "SHA256SUMS tidak memiliki entry untuk $installerName."
    $expectedHash = ($line -split "\s+")[0].ToLowerInvariant()
    $actualHash = (Get-FileHash -LiteralPath $InstallerFullPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-True ($actualHash -eq $expectedHash) "SHA-256 installer tidak cocok dengan SHA256SUMS."
    $Report.phases.checksum = [ordered]@{ pass = $true; sha256 = $actualHash }
    Write-Step "Installer SHA-256 verified"
  }

  New-Item -ItemType Directory -Path $AcceptanceRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $AcceptanceLocalAppData -Force | Out-Null

  if (-not (Test-TcpReachable 17020)) {
    $Protected17020 = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 17020)
    $Protected17020.Start()
  }
  Assert-True (Test-TcpReachable 17020) "Acceptance gagal melindungi preferred port 17020."

  $installArgs = @("/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART","/DIR=`"$InstallRoot`"")
  $installProcess = Start-Process -FilePath $InstallerFullPath -ArgumentList $installArgs -PassThru -Wait
  Assert-True ($installProcess.ExitCode -eq 0) "Setup executable gagal dengan exit code $($installProcess.ExitCode)."
  $Installed = $true

  $requiredFiles = @(
    "Start-ECORIONE.cmd",
    "Doctor-ECORIONE.cmd",
    "Stop-ECORIONE.cmd",
    "ecorione.ps1",
    "RELEASE-MANIFEST.json",
    "SHA256SUMS",
    "runtime\node\node.exe",
    "runtime\temporal\temporal.exe",
    "runtime\app\scripts\desktop-native-supervisor.mjs",
    "runtime\app\services\flow\dist\worker-main.js"
  )
  $missing = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $InstallRoot $_) -PathType Leaf) })
  Assert-True ($missing.Count -eq 0) "Installed native bundle tidak lengkap: $($missing -join ', ')."

  $manifest = Get-Content -LiteralPath (Join-Path $InstallRoot "RELEASE-MANIFEST.json") -Raw | ConvertFrom-Json
  Assert-True ($manifest.product -eq "ECORIONE") "Release manifest bukan ECORIONE."
  Assert-True ($manifest.platform -eq "windows-x64") "Release manifest platform bukan windows-x64."
  Assert-True ($manifest.runtime -eq "native-windows") "Release manifest runtime bukan native-windows."
  Assert-True ($manifest.dockerRequired -eq $false) "Release manifest masih membutuhkan Docker."
  if ($ExpectedSourceRevision) {
    Assert-True ($manifest.sourceRevision -eq $ExpectedSourceRevision) "Installer sourceRevision $($manifest.sourceRevision) != $ExpectedSourceRevision."
  }
  $Report.phases.install = [ordered]@{
    pass = $true
    runtime = $manifest.runtime
    dockerRequired = $manifest.dockerRequired
    nodeVersion = $manifest.nodeVersion
    temporalVersion = $manifest.temporalVersion
    sourceRevision = $manifest.sourceRevision
  }
  Write-Step "W11-A native Setup install PASS"

  $env:PATH = @(
    "$env:SystemRoot\System32",
    "$env:SystemRoot",
    "$env:SystemRoot\System32\Wbem",
    "$env:SystemRoot\System32\WindowsPowerShell\v1.0"
  ) -join ";"
  $env:LOCALAPPDATA = $AcceptanceLocalAppData
  $env:ECORIONE_DESKTOP_NO_OPEN = "1"
  $env:ECORIONE_DESKTOP_NONINTERACTIVE = "1"

  Assert-True ($null -eq (Get-Command node.exe -ErrorAction SilentlyContinue)) "Host Node masih visible."
  Assert-True ($null -eq (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) "Host pnpm masih visible."
  Assert-True ($null -eq (Get-Command git.exe -ErrorAction SilentlyContinue)) "Host Git masih visible."
  Assert-True ($null -eq (Get-Command docker.exe -ErrorAction SilentlyContinue)) "Docker masih visible dalam acceptance PATH."
  $Report.phases.hostIndependence = [ordered]@{
    pass = $true
    hostNodeVisible = $false
    hostPnpmVisible = $false
    hostGitVisible = $false
    dockerVisible = $false
  }
  Write-Step "W11-B host Node/pnpm/Git/Docker hidden PASS"

  $doctorPath = Join-Path $InstallRoot "Doctor-ECORIONE.cmd"
  $startPath = Join-Path $InstallRoot "Start-ECORIONE.cmd"
  $stopPath = Join-Path $InstallRoot "Stop-ECORIONE.cmd"

  $preDoctor = Invoke-Launcher $doctorPath
  Assert-True ($preDoctor.code -eq 0) "Pre-start Doctor gagal: $($preDoctor.output)"
  Assert-True ($preDoctor.output -match "Docker dependency: none") "Doctor belum mengonfirmasi Dockerless runtime."
  Assert-True ($preDoctor.output -match "Runtime stopped") "Pre-start Doctor tidak melaporkan stopped runtime."
  $Report.phases.preDoctor = [ordered]@{ pass = $true }
  Write-Step "W11-C pre-start Doctor PASS"

  $start = Invoke-Launcher $startPath
  Assert-True ($start.code -eq 0) "Start launcher gagal: $($start.output)"
  $RuntimeStarted = $true
  $state = Get-State
  Assert-True ($null -ne $state) "Native runtime state tidak dibuat."
  $resolvedPort = [int]$state.aiPort
  Assert-True ($resolvedPort -ne 17020) "Native launcher memakai protected port 17020."
  Assert-True ($resolvedPort -ge 17029 -and $resolvedPort -le 17039) "Fallback Ai port $resolvedPort di luar 17029-17039."
  Assert-True (Test-Http $state.aiUrl) "Ai tidak reachable di $($state.aiUrl)."
  Assert-True (Test-TcpReachable 17020) "Foreign listener 17020 hilang saat start."
  foreach ($port in @(17021,17022,17023,17024,17025,17026,17027,17028)) {
    Assert-True (Test-Http "http://127.0.0.1:$port/healthz") "Owner service port $port tidak healthy."
  }
  Assert-True (Test-TcpReachable 7233) "Bundled Temporal tidak reachable di 7233."
  $Report.phases.firstStart = [ordered]@{
    pass = $true
    resolvedAiPort = $resolvedPort
    fallbackUsed = $true
    foreign17020Preserved = $true
    bundledTemporal = $true
  }
  Write-Step "W11-D first native Start PASS at $($state.aiUrl)"

  $runtimeDoctor = Invoke-Launcher $doctorPath
  Assert-True ($runtimeDoctor.code -eq 0) "Runtime Doctor gagal: $($runtimeDoctor.output)"
  Assert-True ($runtimeDoctor.output -match "Ai reachable") "Runtime Doctor tidak melihat Ai."
  $secondStart = Invoke-Launcher $startPath
  Assert-True ($secondStart.code -eq 0) "Second Start gagal: $($secondStart.output)"
  $state2 = Get-State
  Assert-True ([int]$state2.aiPort -eq $resolvedPort) "Second Start membuat port/instance baru."
  $Report.phases.reuse = [ordered]@{ pass = $true; aiPort = $resolvedPort }
  Write-Step "W11-E runtime Doctor + second Start reuse PASS"

  $stop = Invoke-Launcher $stopPath
  Assert-True ($stop.code -eq 0) "Stop launcher gagal: $($stop.output)"
  $RuntimeStarted = $false
  Assert-True (Wait-PortClosed $resolvedPort 30) "Ai port $resolvedPort masih terbuka setelah Stop."
  foreach ($port in @(7233,17021,17022,17023,17024,17025,17026,17027,17028)) {
    Assert-True (Wait-PortClosed $port 30) "Runtime port $port masih terbuka setelah Stop."
  }
  Assert-True (Test-TcpReachable 17020) "Stop menyentuh foreign listener 17020."
  $Report.phases.stop = [ordered]@{ pass = $true; foreign17020Preserved = $true }
  Write-Step "W11-F native process-tree Stop PASS"

  $postDoctor = Invoke-Launcher $doctorPath
  Assert-True ($postDoctor.code -eq 0) "Post-stop Doctor gagal: $($postDoctor.output)"
  Assert-True ($postDoctor.output -match "Runtime stopped") "Post-stop Doctor tidak melaporkan stopped runtime."

  $uninstaller = Join-Path $InstallRoot "unins000.exe"
  Assert-True (Test-Path -LiteralPath $uninstaller -PathType Leaf) "Inno Setup uninstaller tidak ditemukan."
  $uninstall = Start-Process -FilePath $uninstaller -ArgumentList @("/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART") -PassThru -Wait
  Assert-True ($uninstall.ExitCode -eq 0) "Uninstaller gagal dengan exit code $($uninstall.ExitCode)."
  $Installed = $false
  $Report.phases.uninstall = [ordered]@{ pass = $true; userDataRetained = (Test-Path -LiteralPath $DesktopDataRoot) }
  Write-Step "W11-G post-stop Doctor + uninstall PASS"

  $Report.result = "PASS"
  $Report.finishedAt = [DateTime]::UtcNow.ToString("o")
  $reportPath = Write-Report
  Write-Host ""
  Write-Host "PASS W11 Windows installer/launcher acceptance"
  Write-Host "Sanitized report: $reportPath"
} catch {
  $Report.result = "FAIL"
  $Report.error = $_.Exception.Message
  $Report.finishedAt = [DateTime]::UtcNow.ToString("o")
  $reportPath = Write-Report
  Write-Error "FAIL W11: $($Report.error)"
  Write-Host "Sanitized report: $reportPath"
  exit 1
} finally {
  try {
    if ($RuntimeStarted -and (Test-Path -LiteralPath (Join-Path $InstallRoot "Stop-ECORIONE.cmd"))) {
      & (Join-Path $InstallRoot "Stop-ECORIONE.cmd") *> $null
    }
  } catch {}
  try { if ($null -ne $Protected17020) { $Protected17020.Stop() } } catch {}
  $env:PATH = $OriginalPath
  $env:LOCALAPPDATA = $OriginalLocalAppData
  $env:ECORIONE_DESKTOP_NO_OPEN = $OriginalNoOpen
  $env:ECORIONE_DESKTOP_NONINTERACTIVE = $OriginalNonInteractive
  if (-not $KeepAcceptanceFiles) {
    try { Remove-Item -LiteralPath $AcceptanceRoot -Recurse -Force -ErrorAction SilentlyContinue } catch {}
  }
}
