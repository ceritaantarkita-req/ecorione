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

$ExpectedServices = @(
  "temporal-db",
  "temporal",
  "rnd",
  "context",
  "connect",
  "hub",
  "artifact",
  "sandbox",
  "space",
  "flow",
  "flow-worker",
  "ai"
)
$InstallerFullPath = [System.IO.Path]::GetFullPath($InstallerPath)
$AcceptanceId = [Guid]::NewGuid().ToString("N")
$AcceptanceRoot = Join-Path $env:TEMP "ECORIONE-W11-$AcceptanceId"
$InstallRoot = Join-Path $AcceptanceRoot "app"
$AcceptanceLocalAppData = Join-Path $AcceptanceRoot "localappdata"
$DesktopDataRoot = Join-Path $AcceptanceLocalAppData "ECORIONE"
$DesktopEnv = Join-Path $DesktopDataRoot "desktop.env"
$ReportRoot = [System.IO.Path]::GetFullPath($ReportDir)
$OriginalPath = $env:PATH
$OriginalLocalAppData = $env:LOCALAPPDATA
$OriginalNoOpen = $env:ECORIONE_DESKTOP_NO_OPEN
$OriginalNonInteractive = $env:ECORIONE_DESKTOP_NONINTERACTIVE
$Protected17020 = $null
$Installed = $false
$StackStarted = $false
$ImagePreexisting = $false
$Report = [ordered]@{
  schemaVersion = 1
  startedAt = [DateTime]::UtcNow.ToString("o")
  platform = [Environment]::OSVersion.VersionString
  installer = [System.IO.Path]::GetFileName($InstallerFullPath)
  result = "RUNNING"
  phases = [ordered]@{}
}

function Write-Step([string]$Message) {
  Write-Host "[W11] $Message"
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Test-TcpReachable([int]$Port, [int]$TimeoutMs = 750) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-PortAvailable([int]$Port) {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    try { $listener.Stop() } catch {}
  }
}

function Wait-PortClosed([int]$Port, [int]$TimeoutSeconds = 30) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Test-TcpReachable $Port)) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return -not (Test-TcpReachable $Port)
}

function Invoke-Launcher([string]$Path) {
  $output = & $Path 2>&1 | Out-String
  return [ordered]@{
    code = $LASTEXITCODE
    output = $output.Trim()
  }
}

function Read-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  foreach ($rawLine in [System.IO.File]::ReadAllLines($Path)) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) { continue }
    $prefix = "$Key="
    if ($line.StartsWith($prefix)) { return $line.Substring($prefix.Length) }
  }
  return $null
}

function Write-Report {
  if (-not (Test-Path -LiteralPath $ReportRoot)) {
    New-Item -ItemType Directory -Path $ReportRoot -Force | Out-Null
  }
  $stamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH-mm-ss-fffZ")
  $path = Join-Path $ReportRoot "w11-windows-installer-acceptance-$stamp.json"
  $Report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
  return $path
}

