param(
  [string]$IsccPath = $env:ISCC_PATH
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AppExe = Join-Path $Root "dist\VocabMaster\VocabMaster.exe"

if (!(Test-Path $AppExe)) {
  throw "Packaged application not found. Run scripts\build_windows.ps1 first."
}

if (!$IsccPath) {
  $Candidates = @(
    (Join-Path $Root ".tools\inno-setup-7.0.2\ISCC.exe"),
    "C:\Program Files\Inno Setup 7\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
  )
  $IsccPath = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (!$IsccPath -or !(Test-Path $IsccPath)) {
  throw "Inno Setup 6 compiler not found. Pass -IsccPath or set ISCC_PATH."
}

Push-Location $Root
try {
  & $IsccPath "installer.iss"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "Installer output: $(Join-Path $Root 'dist\installer')"
