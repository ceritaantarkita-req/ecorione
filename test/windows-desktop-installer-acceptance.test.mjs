import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const harness = readFileSync(
  resolve(ROOT, "scripts/windows-desktop-installer-acceptance.ps1"),
  "utf8",
);
const desktop = readFileSync(resolve(ROOT, "desktop/ecorione.ps1"), "utf8");
const supervisor = readFileSync(resolve(ROOT, "scripts/desktop-native-supervisor.mjs"), "utf8");
const startLauncher = readFileSync(resolve(ROOT, "desktop/Start-ECORIONE.cmd"), "utf8");
const doctorLauncher = readFileSync(resolve(ROOT, "desktop/Doctor-ECORIONE.cmd"), "utf8");
const stopLauncher = readFileSync(resolve(ROOT, "desktop/Stop-ECORIONE.cmd"), "utf8");

describe("W11 Dockerless Windows installer/launcher acceptance contract", () => {
  it("requires a real Setup executable and exact release provenance", () => {
    expect(harness).toContain("[Parameter(Mandatory = $true)]");
    expect(harness).toContain("$InstallerPath");
    expect(harness).toContain("$ChecksumPath");
    expect(harness).toContain("$ExpectedSourceRevision");
    expect(harness).toContain("Get-FileHash");
    expect(harness).toContain("RELEASE-MANIFEST.json");
    expect(harness).toContain('runtime -eq "native-windows"');
    expect(harness).toContain("dockerRequired -eq $false");
  });

  it("proves the installed app does not depend on host developer tools or Docker", () => {
    expect(harness).toContain("hostNodeVisible = $false");
    expect(harness).toContain("hostPnpmVisible = $false");
    expect(harness).toContain("hostGitVisible = $false");
    expect(harness).toContain("dockerVisible = $false");
    expect(harness).toContain("Get-Command docker.exe");
    expect(harness).toContain('"runtime\\node\\node.exe"');
    expect(harness).toContain('"runtime\\temporal\\temporal.exe"');
    expect(desktop).toContain("Docker tidak diperlukan");
    expect(desktop).not.toContain("Assert-Docker");
    expect(desktop).not.toContain("docker compose");
  });

  it("uses bundled Node + Temporal and a single native supervisor process tree", () => {
    expect(desktop).toContain("runtime\\node\\node.exe");
    expect(desktop).toContain("runtime\\temporal\\temporal.exe");
    expect(desktop).toContain("desktop-native-supervisor.mjs");
    expect(supervisor).toContain('"server",\n      "start-dev"');
    expect(supervisor).toContain('"--db-filename"');
    expect(supervisor).toContain("taskkill");
    expect(supervisor).toContain("ECORIONE_NATIVE_READY");
  });

  it("forces preferred-port collision and requires fallback without touching the foreign listener", () => {
    expect(harness).toContain("$Protected17020");
    expect(harness).toContain("$resolvedPort -ne 17020");
    expect(harness).toContain("$resolvedPort -ge 17029 -and $resolvedPort -le 17039");
    expect(harness).toContain("foreign17020Preserved = $true");
  });

  it("exercises installed Start, Doctor, Stop, reuse, bundled Temporal, and uninstall", () => {
    expect(harness).toContain('"Start-ECORIONE.cmd"');
    expect(harness).toContain('"Doctor-ECORIONE.cmd"');
    expect(harness).toContain('"Stop-ECORIONE.cmd"');
    expect(harness).toContain("Bundled Temporal tidak reachable");
    expect(harness).toContain("Second Start membuat port/instance baru");
    expect(harness).toContain("W11-G post-stop Doctor + uninstall PASS");
    expect(harness).toContain("PASS W11 Windows installer/launcher acceptance");
  });

  it("keeps wrapper behavior deterministic for noninteractive acceptance", () => {
    expect(startLauncher).toContain("ECORIONE_DESKTOP_NO_OPEN");
    expect(startLauncher).toContain("-NoOpen");
    expect(startLauncher).toContain("ECORIONE_DESKTOP_NONINTERACTIVE");
    expect(doctorLauncher).toContain('set "ECORIONE_EXIT=%ERRORLEVEL%"');
    expect(doctorLauncher).toContain("exit /b %ECORIONE_EXIT%");
    expect(stopLauncher).toContain("ECORIONE_DESKTOP_NONINTERACTIVE");
  });
});
