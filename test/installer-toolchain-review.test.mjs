import { describe, expect, it } from "vitest";
import {
  readPinnedInnoSetupVersion,
  reviewInstallerWorkflowContent,
} from "../scripts/installer-toolchain-review.mjs";

describe("pinned Inno Setup installer toolchain review", () => {
  it("accepts exact semver from the central version file", () => {
    expect(readPinnedInnoSetupVersion(() => "6.7.1\n")).toBe("6.7.1");
  });

  it("rejects mutable or incomplete installer versions", () => {
    expect(() => readPinnedInnoSetupVersion(() => "6\n")).toThrow(/exact semver/);
    expect(() => readPinnedInnoSetupVersion(() => "latest\n")).toThrow(/exact semver/);
  });

  it("accepts workflow wiring that reads and pins the central version", () => {
    const content = `
      - name: Install Inno Setup compiler
        shell: pwsh
        run: |
          $version = (Get-Content -Raw ".inno-setup-version").Trim()
          choco install innosetup --version="$version" --yes --no-progress
          $candidate = "${env:ProgramFiles(x86)}\\Inno Setup 6\\ISCC.exe"
`;
    expect(reviewInstallerWorkflowContent(content, "6.7.1")).toEqual([]);
  });

  it("rejects an unversioned Chocolatey install", () => {
    const content = `
      - name: Install Inno Setup compiler
        shell: pwsh
        run: choco install innosetup --yes --no-progress
`;
    expect(reviewInstallerWorkflowContent(content, "6.7.1")).toContain(
      ".github/workflows/desktop-installer.yml:4 choco innosetup harus memakai --version dari .inno-setup-version",
    );
  });

  it("rejects compiler path drift when the pinned major changes", () => {
    const content = `
      - name: Install Inno Setup compiler
        shell: pwsh
        run: |
          $version = (Get-Content -Raw ".inno-setup-version").Trim()
          choco install innosetup --version="$version" --yes --no-progress
          $candidate = "${env:ProgramFiles(x86)}\\Inno Setup 6\\ISCC.exe"
`;
    expect(reviewInstallerWorkflowContent(content, "7.0.0")).toContain(
      ".github/workflows/desktop-installer.yml: path compiler harus selaras dengan major Inno Setup 7",
    );
  });
});
