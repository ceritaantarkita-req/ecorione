import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backupRndDatasets, restoreRndDatasets } from "./backup.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("RnD governed dataset recovery", () => {
  it("backs up and restores registry plus immutable release bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-rnd-dataset-backup-"));
    roots.push(root);
    const datasets = join(root, "datasets");
    const release = join(datasets, "releases", "release-1");
    mkdirSync(release, { recursive: true });
    writeFileSync(join(datasets, "registry.json"), "registry-before\n");
    writeFileSync(join(release, "manifest.json"), "manifest-before\n");
    writeFileSync(join(release, "records.ndjson"), "record-before\n");

    const backupRoot = join(root, "backups");
    const manifest = backupRndDatasets(datasets, backupRoot, "2026-09-10T02:10:00.000Z");

    writeFileSync(join(datasets, "registry.json"), "registry-after\n");
    const restoredRoot = join(root, "replacement", "datasets");
    const receipt = restoreRndDatasets(
      backupRoot,
      manifest.backupId,
      restoredRoot,
      "2026-09-10T02:11:00.000Z",
    );

    expect(receipt.restoredDigest).toBe(manifest.aggregateDigest);
    expect(readFileSync(join(restoredRoot, "registry.json"), "utf8")).toBe("registry-before\n");
    expect(readFileSync(join(restoredRoot, "releases", "release-1", "manifest.json"), "utf8")).toBe(
      "manifest-before\n",
    );
    expect(readFileSync(join(restoredRoot, "releases", "release-1", "records.ndjson"), "utf8")).toBe(
      "record-before\n",
    );
  });
});
