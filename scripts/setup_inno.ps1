param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Version = "7.0.2"
$ExpectedHash = "5ad54ca3def786f8f4212552e54cc6d8d61329e2d24a1cfee0571d42c2684ff1"
$ExpectedSize = 17020192
$ToolsDir = Join-Path $Root ".tools"
$DownloadDir = Join-Path $ToolsDir "downloads"
$InstallDir = Join-Path $ToolsDir "inno-setup-$Version"
$Installer = Join-Path $DownloadDir "innosetup-$Version-x64.exe"
$Iscc = Join-Path $InstallDir "ISCC.exe"
$Url = "https://github.com/jrsoftware/issrc/releases/download/is-7_0_2/innosetup-7.0.2-x64.exe"

if ((Test-Path $Iscc) -and !$Force) {
  Write-Host "Inno Setup already available: $Iscc"
  exit 0
}

New-Item -ItemType Directory -Path $DownloadDir -Force | Out-Null
if ($Force -and (Test-Path $Installer)) {
  Remove-Item -LiteralPath $Installer -Force
}
if (!(Test-Path $Installer) -or (Get-Item $Installer).Length -ne $ExpectedSize) {
  & curl.exe --fail --location --retry 3 --continue-at - --output $Installer $Url
  if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup download failed with exit code $LASTEXITCODE"
  }
}

$ActualHash = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualHash -ne $ExpectedHash) {
  throw "Inno Setup SHA-256 mismatch: $ActualHash"
}

$Signature = Get-AuthenticodeSignature -LiteralPath $Installer
if ($Signature.Status -ne "Valid" -or $Signature.SignerCertificate.Subject -notmatch "Pyrsys B\.V\.") {
  throw "Inno Setup Authenticode verification failed: $($Signature.Status) $($Signature.SignerCertificate.Subject)"
}

if (Test-Path $InstallDir) {
  Remove-Item -LiteralPath $InstallDir -Recurse -Force
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

$Process = Start-Process -FilePath $Installer -ArgumentList @(
  "/CURRENTUSER",
  "/VERYSILENT",
  "/SUPPRESSMSGBOXES",
  "/NORESTART",
  "/DIR=$InstallDir"
) -Wait -PassThru -WindowStyle Hidden
if ($Process.ExitCode -ne 0) {
  throw "Inno Setup installation failed with exit code $($Process.ExitCode)"
}
if (!(Test-Path $Iscc)) {
  throw "ISCC.exe not found after installation: $Iscc"
}

Write-Host "Inno Setup ready: $Iscc"
