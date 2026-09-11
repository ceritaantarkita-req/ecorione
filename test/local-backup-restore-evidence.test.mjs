import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  backupIds,
  parseWorkerJson,
  requiredBackupGaps,
  resolveEvidencePath,
  safeRunId,
} from "../scripts/local-backup-restore-evidence-lib.mjs";

describe("local backup/restore evidence helpers", () => {
  it("allows only targets under the gitignored evidence boundary", () => {
    const repo = mkdtempSync(join(tmpdir(), "ecorione-backup-evidence-"));
    const valid = join(repo, ".ecorione/evidence/local-backup-restore/run-1/restored");
    expect(resolveEvidencePath(repo, valid)).toBe(resolve(valid));
    expect(() => resolveEvidencePath(repo, join(repo, "data"))).toThrow(/keluar boundary/u);
    expect(() => resolveEvidencePath(repo, join(repo, ".ecorione/evidence/other"))).toThrow(
      /keluar boundary/u,
    );
  });

  it("parses only the final worker JSON line and rejects invalid run ids", () => {
    expect(parseWorkerJson('noise\n{"owner":"context","status":"backed-up"}\n', "context")).toEqual(
      { owner: "context", status: "backed-up" },
    );
    expect(safeRunId("backup-20260911-a1b2c3d4")).toBe("backup-20260911-a1b2c3d4");
    expect(() => safeRunId("../escape")).toThrow(/run id tidak valid/u);
  });

  it("normalizes owner-specific manifest shapes and fails closed on required missing owners", () => {
    expect(
      backupIds("rnd", {
        manifests: {
          db: { backupId: "a".repeat(64) },
          datasets: { backupId: "b".repeat(64) },
        },
      }),
    ).toEqual({ db: "a".repeat(64), datasets: "b".repeat(64) });
    expect(
      backupIds("connect", {
        manifests: {
          state: { backupId: "c".repeat(64) },
          vaultCiphertext: null,
        },
      }),
    ).toEqual({ state: "c".repeat(64), vault: null });

    const complete = Object.fromEntries(
      ["context", "hub", "rnd", "space", "flow", "artifact", "sandbox"].map((owner) => [
        owner,
        { status: "backed-up" },
      ]),
    );
    expect(requiredBackupGaps(complete)).toEqual([]);
    complete.flow = { status: "missing" };
    expect(requiredBackupGaps(complete)).toEqual(["flow"]);
  });
});
