param(
  [string]$IsccPath = $env:ISCC_PATH,
  [string]$MetadataPath = $env:VOCABMASTER_RELEASE_METADATA_PATH
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\release_common.ps1"

$Root = Get-VocabMasterProjectRoot
$LoadedMetadata = Import-VocabMasterReleaseMetadata $MetadataPath
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
  $IsccArgs = @("installer.iss")

  function Add-InnoDefine($Name, $Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
      return
    }
    if ($Value.Contains('"')) {
      throw "$Name cannot contain double quote characters."
    }
    $script:IsccArgs += "/D$Name=`"$Value`""
  }

  Add-InnoDefine "AppPublisher" $env:VOCABMASTER_PUBLISHER
  Add-InnoDefine "AppPublisherURL" $env:VOCABMASTER_DOWNLOAD_URL
  Add-InnoDefine "AppSupportURL" $env:VOCABMASTER_SUPPORT_URL
  Add-InnoDefine "AppUpdatesURL" $env:VOCABMASTER_DOWNLOAD_URL

  if ($LoadedMetadata) {
    Write-Host "Metadata: $LoadedMetadata"
  }
  & $IsccPath @IsccArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Write-Host "Installer output: $(Join-Path $Root 'dist\installer')"
