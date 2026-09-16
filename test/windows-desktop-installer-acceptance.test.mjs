import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const harness = readFileSync(
  resolve(ROOT, "scripts/windows-desktop-installer-acceptance.ps1"),
  "utf8",
);
const startLauncher = readFileSync(resolve(ROOT, "desktop/Start-ECORIONE.cmd"), "utf8");
const doctorLauncher = readFileSync(resolve(ROOT, "desktop/Doctor-ECORIONE.cmd"), "utf8");
const stopLauncher = readFileSync(resolve(ROOT, "desktop/Stop-ECORIONE.cmd"), "utf8");

describe("W11 Windows installer/launcher acceptance contract", () => {
  it("requires a real Setup executable and can verify release provenance", () => {
    expect(harness).toContain("[Parameter(Mandatory = $true)]");
    expect(harness).toContain("$InstallerPath");
    expect(harness).toContain("$ChecksumPath");
    expect(harness).toContain("$ExpectedSourceRevision");
    expect(harness).toContain("Get-FileHash");
    expect(harness).toContain("RELEASE-MANIFEST.json");
    expect(harness).toContain("sourceRevision");
  });

  it("isolates the installed app from source-development prerequisites", () => {
    expect(harness).toContain("$AcceptanceLocalAppData");
    expect(harness).toContain("hostNodeVisible = $false");
    expect(harness).toContain("hostPnpmVisible = $false");
    expect(harness).toContain("hostGitVisible = $false");
    expect(harness).toContain("dockerVisible = $true");
    expect(harness).toContain("Get-Command node.exe");
    expect(harness).toContain("Get-Command pnpm.cmd");
    expect(harness).toContain("Get-Command git.exe");
  });

  it("forces a real preferred-port collision and requires fallback preservation", () => {
    expect(harness).toContain("$Protected17020");
    expect(harness).toContain("$resolvedPort -ne 17020");
    expect(harness).toContain("$resolvedPort -ge 17029 -and $resolvedPort -le 17039");
    expect(harness).toContain('foreign17020Preserved = $true');
  });

  it("exercises the installed Start, Doctor, and Stop launchers", () => {
    expect(harness).toContain('"Start-ECORIONE.cmd"');
    expect(harness).toContain('"Doctor-ECORIONE.cmd"');
    expect(harness).toContain('"Stop-ECORIONE.cmd"');
    expect(harness).toContain("Second Start reused existing desktop instance");
    expect(harness).toContain("dataVolumesRetained = $true");
    expect(harness).toContain("PASS W11 Windows installer/launcher acceptance");
  });

  it("makes the Windows launcher wrappers deterministic for noninteractive acceptance", () => {
    expect(startLauncher).toContain("ECORIONE_DESKTOP_NO_OPEN");
    expect(startLauncher).toContain("-NoOpen");
    expect(startLauncher).toContain("ECORIONE_DESKTOP_NONINTERACTIVE");
    expect(doctorLauncher).toContain('set "ECORIONE_EXIT=%ERRORLEVEL%"');
    expect(doctorLauncher).toContain("exit /b %ECORIONE_EXIT%");
    expect(doctorLauncher).toContain("ECORIONE_DESKTOP_NONINTERACTIVE");
    expect(stopLauncher).toContain("ECORIONE_DESKTOP_NONINTERACTIVE");
    expect(stopLauncher).toContain("exit /b 0");
  });

  it("fails closed when an existing desktop stack or cached runtime image would weaken fresh-install proof", () => {
    expect(harness).toContain("com.docker.compose.project=ecorione-desktop");
    expect(harness).toContain("Image ecorione:desktop sudah ada");
    expect(harness).toContain("fresh-install proof");
    expect(harness).toContain("Bundled runtime image tidak ter-load");
  });
});
