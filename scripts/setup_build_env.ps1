param(
  [string]$PythonPath = "python",
  [switch]$Recreate
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$VenvDir = Join-Path $Root ".venv-build"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if ($Recreate -and (Test-Path $VenvDir)) {
  Remove-Item -LiteralPath $VenvDir -Recurse -Force
}

$Version = & $PythonPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($LASTEXITCODE -ne 0) {
  throw "Unable to run Python: $PythonPath"
}
if ($Version -notin @("3.12", "3.13")) {
  throw "Python 3.12 or 3.13 is required for release builds; found $Version"
}

if (!(Test-Path $VenvPython)) {
  & $PythonPath -m venv $VenvDir
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& $VenvPython -m pip install --upgrade pip==26.1.2
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $VenvPython -m pip install -r (Join-Path $Root "requirements-build.txt")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Build environment ready: $VenvPython"
