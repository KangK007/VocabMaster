param(
  [string]$Version = "",
  [string]$MetadataPath = $env:VOCABMASTER_RELEASE_METADATA_PATH,
  [string]$SignToolPath = $env:SIGNTOOL_PATH,
  [string]$CertificatePath = $env:VOCABMASTER_SIGN_CERT_PATH,
  [string]$CertificatePassword = $env:VOCABMASTER_SIGN_CERT_PASSWORD,
  [string]$CertificateThumbprint = $env:VOCABMASTER_SIGN_CERT_THUMBPRINT,
  [string]$TimestampUrl = $env:VOCABMASTER_TIMESTAMP_URL,
  [switch]$UseMachineStore,
  [switch]$SkipApp,
  [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\release_common.ps1"

$Root = Get-VocabMasterProjectRoot
$LoadedMetadata = Import-VocabMasterReleaseMetadata $MetadataPath

if (!$Version) {
  $Version = (Get-Content -Path (Join-Path $Root "VERSION") -Encoding UTF8 -Raw).Trim()
}
if (!$TimestampUrl) {
  $TimestampUrl = $env:VOCABMASTER_TIMESTAMP_URL
}
if (!$CertificatePath) {
  $CertificatePath = $env:VOCABMASTER_SIGN_CERT_PATH
}
if (!$CertificatePassword) {
  $CertificatePassword = $env:VOCABMASTER_SIGN_CERT_PASSWORD
}
if (!$CertificateThumbprint) {
  $CertificateThumbprint = $env:VOCABMASTER_SIGN_CERT_THUMBPRINT
}

$UseMachineStoreFlag = $UseMachineStore.IsPresent -or ($env:VOCABMASTER_SIGN_USE_MACHINE_STORE -match "^(1|true|yes)$")
$AppExe = Join-Path $Root "dist\VocabMaster\VocabMaster.exe"
$Installer = Join-Path $Root "dist\installer\VocabMaster-Setup-$Version.exe"
$Targets = @()
if (!$SkipApp) {
  $Targets += @{ Path = $AppExe; Label = "Packaged app" }
}
if (!$SkipInstaller) {
  $Targets += @{ Path = $Installer; Label = "Installer" }
}

if ($Targets.Count -eq 0) {
  throw "No signing targets selected."
}
foreach ($Target in $Targets) {
  if (!(Test-Path $Target.Path)) {
    throw "$($Target.Label) not found: $($Target.Path)"
  }
}

if (!$CertificatePath -and !$CertificateThumbprint) {
  throw "Provide VOCABMASTER_SIGN_CERT_PATH or VOCABMASTER_SIGN_CERT_THUMBPRINT before signing."
}
if ($CertificatePath -and !(Test-Path $CertificatePath)) {
  throw "Signing certificate PFX not found: $CertificatePath"
}
if (!$TimestampUrl -or $TimestampUrl -notmatch "^https?://") {
  throw "VOCABMASTER_TIMESTAMP_URL must be set to a real RFC3161 timestamp service URL."
}

$ResolvedSignTool = Resolve-VocabMasterSignTool $SignToolPath

function Invoke-VocabMasterSign {
  param(
    [string]$Path,
    [string]$Label
  )

  $SignArgs = @("sign", "/fd", "SHA256")
  if ($CertificatePath) {
    $SignArgs += @("/f", $CertificatePath)
    if ($CertificatePassword) {
      $SignArgs += @("/p", $CertificatePassword)
    }
  } else {
    $SignArgs += @("/sha1", $CertificateThumbprint)
    if ($UseMachineStoreFlag) {
      $SignArgs += "/sm"
    }
  }
  $SignArgs += @("/tr", $TimestampUrl, "/td", "SHA256", $Path)

  Write-Host "Signing ${Label}: $Path"
  & $ResolvedSignTool @SignArgs
  if ($LASTEXITCODE -ne 0) {
    throw "signtool failed for $Label with exit code $LASTEXITCODE"
  }

  $Signature = Get-AuthenticodeSignature -FilePath $Path
  if ($Signature.Status -ne "Valid") {
    throw "$Label signature is $($Signature.Status), expected Valid"
  }
}

Write-Host "Signing release artifacts for VocabMaster $Version"
if ($LoadedMetadata) {
  Write-Host "Metadata: $LoadedMetadata"
}
Write-Host "SignTool: $ResolvedSignTool"

foreach ($Target in $Targets) {
  Invoke-VocabMasterSign -Path $Target.Path -Label $Target.Label
}

Write-Host "Release artifact signing completed."
