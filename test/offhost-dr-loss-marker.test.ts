import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(ROOT, "scripts/staging-offhost-dr-loss-marker.mjs");

describe("off-host DR loss marker", () => {
  it("creates one immutable mode-0600 recovery clock marker bound to a retained generation", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-dr-loss-marker-"));
    try {
      const output = join(dir, "loss-marker.json");
      const manifest = "ecorione-dr-20260922T000500Z-aaaaaaaaaaaa.receipt.env";
      const before = Date.now();

      const result = spawnSync(
        process.execPath,
        [SCRIPT, "--manifest-name", manifest, "--output", output],
        { cwd: ROOT, encoding: "utf8" },
      );
      const after = Date.now();

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("PASS ECORIONE off-host DR loss marker created");

      const marker = JSON.parse(readFileSync(output, "utf8"));
      expect(marker).toMatchObject({
        schemaVersion: 1,
        kind: "ecorione-offhost-dr-loss-marker",
        expectedExportManifestFilename: manifest,
        clockSource: "recovery-host-system-utc",
      });
      expect(marker.drillId).toMatch(/^[0-9a-f-]{36}$/);
      const declared = Date.parse(marker.declaredAt);
      expect(declared).toBeGreaterThanOrEqual(before);
      expect(declared).toBeLessThanOrEqual(after);
      expect(statSync(output).mode & 0o777).toBe(0o600);

      const overwrite = spawnSync(
        process.execPath,
        [SCRIPT, "--manifest-name", manifest, "--output", output],
        { cwd: ROOT, encoding: "utf8" },
      );
      expect(overwrite.status).not.toBe(0);
      expect(overwrite.stderr).toContain("refusing to overwrite existing loss marker");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects paths or unrelated filenames as the selected export manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-dr-loss-marker-invalid-"));
    try {
      const output = join(dir, "loss-marker.json");
      const result = spawnSync(
        process.execPath,
        [SCRIPT, "--manifest-name", "../ecorione-dr-test.receipt.env", "--output", output],
        { cwd: ROOT, encoding: "utf8" },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        "manifest name must be one safe export-manifest filename",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
