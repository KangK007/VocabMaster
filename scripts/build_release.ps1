param(
  [string]$MetadataPath = $env:VOCABMASTER_RELEASE_METADATA_PATH,
  [string]$PythonPath = "",
  [string]$IsccPath = $env:ISCC_PATH,
  [switch]$SkipSigning,
  [switch]$AllowUnsigned
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\release_common.ps1"

$Root = Get-VocabMasterProjectRoot
$LoadedMetadata = Import-VocabMasterReleaseMetadata $MetadataPath

Push-Location $Root
try {
  Write-Host "Building VocabMaster release artifacts..."
  $BuildArgs = @("-Clean")
  if ($PythonPath) {
    $BuildArgs += @("-PythonPath", $PythonPath)
  }
  & "$PSScriptRoot\build_windows.ps1" @BuildArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if (!$SkipSigning) {
    & "$PSScriptRoot\sign_release_artifacts.ps1" -SkipInstaller
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  $InstallerArgs = @()
  if ($IsccPath) {
    $InstallerArgs += @("-IsccPath", $IsccPath)
  }
  if ($LoadedMetadata) {
    $InstallerArgs += @("-MetadataPath", $LoadedMetadata)
  }
  & "$PSScriptRoot\build_installer.ps1" @InstallerArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if (!$SkipSigning) {
    & "$PSScriptRoot\sign_release_artifacts.ps1" -SkipApp
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  $CheckArgs = @()
  if ($LoadedMetadata) {
    $CheckArgs += @("-ReleaseMetadataPath", $LoadedMetadata)
  }
  if ($AllowUnsigned -or $SkipSigning) {
    $CheckArgs += "-AllowUnsigned"
  }
  & "$PSScriptRoot\check_release_artifacts.ps1" @CheckArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "Release build workflow completed."
