#define AppVersion GetEnv("ECORIONE_VERSION")
#define BundleDir GetEnv("ECORIONE_BUNDLE_DIR")
#define InstallerOut GetEnv("ECORIONE_INSTALLER_OUT")

#if AppVersion == ""
  #error "ECORIONE_VERSION environment variable is required"
#endif
#if BundleDir == ""
  #error "ECORIONE_BUNDLE_DIR environment variable is required"
#endif
#if InstallerOut == ""
  #error "ECORIONE_INSTALLER_OUT environment variable is required"
#endif

[Setup]
AppId={{7BCBA91F-20A7-4E76-9B34-1CC7305507ED}
AppName=ECORIONE
AppVersion={#AppVersion}
AppPublisher=ECORIONE
DefaultDirName={localappdata}\Programs\ECORIONE
DefaultGroupName=ECORIONE
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#InstallerOut}
OutputBaseFilename=ECORIONE-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
SetupLogging=yes
UninstallDisplayName=ECORIONE

[Files]
Source: "{#BundleDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\ECORIONE"; Filename: "{app}\Start-ECORIONE.cmd"; WorkingDir: "{app}"
Name: "{group}\ECORIONE"; Filename: "{app}\Start-ECORIONE.cmd"; WorkingDir: "{app}"
Name: "{group}\ECORIONE Doctor"; Filename: "{app}\Doctor-ECORIONE.cmd"; WorkingDir: "{app}"
Name: "{group}\Stop ECORIONE"; Filename: "{app}\Stop-ECORIONE.cmd"; WorkingDir: "{app}"

[Run]
Filename: "{app}\Doctor-ECORIONE.cmd"; Description: "Check Docker Desktop and ECORIONE runtime prerequisites"; Flags: postinstall nowait skipifsilent unchecked

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
