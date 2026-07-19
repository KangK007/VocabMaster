# Copy this file to .release.local.ps1 and replace every value with real public
# release information. Do not commit .release.local.ps1 or certificate files.

$env:VOCABMASTER_PUBLISHER = "Your Legal Publisher Name"
$env:VOCABMASTER_SUPPORT_URL = "https://your-domain.example/support"
$env:VOCABMASTER_PRIVACY_CONTACT = "mailto:privacy@your-domain.example"
$env:VOCABMASTER_DOWNLOAD_URL = "https://your-domain.example/downloads/vocabmaster/2.0.0"

# Authenticode signing. Use either a PFX file or a certificate thumbprint from
# the Windows certificate store.
$env:VOCABMASTER_SIGN_CERT_PATH = "C:\secure\VocabMaster-CodeSigning.pfx"
# $env:VOCABMASTER_SIGN_CERT_PASSWORD = "<store this in your shell or CI secret>"
# $env:VOCABMASTER_SIGN_CERT_THUMBPRINT = "0123456789ABCDEF0123456789ABCDEF01234567"
# $env:VOCABMASTER_SIGN_USE_MACHINE_STORE = "1"
$env:VOCABMASTER_TIMESTAMP_URL = "https://timestamp.your-ca.example"
