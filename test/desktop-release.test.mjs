import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildBundleLayout,
  checksumManifest,
  chooseSourceRevision,
  normalizeSpawnOutput,
  normalizeVersion,
  stageDesktopSurface,
  writeReleaseMetadata,
} from "../scripts/desktop-bundle.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ecorione-desktop-release-"));
  roots.push(root);
  return root;
}

describe("ECORIONE desktop release bundle", () => {
  it("uses a versioned bundle name while keeping the launcher-compatible runtime image tag", () => {
    const layout = buildBundleLayout({ version: "0.1.0", outRoot: tempRoot() });
    expect(layout.bundleName).toBe("ECORIONE-0.1.0-windows-x64");
    expect(layout.imageTag).toBe("ecorione:desktop");
    expect(layout.imageTar.endsWith("runtime/ecorione-image.tar")).toBe(true);
  });

  it("rejects unsafe version strings before they become filesystem paths or image metadata", () => {
    expect(() => normalizeVersion("../release")).toThrow(/version/i);
    expect(() => normalizeVersion("v1 bad")).toThrow(/version/i);
    expect(normalizeVersion("0.1.0-rc.1")).toBe("0.1.0-rc.1");
  });

  it("normalizes spawn output when inherited stdio returns null instead of text", () => {
    expect(normalizeSpawnOutput("  ready\n")).toBe("ready");
    expect(normalizeSpawnOutput(null)).toBe("");
    expect(normalizeSpawnOutput(undefined)).toBe("");
  });

  it("records the checked-out HEAD instead of the workflow trigger SHA", () => {
    expect(chooseSourceRevision(" checked-out-head\n", "workflow-trigger-sha")).toBe(
      "checked-out-head",
    );
    expect(chooseSourceRevision("", " workflow-trigger-sha ")).toBe("workflow-trigger-sha");
    expect(chooseSourceRevision("", "")).toBe("unknown");
  });

  it("stages only the canonical user-facing desktop surface and license", () => {
    const root = tempRoot();
    const layout = buildBundleLayout({ version: "0.1.0", outRoot: root });
    mkdirSync(layout.runtimeDir, { recursive: true });
    stageDesktopSurface(layout.bundleRoot);

    const launcher = readFileSync(join(layout.bundleRoot, "ecorione.ps1"), "utf8");
    const compose = readFileSync(join(layout.bundleRoot, "compose.yml"), "utf8");
    const license = readFileSync(join(layout.bundleRoot, "LICENSE"), "utf8");

    expect(launcher).toContain("ECORIONE_DESKTOP_IMAGE=ecorione:desktop");
    expect(compose).toContain("ECORIONE_DESKTOP_IMAGE");
    expect(license.length).toBeGreaterThan(100);
    expect(existsSync(join(layout.bundleRoot, "installer.iss"))).toBe(false);
  });

  it("writes release metadata and SHA-256 coverage for every staged artifact including runtime image", () => {
    const root = tempRoot();
    const layout = buildBundleLayout({ version: "0.1.0", outRoot: root });
    mkdirSync(layout.runtimeDir, { recursive: true });
    stageDesktopSurface(layout.bundleRoot);
    writeFileSync(layout.imageTar, "fake-image-tar-for-contract-test");

    const metadata = writeReleaseMetadata(layout, "0123456789abcdef");
    const sums = readFileSync(join(layout.bundleRoot, "SHA256SUMS"), "utf8");
    const recomputed = checksumManifest(layout.bundleRoot);

    expect(metadata).toMatchObject({
      schemaVersion: 1,
      product: "ECORIONE",
      version: "0.1.0",
      platform: "windows-x64",
      runtime: "docker-desktop",
      image: "ecorione:desktop",
      sourceRevision: "0123456789abcdef",
    });
    expect(sums).toContain("runtime/ecorione-image.tar");
    expect(sums).toContain("RELEASE-MANIFEST.json");
    expect(sums).toContain("ecorione.ps1");
    expect(sums.trim()).toBe(recomputed);
    expect(sums).toMatch(/^[a-f0-9]{64} {2}/m);
  });
});
