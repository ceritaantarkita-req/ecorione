[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$Remote = "origin",
  [string]$AllowlistPath = "docs/verification/branch-hygiene-allowlist-2026-09-27.json",
  [string]$ReportPath
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $output = & git @Args 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    throw "git $($Args -join ' ') failed ($code): $($output -join [Environment]::NewLine)"
  }
  return @($output)
}

$repoRoot = (Invoke-Git rev-parse --show-toplevel)[0].Trim()
Set-Location $repoRoot

if (-not (Test-Path -LiteralPath $AllowlistPath)) {
  throw "Allowlist not found: $AllowlistPath"
}

$allow = Get-Content -LiteralPath $AllowlistPath -Raw | ConvertFrom-Json
if (-not $allow.safe_delete) {
  throw "Allowlist has no safe_delete entries."
}

$currentBranch = ((Invoke-Git branch --show-current) -join "").Trim()

Write-Host "Branch hygiene cleanup"
Write-Host "  audited main: $($allow.audited_main_sha)"
Write-Host "  allowlisted:   $($allow.safe_delete.Count)"
Write-Host "  mode:          $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Host ""

Invoke-Git fetch $Remote --prune | Out-Null

$results = [System.Collections.Generic.List[object]]::new()

foreach ($entry in $allow.safe_delete) {
  $name = [string]$entry.branch
  $expected = ([string]$entry.expected_sha).ToLowerInvariant()

  if ([string]::IsNullOrWhiteSpace($name) -or $name -eq "main") {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$null; action="skip"; reason="protected-name" })
    continue
  }

  if ($name -eq $currentBranch) {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$null; action="skip"; reason="current-local-branch" })
    continue
  }

  $raw = & git ls-remote --heads $Remote "refs/heads/$name" 2>$null
  if ($LASTEXITCODE -ne 0) {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$null; action="skip"; reason="ls-remote-failed" })
    continue
  }

  if (-not $raw) {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$null; action="already-missing"; reason="remote-ref-absent" })
    continue
  }

  $actual = (($raw -split "\s+")[0]).ToLowerInvariant()
  if ($actual -ne $expected) {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$actual; action="hold"; reason="remote-sha-moved" })
    continue
  }

  if (-not $Apply) {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$actual; action="would-delete"; reason="exact-sha-match" })
    continue
  }

  & git push $Remote --delete $name
  if ($LASTEXITCODE -eq 0) {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$actual; action="deleted"; reason="exact-sha-match" })
  } else {
    $results.Add([pscustomobject]@{ branch=$name; expected_sha=$expected; actual_sha=$actual; action="failed"; reason="git-push-delete-failed" })
  }
}

if (-not $ReportPath) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ReportPath = Join-Path ([System.IO.Path]::GetTempPath()) "ecorione-branch-hygiene-$stamp.json"
}

$summary = [ordered]@{}
foreach ($group in ($results | Group-Object action)) {
  $summary[$group.Name] = $group.Count
}

$report = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  repository_root = $repoRoot
  remote = $Remote
  mode = $(if ($Apply) { "apply" } else { "dry-run" })
  audited_main_sha = $allow.audited_main_sha
  allowlisted_count = $allow.safe_delete.Count
  summary = $summary
  results = $results
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding utf8

Write-Host ""
Write-Host "Summary:"
$summary.GetEnumerator() | Sort-Object Name | ForEach-Object {
  Write-Host ("  {0}: {1}" -f $_.Key, $_.Value)
}
Write-Host "Report: $ReportPath"

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry-run only. Re-run with -Apply after reviewing the report."
}
