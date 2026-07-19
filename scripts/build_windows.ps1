param(
  [switch]$Clean,
  [string]$PythonPath = "",
  [string]$MetadataPath = $env:VOCABMASTER_RELEASE_METADATA_PATH
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\release_common.ps1"

$Root = Get-VocabMasterProjectRoot
$LoadedMetadata = Import-VocabMasterReleaseMetadata $MetadataPath
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

if ($env:VOCABMASTER_PUBLISHER -and !(Test-VocabMasterPlaceholderValue $env:VOCABMASTER_PUBLISHER)) {
  $VersionInfoSource = Join-Path $Root "assets\version_info.txt"
  $VersionInfoTarget = Join-Path $Root "build\version_info.txt"
  New-Item -ItemType Directory -Path (Join-Path $Root "build") -Force | Out-Null
  $Publisher = $env:VOCABMASTER_PUBLISHER.Replace("\", "\\").Replace("'", "\'")
  $VersionInfo = Get-Content -Path $VersionInfoSource -Encoding UTF8 -Raw
  $VersionInfo = $VersionInfo.Replace(
    "StringStruct('CompanyName', 'VocabMaster Contributors')",
    "StringStruct('CompanyName', '$Publisher')"
  )
  $VersionInfo = $VersionInfo.Replace(
    "StringStruct('LegalCopyright', 'Copyright (c) 2026 VocabMaster Contributors')",
    "StringStruct('LegalCopyright', 'Copyright (c) 2026 $Publisher')"
  )
  Set-Content -Path $VersionInfoTarget -Value $VersionInfo -Encoding UTF8
  $env:VOCABMASTER_VERSION_INFO_FILE = $VersionInfoTarget
  Write-Host "Version metadata publisher: $env:VOCABMASTER_PUBLISHER"
} elseif ($LoadedMetadata) {
  throw "VOCABMASTER_PUBLISHER is missing or still a placeholder in $LoadedMetadata."
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
