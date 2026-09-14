import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const installer = readFileSync(resolve(ROOT, "desktop/installer.iss"), "utf8");

describe("ECORIONE Windows installer specification", () => {
  it("installs only the prepared bundle and never the source repository", () => {
    expect(installer).toContain('#define BundleDir GetEnv("ECORIONE_BUNDLE_DIR")');
    expect(installer).toContain('Source: "{#BundleDir}\\*"');
    expect(installer).not.toContain("node_modules");
    expect(installer).not.toContain("pnpm install");
    expect(installer).not.toContain("git clone");
    expect(installer).not.toMatch(/^Source: .*\.git/m);
  });

  it("uses per-user installation without requiring administrator privilege", () => {
    expect(installer).toContain("DefaultDirName={localappdata}\\Programs\\ECORIONE");
    expect(installer).toContain("PrivilegesRequired=lowest");
    expect(installer).toContain("ArchitecturesAllowed=x64compatible");
  });

  it("creates start and diagnostic shortcuts but does not auto-start destructive actions", () => {
    expect(installer).toContain('Filename: "{app}\\Start-ECORIONE.cmd"');
    expect(installer).toContain('Filename: "{app}\\Doctor-ECORIONE.cmd"');
    expect(installer).toContain('Filename: "{app}\\Stop-ECORIONE.cmd"');
    expect(installer).not.toContain("down -v");
    expect(installer).not.toContain("docker volume rm");
  });

  it("requires explicit release inputs and emits a versioned Setup executable", () => {
    expect(installer).toContain('#define AppVersion GetEnv("ECORIONE_VERSION")');
    expect(installer).toContain('#define InstallerOut GetEnv("ECORIONE_INSTALLER_OUT")');
    expect(installer).toContain("#error \"ECORIONE_VERSION environment variable is required\"");
    expect(installer).toContain("OutputBaseFilename=ECORIONE-Setup-{#AppVersion}");
  });
});
