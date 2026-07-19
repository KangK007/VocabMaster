param(
  [switch]$AllowUnsigned,
  [switch]$AllowDirty,
  [string]$ReleaseMetadataPath = $env:VOCABMASTER_RELEASE_METADATA_PATH
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\release_common.ps1"

$Root = Get-VocabMasterProjectRoot
$LoadedMetadata = Import-VocabMasterReleaseMetadata $ReleaseMetadataPath
$Version = (Get-Content -Path (Join-Path $Root "VERSION") -Encoding UTF8 -Raw).Trim()
$AppExe = Join-Path $Root "dist\VocabMaster\VocabMaster.exe"
$Installer = Join-Path $Root "dist\installer\VocabMaster-Setup-$Version.exe"
$LicenseDir = Join-Path $Root "dist\VocabMaster\licenses"

$Failures = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]

function Add-Failure($Message) {
  $Failures.Add($Message) | Out-Null
}

function Add-Warning($Message) {
  $Warnings.Add($Message) | Out-Null
}

function Check-Exists($Path, $Label) {
  if (!(Test-Path $Path)) {
    Add-Failure "$Label not found: $Path"
    return $false
  }
  return $true
}

function Check-Signature($Path, $Label) {
  if (!(Test-Path $Path)) { return }
  $Signature = Get-AuthenticodeSignature -FilePath $Path
  if ($Signature.Status -ne "Valid") {
    $Message = "$Label signature is $($Signature.Status), expected Valid"
    if ($AllowUnsigned) {
      Add-Warning $Message
    } else {
      Add-Failure $Message
    }
  }
}

Check-Exists $AppExe "Packaged app" | Out-Null
Check-Exists $Installer "Installer" | Out-Null
Check-Exists $LicenseDir "License directory" | Out-Null

Check-Signature $AppExe "Packaged app"
Check-Signature $Installer "Installer"

if (Test-Path $LicenseDir) {
  $RequiredLicenses = @(
    "VocabMaster-LICENSE.txt",
    "ECDICT-LICENSE.txt",
    "THIRD_PARTY_NOTICES.md"
  )
  foreach ($Name in $RequiredLicenses) {
    if (!(Test-Path (Join-Path $LicenseDir $Name))) {
      Add-Failure "Required license file missing: $Name"
    }
  }
}

$SupportUrl = $env:VOCABMASTER_SUPPORT_URL
$PrivacyContact = $env:VOCABMASTER_PRIVACY_CONTACT
$DownloadUrl = $env:VOCABMASTER_DOWNLOAD_URL
$Publisher = $env:VOCABMASTER_PUBLISHER

if (Test-VocabMasterPlaceholderValue $Publisher) {
  Add-Failure "VOCABMASTER_PUBLISHER must be set to the real legal publisher name for public release"
}
if (!(Test-VocabMasterHttpsUrl $SupportUrl)) {
  Add-Failure "VOCABMASTER_SUPPORT_URL must be set to a real HTTPS support page for public release"
}
if (!(Test-VocabMasterPrivacyContact $PrivacyContact)) {
  Add-Failure "VOCABMASTER_PRIVACY_CONTACT must be set to a real mailto: or HTTPS privacy contact"
}
if (!(Test-VocabMasterHttpsUrl $DownloadUrl)) {
  Add-Failure "VOCABMASTER_DOWNLOAD_URL must be set to a real HTTPS versioned download or update page"
}

if (Get-Command git -ErrorAction SilentlyContinue) {
  Push-Location $Root
  try {
    $GitStatus = git status --porcelain
    if ($GitStatus -and !$AllowDirty) {
      Add-Failure "Git working tree is not clean; commit or intentionally exclude changes before public release"
    } elseif ($GitStatus) {
      Add-Warning "Git working tree is not clean"
    }
  } finally {
    Pop-Location
  }
} else {
  Add-Warning "git command not found; working tree cleanliness was not checked"
}

Write-Host "Release artifact check for VocabMaster $Version"
Write-Host "App:       $AppExe"
Write-Host "Installer: $Installer"
if ($LoadedMetadata) {
  Write-Host "Metadata:  $LoadedMetadata"
}

if ($Warnings.Count -gt 0) {
  Write-Host ""
  Write-Host "Warnings:"
  foreach ($Warning in $Warnings) {
    Write-Host " - $Warning"
  }
}

if ($Failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Failures:"
  foreach ($Failure in $Failures) {
    Write-Host " - $Failure"
  }
  exit 1
}

Write-Host "Release artifact check passed."
