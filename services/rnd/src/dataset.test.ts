import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DatasetReleaseRequest, DatasetReleasedRecord } from "@ecorione/shared-schema";
import { DatasetGovernanceError, DatasetRegistry } from "./dataset.js";

const roots: string[] = [];
function registry(): DatasetRegistry {
  const root = mkdtempSync(join(tmpdir(), "ecorione-dataset-"));
  roots.push(root);
  return new DatasetRegistry(root);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function request(): DatasetReleaseRequest {
  return {
    dataset: "routing-eval",
    schemaName: "routing-example",
    schemaVersion: "1.0.0",
    sources: [
      {
        owner: "rnd",
        kind: "trace-export",
        identity: "trace-set-001",
        digest: "a".repeat(64),
      },
    ],
    splitPolicy: { trainPercent: 70, evalPercent: 20, regressionPercent: 10 },
    records: [
      {
        id: "row-1",
        groupId: "conversation-a",
        payload: {
          text: "contact alice@example.test or +62 812 3456 7890",
          password: "do-not-release",
          score: 1,
        },
      },
      {
        id: "row-2",
        groupId: "conversation-a",
        payload: { text: "second sample", score: 2 },
      },
      {
        id: "row-3",
        payload: { text: "second sample", score: 2 },
      },
    ],
  };
}

function recordsFor(
  store: DatasetRegistry,
  releaseId: string,
): readonly DatasetReleasedRecord[] {
  const text = readFileSync(join(store.root, "releases", releaseId, "records.ndjson"), "utf8");
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as DatasetReleasedRecord);
}

describe("DatasetRegistry", () => {
  it("sanitizes, deduplicates, preserves lineage and keeps groups in one split", () => {
    const store = registry();
    const manifest = store.release(request(), "2026-09-10T02:00:00.000Z");
    const records = recordsFor(store, manifest.releaseId);

    expect(manifest.quality.inputRecords).toBe(3);
    expect(manifest.quality.uniqueRecords).toBe(2);
    expect(manifest.quality.duplicateRecordsRemoved).toBe(1);
    expect(manifest.quality.sanitation.secretFieldsRedacted).toBe(1);
    expect(manifest.quality.sanitation.emailValuesRedacted).toBe(1);
    expect(manifest.quality.sanitation.phoneValuesRedacted).toBe(1);
    expect(JSON.stringify(records)).not.toContain("do-not-release");
    expect(JSON.stringify(records)).not.toContain("alice@example.test");
    expect(JSON.stringify(records)).not.toContain("812 3456 7890");

    const grouped = records.filter((record) => record.groupId === "conversation-a");
    expect(grouped).toHaveLength(2);
    expect(new Set(grouped.map((record) => record.split)).size).toBe(1);
    expect(manifest.sources[0]?.identity).toBe("trace-set-001");
  });

  it("is immutable and idempotent for identical governed content", () => {
    const store = registry();
    const first = store.release(request(), "2026-09-10T02:00:00.000Z");
    const second = store.release(request(), "2026-09-10T03:00:00.000Z");
    expect(second).toEqual(first);
    expect(store.list("routing-eval")).toEqual([first]);
  });

  it("detects release tampering", () => {
    const store = registry();
    const manifest = store.release(request(), "2026-09-10T02:00:00.000Z");
    writeFileSync(join(store.root, "releases", manifest.releaseId, "records.ndjson"), "{}\n");
    expect(() => store.get(manifest.releaseId)).toThrow(DatasetGovernanceError);
  });

  it("fails closed on an invalid split policy", () => {
    const store = registry();
    const input = request();
    expect(() =>
      store.release(
        { ...input, splitPolicy: { trainPercent: 80, evalPercent: 10, regressionPercent: 5 } },
        "2026-09-10T02:00:00.000Z",
      ),
    ).toThrow(DatasetGovernanceError);
  });
});
