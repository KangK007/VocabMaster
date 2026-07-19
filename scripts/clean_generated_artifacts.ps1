param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$Targets = @(
  "artifacts",
  "build",
  "playwright-report",
  "test-results",
  "__pycache__",
  "scripts\__pycache__",
  "tests\__pycache__",
  ".cache\audit-desktop",
  ".cache\audit-desktop-visible",
  ".cache\audit-ui-800x600.png",
  ".cache\audit-ui-620x480.png",
  ".cache\audit-ui-1280x720.png",
  ".tools\inno-setup-6.7.3",
  ".tools\downloads",
  "=0.19.0",
  "=1.0",
  "app_error.log",
  "nul"
)

function Resolve-SafeTarget($RelativePath) {
  $Path = Join-Path $Root $RelativePath
  if (!(Test-Path -LiteralPath $Path)) { return $null }

  $Resolved = (Resolve-Path -LiteralPath $Path).Path
  $Prefix = $Root + [IO.Path]::DirectorySeparatorChar
  if ($Resolved -eq $Root -or !$Resolved.StartsWith($Prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean path outside workspace: $Resolved"
  }
  return $Resolved
}

function Measure-Target($Path) {
  $Item = Get-Item -LiteralPath $Path
  $Files = if ($Item.PSIsContainer) {
    Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue
  } else {
    @($Item)
  }
  $Size = ($Files | Measure-Object Length -Sum).Sum
  [pscustomobject]@{
    Path = $Path
    MB = [math]::Round($Size / 1MB, 2)
    Files = ($Files | Measure-Object).Count
  }
}

$Rows = foreach ($Target in $Targets) {
  $Resolved = Resolve-SafeTarget $Target
  if ($Resolved) { Measure-Target $Resolved }
}

if (!$Rows) {
  Write-Host "No generated artifacts found."
  exit 0
}

$Rows | Format-Table -AutoSize
$TotalMb = [math]::Round((($Rows | Measure-Object MB -Sum).Sum), 2)
Write-Host "Total candidate size: $TotalMb MB"

if (!$Apply) {
  Write-Host "Dry run only. Re-run with -Apply to remove these generated artifacts."
  exit 0
}

foreach ($Row in $Rows) {
  Remove-Item -LiteralPath $Row.Path -Recurse -Force
}

Write-Host "Generated artifacts removed."