try {
  Assert-True ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) "W11 acceptance harus dijalankan pada Windows asli."
  Assert-True (Test-Path -LiteralPath $InstallerFullPath -PathType Leaf) "Installer tidak ditemukan: $InstallerFullPath"

  $docker = Get-Command docker.exe -ErrorAction SilentlyContinue
  Assert-True ($null -ne $docker) "Docker Desktop CLI tidak ditemukan. Install Docker Desktop terlebih dahulu."
  & $docker.Source version --format "{{.Server.Version}}" *> $null
  Assert-True ($LASTEXITCODE -eq 0) "Docker Desktop terpasang tetapi engine belum reachable."
  & $docker.Source compose version *> $null
  Assert-True ($LASTEXITCODE -eq 0) "Docker Compose plugin tidak tersedia."

  $existingContainers = @(& $docker.Source ps -aq --filter "label=com.docker.compose.project=ecorione-desktop" 2>$null | Where-Object { $_ })
  Assert-True ($existingContainers.Count -eq 0) "Stack ecorione-desktop sudah ada. Hentikan instalasi desktop ECORIONE lain sebelum W11 acceptance."

  $cachedImageOutput = & $docker.Source image ls --quiet --filter "reference=ecorione:desktop" 2>$null
  $cachedImageListExitCode = $LASTEXITCODE
  Assert-True ($cachedImageListExitCode -eq 0) "Gagal memeriksa cache image ecorione:desktop."
  $cachedImageIds = @($cachedImageOutput | Where-Object { $_ })
  $ImagePreexisting = $cachedImageIds.Count -gt 0
  Assert-True (-not $ImagePreexisting) "Image ecorione:desktop sudah ada. W11 fresh-install proof membutuhkan image tersebut belum ada agar bundled runtime load benar-benar diuji."

  if ($ChecksumPath) {
    $checksumFullPath = [System.IO.Path]::GetFullPath($ChecksumPath)
    Assert-True (Test-Path -LiteralPath $checksumFullPath -PathType Leaf) "Checksum file tidak ditemukan: $checksumFullPath"
    $installerName = [System.IO.Path]::GetFileName($InstallerFullPath)
    $checksumLine = Get-Content -LiteralPath $checksumFullPath | Where-Object { $_ -match "\s+$([regex]::Escape($installerName))$" } | Select-Object -First 1
    Assert-True (-not [string]::IsNullOrWhiteSpace($checksumLine)) "SHA256SUMS tidak memiliki entry untuk $installerName."
    $expectedHash = ($checksumLine -split "\s+")[0].ToLowerInvariant()
    $actualHash = (Get-FileHash -LiteralPath $InstallerFullPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-True ($actualHash -eq $expectedHash) "SHA-256 installer tidak cocok dengan SHA256SUMS."
    $Report.phases.checksum = [ordered]@{ pass = $true; sha256 = $actualHash }
    Write-Step "Installer SHA-256 verified"
  } else {
    $Report.phases.checksum = [ordered]@{ pass = $true; disposition = "not-supplied" }
  }

  New-Item -ItemType Directory -Path $AcceptanceRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $AcceptanceLocalAppData -Force | Out-Null

  $port17020WasPreexisting = Test-TcpReachable 17020
  if (-not $port17020WasPreexisting) {
    $Protected17020 = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 17020)
    $Protected17020.Start()
  }
  Assert-True (-not (Test-PortAvailable 17020)) "Acceptance gagal melindungi preferred port 17020 dengan foreign listener."

  $installArgs = @(
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/DIR=`"$InstallRoot`""
  )
  $installProcess = Start-Process -FilePath $InstallerFullPath -ArgumentList $installArgs -PassThru -Wait
  Assert-True ($installProcess.ExitCode -eq 0) "Setup executable gagal dengan exit code $($installProcess.ExitCode)."
  $Installed = $true

  $requiredFiles = @(
    "Start-ECORIONE.cmd",
    "Doctor-ECORIONE.cmd",
    "Stop-ECORIONE.cmd",
    "ecorione.ps1",
    "compose.yml",
    "RELEASE-MANIFEST.json",
    "SHA256SUMS",
    "runtime\ecorione-image.tar"
  )
  $missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $InstallRoot $_) -PathType Leaf) })
  Assert-True ($missingFiles.Count -eq 0) "Installed bundle tidak lengkap: $($missingFiles -join ', ')."

  $manifest = Get-Content -LiteralPath (Join-Path $InstallRoot "RELEASE-MANIFEST.json") -Raw | ConvertFrom-Json
  Assert-True ($manifest.product -eq "ECORIONE") "Release manifest bukan produk ECORIONE."
  Assert-True ($manifest.platform -eq "windows-x64") "Release manifest platform bukan windows-x64."
  if ($ExpectedSourceRevision) {
    Assert-True ($manifest.sourceRevision -eq $ExpectedSourceRevision) "Installer sourceRevision $($manifest.sourceRevision) tidak sama dengan expected $ExpectedSourceRevision."
  }
  $Report.phases.install = [ordered]@{
    pass = $true
    product = $manifest.product
    version = $manifest.version
    sourceRevision = $manifest.sourceRevision
    installRoot = $InstallRoot
  }
  Write-Step "Setup installed isolated end-user bundle"

  $dockerDir = Split-Path -Parent $docker.Source
  $env:PATH = @(
    $dockerDir,
    "$env:SystemRoot\System32",
    "$env:SystemRoot",
    "$env:SystemRoot\System32\Wbem",
    "$env:SystemRoot\System32\WindowsPowerShell\v1.0"
  ) -join ";"
  $env:LOCALAPPDATA = $AcceptanceLocalAppData
  $env:ECORIONE_DESKTOP_NO_OPEN = "1"
  $env:ECORIONE_DESKTOP_NONINTERACTIVE = "1"

  $hostNode = Get-Command node.exe -ErrorAction SilentlyContinue
  $hostPnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  $hostGit = Get-Command git.exe -ErrorAction SilentlyContinue
  Assert-True ($null -eq $hostNode -and $null -eq $hostPnpm -and $null -eq $hostGit) "Acceptance PATH masih mengekspos Node/pnpm/Git host; end-user independence belum terbukti."
  Assert-True ($null -ne (Get-Command docker.exe -ErrorAction SilentlyContinue)) "Docker CLI hilang dari sanitized acceptance PATH."
  $Report.phases.hostIndependence = [ordered]@{
    pass = $true
    hostNodeVisible = $false
    hostPnpmVisible = $false
    hostGitVisible = $false
    dockerVisible = $true
  }
  Write-Step "Host Node/pnpm/Git hidden; launcher limited to Windows + Docker prerequisites"

  $doctorPath = Join-Path $InstallRoot "Doctor-ECORIONE.cmd"
  $startPath = Join-Path $InstallRoot "Start-ECORIONE.cmd"
  $stopPath = Join-Path $InstallRoot "Stop-ECORIONE.cmd"

  $preDoctor = Invoke-Launcher $doctorPath
  Assert-True ($preDoctor.code -eq 0) "Installed Doctor launcher gagal sebelum start: $($preDoctor.output)"
  Assert-True ($preDoctor.output -match "Docker Desktop \+ Compose reachable") "Pre-start Doctor tidak mengonfirmasi Docker + Compose."
  $Report.phases.preDoctor = [ordered]@{ pass = $true }
  Write-Step "Installed Doctor pre-start PASS"

  $firstStart = Invoke-Launcher $startPath
  Assert-True ($firstStart.code -eq 0) "Installed Start launcher gagal: $($firstStart.output)"
  $StackStarted = $true
  Assert-True (Test-Path -LiteralPath $DesktopEnv -PathType Leaf) "First start tidak membuat desktop.env di acceptance LOCALAPPDATA."
  $resolvedPortRaw = Read-EnvValue $DesktopEnv "ECORIONE_AI_PORT"
  $resolvedPort = 0
  Assert-True ([int]::TryParse([string]$resolvedPortRaw, [ref]$resolvedPort)) "desktop.env tidak memiliki ECORIONE_AI_PORT valid."
  Assert-True ($resolvedPort -ne 17020) "Launcher memakai protected foreign port 17020, fallback tidak bekerja."
  Assert-True ($resolvedPort -ge 17029 -and $resolvedPort -le 17039) "Resolved fallback port $resolvedPort berada di luar 17029-17039."
  Assert-True (Test-TcpReachable $resolvedPort 1500) "Ai tidak reachable di resolved port $resolvedPort."
  Assert-True (-not (Test-PortAvailable 17020)) "Foreign listener 17020 hilang setelah Start launcher."

  $loadedImageOutput = & docker.exe image ls --quiet --filter "reference=ecorione:desktop" 2>$null
  $loadedImageListExitCode = $LASTEXITCODE
  Assert-True ($loadedImageListExitCode -eq 0) "Gagal memeriksa bundled runtime image setelah first start."
  $loadedImageIds = @($loadedImageOutput | Where-Object { $_ })
  Assert-True ($loadedImageIds.Count -gt 0) "Bundled runtime image tidak ter-load setelah first start."

  $runningServicesOutput = & docker.exe compose --env-file $DesktopEnv -f (Join-Path $InstallRoot "compose.yml") ps --services --status running 2>&1
  Assert-True ($LASTEXITCODE -eq 0) "docker compose ps gagal pada installed bundle."
  $runningServices = @($runningServicesOutput | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
  $missingServices = @($ExpectedServices | Where-Object { $runningServices -notcontains $_ })
  Assert-True ($missingServices.Count -eq 0) "Installed stack kehilangan running services: $($missingServices -join ', ')."

  $Report.phases.firstStart = [ordered]@{
    pass = $true
    resolvedAiPort = $resolvedPort
    fallbackUsed = $true
    bundledImageLoaded = $true
    foreign17020Preserved = $true
    runningServices = $runningServices
  }
  Write-Step "First Start PASS at fallback port $resolvedPort with full compose fleet"

  $runningDoctor = Invoke-Launcher $doctorPath
  Assert-True ($runningDoctor.code -eq 0) "Installed Doctor launcher gagal saat running: $($runningDoctor.output)"
  Assert-True ($runningDoctor.output -match "Ai reachable: http://127\.0\.0\.1:$resolvedPort") "Runtime Doctor tidak mengikuti resolved Ai port $resolvedPort."
  $Report.phases.runningDoctor = [ordered]@{ pass = $true; resolvedAiPort = $resolvedPort }
  Write-Step "Installed Doctor runtime PASS"

  $secondStart = Invoke-Launcher $startPath
  Assert-True ($secondStart.code -eq 0) "Second Start launcher gagal: $($secondStart.output)"
  $secondPortRaw = Read-EnvValue $DesktopEnv "ECORIONE_AI_PORT"
  Assert-True ([string]$secondPortRaw -eq [string]$resolvedPort) "Second Start mengubah resolved Ai port dari $resolvedPort menjadi $secondPortRaw."
  Assert-True ($secondStart.output -match "sudah berjalan") "Second Start tidak mengenali instance desktop yang sudah berjalan."
  $Report.phases.secondStart = [ordered]@{ pass = $true; reusedAiPort = $resolvedPort }
  Write-Step "Second Start reused existing desktop instance"

  $stop = Invoke-Launcher $stopPath
  Assert-True ($stop.code -eq 0) "Installed Stop launcher gagal: $($stop.output)"
  $StackStarted = $false
  Assert-True (Wait-PortClosed $resolvedPort 30) "Resolved Ai port $resolvedPort masih reachable setelah Stop launcher."
  Assert-True (-not (Test-PortAvailable 17020)) "Stop launcher menyentuh foreign listener 17020."
  $remainingContainers = @(& docker.exe ps -aq --filter "label=com.docker.compose.project=ecorione-desktop" 2>$null | Where-Object { $_ })
  Assert-True ($remainingContainers.Count -eq 0) "Container ecorione-desktop tersisa setelah Stop launcher."
  $retainedVolumes = @(& docker.exe volume ls -q --filter "name=ecorione-desktop_" 2>$null | Where-Object { $_ })
  Assert-True ($retainedVolumes.Count -gt 0) "Stop launcher tidak mempertahankan data volumes seperti kontrak desktop."
  $Report.phases.stop = [ordered]@{
    pass = $true
    aiPortReleased = $true
    foreign17020Preserved = $true
    dataVolumesRetained = $true
  }
  Write-Step "Stop PASS; runtime containers removed and data volumes retained"

  $postDoctor = Invoke-Launcher $doctorPath
  Assert-True ($postDoctor.code -eq 0) "Installed Doctor launcher gagal sesudah stop: $($postDoctor.output)"
  Assert-True ($postDoctor.output -match "Ai belum reachable") "Post-stop Doctor tidak melaporkan Ai stopped."
  $Report.phases.postDoctor = [ordered]@{ pass = $true }
  Write-Step "Installed Doctor post-stop PASS"

  $uninstaller = Get-ChildItem -LiteralPath $InstallRoot -Filter "unins*.exe" | Select-Object -First 1
  Assert-True ($null -ne $uninstaller) "Inno Setup uninstaller tidak ditemukan di installed app."
  $uninstallProcess = Start-Process -FilePath $uninstaller.FullName -ArgumentList @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART") -PassThru -Wait
  Assert-True ($uninstallProcess.ExitCode -eq 0) "Uninstaller gagal dengan exit code $($uninstallProcess.ExitCode)."
  $Installed = $false
  Start-Sleep -Milliseconds 750
  Assert-True (-not (Test-Path -LiteralPath $startPath -PathType Leaf)) "Installed launcher masih ada setelah uninstall."
  $Report.phases.uninstall = [ordered]@{ pass = $true; userDataRetained = (Test-Path -LiteralPath $DesktopDataRoot) }
  Write-Step "Uninstall PASS"

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
  try {
    if ($StackStarted -and (Test-Path -LiteralPath (Join-Path $InstallRoot "Stop-ECORIONE.cmd"))) {
      $env:ECORIONE_DESKTOP_NONINTERACTIVE = "1"
      Invoke-Launcher (Join-Path $InstallRoot "Stop-ECORIONE.cmd") | Out-Null
    }
  } catch {
    $Report.cleanupError = $_.Exception.Message
  }
  $reportPath = Write-Report
  Write-Error "FAIL W11: $($Report.error)"
  Write-Host "Sanitized report: $reportPath"
  exit 1
} finally {
  if ($null -ne $Protected17020) {
    try { $Protected17020.Stop() } catch {}
  }
  $env:PATH = $OriginalPath
  $env:LOCALAPPDATA = $OriginalLocalAppData
  $env:ECORIONE_DESKTOP_NO_OPEN = $OriginalNoOpen
  $env:ECORIONE_DESKTOP_NONINTERACTIVE = $OriginalNonInteractive
  if (-not $KeepAcceptanceFiles -and -not $Installed -and (Test-Path -LiteralPath $AcceptanceRoot)) {
    try { Remove-Item -LiteralPath $AcceptanceRoot -Recurse -Force } catch {}
  }
}
