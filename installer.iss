; VocabMaster Windows Installer Script
; Requires Inno Setup 7 (https://jrsoftware.org/isinfo.php)
; Build: ISCC.exe installer.iss   OR   scripts\build-installer.bat

#define AppName "VocabMaster"
#define AppVersion "2.0.0"
#define AppPublisher "VocabMaster Contributors"
#define AppExeName "VocabMaster.exe"
#define AppId "{{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
VersionInfoVersion={#AppVersion}.0
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Windows Installer
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputDir=dist\installer
OutputBaseFilename=VocabMaster-Setup-{#AppVersion}
SetupIconFile=assets\icon.ico
LicenseFile=LICENSE
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; SignTool, sign once the certificate is available
; SignTool=VocabMasterSign
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExeName}
ChangesAssociations=no
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\VocabMaster\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

; ---------------------------------------------------------------------------
; [Code] – WebView2 runtime detection
; ---------------------------------------------------------------------------
[Code]

const
  WebView2DownloadURL = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';
  WebView2RegKey = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2RegKeyHKCU = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

{*
 * Check whether the Evergreen WebView2 Runtime is installed.
 * Probes HKLM first (system-wide install), then HKCU (per-user install).
 *}
function IsWebView2Installed(): Boolean;
var
  VersionStr: String;
begin
  // System-wide Evergreen WebView2 Runtime (64-bit / WOW64)
  Result := RegQueryStringValue(
    HKLM,
    WebView2RegKey,
    'pv',
    VersionStr
  );

  if Result then
  begin
    Log('WebView2 Runtime found (HKLM): ' + VersionStr);
    Exit;
  end;

  // Per-user Evergreen WebView2 Runtime
  Result := RegQueryStringValue(
    HKCU,
    WebView2RegKeyHKCU,
    'pv',
    VersionStr
  );

  if Result then
  begin
    Log('WebView2 Runtime found (HKCU): ' + VersionStr);
    Exit;
  end;

  Log('WebView2 Runtime NOT detected.');
end;

{*
 * Prompt the user to download WebView2 if it is missing.
 * Returns True to continue setup regardless of user's choice.
 *}
function InitializeSetup(): Boolean;
var
  DummyResultCode: Integer;
begin
  Result := True;

  if IsWebView2Installed() then
    Exit;

  if MsgBox(
    'VocabMaster requires the Microsoft Edge WebView2 Runtime to display its user interface.' + #13#10#13#10 +
    'The runtime was not detected on this computer.' + #13#10#13#10 +
    'Would you like to download it now?' + #13#10 +
    '(You can also install it later and then launch VocabMaster.)',
    mbConfirmation, MB_YESNO
  ) = IDYES then
  begin
    ShellExec('open', WebView2DownloadURL, '', '', SW_SHOW, ewNoWait, DummyResultCode);
  end;
end;
