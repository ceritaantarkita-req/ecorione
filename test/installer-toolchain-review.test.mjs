import { describe, expect, it } from "vitest";
import {
  readPinnedInnoSetupVersion,
  reviewInstallerWorkflow,
} from "../scripts/installer-toolchain-review.mjs";

describe("pinned Inno Setup installer toolchain review", () => {
  it("accepts exact semver pin", () => {
    expect(readPinnedInnoSetupVersion(() => "6.7.1\n")).toBe("6.7.1");
  });

  it("rejects mutable or incomplete pin values", () => {
    expect(() => readPinnedInnoSetupVersion(() => "6\n")).toThrow(/exact semver/);
    expect(() => readPinnedInnoSetupVersion(() => "6.7\n")).toThrow(/exact semver/);
    expect(() => readPinnedInnoSetupVersion(() => "latest\n")).toThrow(/exact semver/);
  });

  it("accepts pinned installer workflow wiring", () => {
    const workflow = `
on:
  pull_request:
    paths:
      - ".inno-setup-version"
env:
  ECORIONE_VERSION: ${{ inputs.version || '0.1.0' }}
steps:
  - run: |
      $innoVersion = (Get-Content -LiteralPath ".inno-setup-version" -Raw).Trim()
      choco install innosetup --version $innoVersion --yes --no-progress
`;
    expect(reviewInstallerWorkflow(workflow)).toEqual([]);
  });

  it("rejects unpinned Chocolatey installer resolution", () => {
    const workflow = `
on:
  workflow_dispatch:
steps:
  - run: choco install innosetup --yes --no-progress
`;
    expect(reviewInstallerWorkflow(workflow)).toEqual([
      "Desktop Installer harus punya pull_request acceptance trigger",
      "Desktop Installer pull_request paths harus mencakup .inno-setup-version",
      "Desktop Installer harus membaca pin dari .inno-setup-version",
      "Inno Setup harus di-install dengan --version dari pin repository",
      "Desktop Installer tidak boleh memakai choco install innosetup tanpa --version",
      "Desktop Installer PR acceptance harus punya fallback version deterministik",
    ]);
  });
});
