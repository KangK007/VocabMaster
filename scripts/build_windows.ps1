param(
  [switch]$Clean,
  [string]$PythonPath = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (!$PythonPath) {
  $PythonPath = Join-Path $Root ".venv-build\Scripts\python.exe"
}
if (!(Test-Path $PythonPath)) {
  throw "Build Python not found. Run scripts\setup_build_env.ps1 first."
}

if ($Clean) {
  Remove-Item -LiteralPath (Join-Path $Root "build"),(Join-Path $Root "dist") -Recurse -Force -ErrorAction SilentlyContinue
}

& $PythonPath -m PyInstaller VocabMaster.spec --noconfirm --clean
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$AppDirectory = Join-Path $Root "dist\VocabMaster"
$ExePath = Join-Path $AppDirectory "VocabMaster.exe"
if (!(Test-Path $ExePath)) {
  throw "Build succeeded but executable was not found: $ExePath"
}

& $PythonPath scripts\collect_licenses.py --output (Join-Path $AppDirectory "licenses")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Copy-Item -LiteralPath (Join-Path $Root "docs\privacy-policy.md") -Destination (Join-Path $AppDirectory "privacy-policy.md") -Force

Write-Host "Build output: $AppDirectory"
