import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const installer = readFileSync(resolve(ROOT, "desktop/installer.iss"), "utf8");
const workflow = readFileSync(resolve(ROOT, ".github/workflows/desktop-installer.yml"), "utf8");

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
    expect(installer).toContain('#error "ECORIONE_VERSION environment variable is required"');
    expect(installer).toContain("OutputBaseFilename=ECORIONE-Setup-{#AppVersion}");
  });

  it("keeps manual release and limits PR installer acceptance to explicit paths", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+push:/m);
    expect(workflow).toMatch(/^\s+pull_request:/m);
    for (const path of [
      '.github/workflows/desktop-installer.yml',
      '.inno-setup-version',
      '.node-version',
      'desktop/**',
      'scripts/desktop-bundle.mjs',
      'package.json',
      'pnpm-lock.yaml',
    ]) {
      expect(workflow).toContain(`- "${path}"`);
    }
    expect(workflow).toContain("inputs.version || '0.1.0'");
    expect(workflow).toContain('node scripts/desktop-bundle.mjs --version "$ECORIONE_VERSION"');
    expect(workflow).not.toContain("desktop:bundle -- --version");
    expect(workflow).toContain(
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    );
    expect(workflow).toContain(
      "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093",
    );
    expect(workflow).toContain("Get-FileHash");
    expect(workflow).toContain("SHA256SUMS");
  });
});
