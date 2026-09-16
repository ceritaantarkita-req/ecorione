import { describe, expect, it } from "vitest";
import {
  assertClosureRepositoryState,
  validateW17Evidence,
  W17_EXPECTED_MODES,
} from "../scripts/w17-local-closure.mjs";

function taskResult(id, overrides = {}) {
  const summaries = Object.fromEntries(
    W17_EXPECTED_MODES.map((mode) => [
      mode,
      {
        count: 5,
        qualityScoreMedian: 1,
        inputTokensMedian: mode === "full-inline" || mode === "ecx-all" ? 1000 : 400,
        outputTokensMedian: 10,
        latencyMsMedian: 100,
        modelContextBytesMedian: 4000,
        actualCostUsdTotal: 0,
        cacheHits: 0,
      },
    ]),
  );
  const runs = Object.fromEntries(
    W17_EXPECTED_MODES.map((mode) => [
      mode,
      Array.from({ length: 5 }, (_, index) => ({
        mode,
        pairedRunIndex: index + 1,
        model: "qwen3.5:9b",
        responseModel: "qwen3.5:9b",
        cacheHit: false,
      })),
    ]),
  );
  return {
    id,
    ecx: { autoSelectedRefIndexes: [0, 2] },
    summaries,
    runs,
    gates: {
      pass: true,
      measurements: { selection: { recall: 1, precision: 1, exactMatch: true } },
    },
    ...overrides,
  };
}

function validEvidence() {
  return {
    schemaVersion: 2,
    profile: {
      target: "local",
      repeats: 5,
      modes: [...W17_EXPECTED_MODES],
      oracleIndexesSuppliedToAutoLane: false,
    },
    aggregate: {
      taskCount: 5,
      measuredModelCalls: 100,
      passedTasks: 5,
      failedTasks: [],
    },
    taskResults: Array.from({ length: 5 }, (_, index) => taskResult(`task-${index + 1}`)),
  };
}

describe("W17 local closure validator", () => {
  it("accepts a complete four-lane 5x5 closure result", () => {
    expect(validateW17Evidence(validEvidence())).toEqual({
      pass: true,
      failures: [],
      modelIdentity: "qwen3.5:9b|qwen3.5:9b",
    });
  });

  it("fails if the automatic lane received oracle indexes", () => {
    const evidence = validEvidence();
    evidence.profile.oracleIndexesSuppliedToAutoLane = true;
    const result = validateW17Evidence(evidence);
    expect(result.pass).toBe(false);
    expect(result.failures).toContain("automatic lane tidak boleh menerima oracle indexes");
  });

  it("fails if selector recall or cache discipline regresses", () => {
    const evidence = validEvidence();
    evidence.taskResults[0].gates.measurements.selection.recall = 0.5;
    evidence.taskResults[0].summaries["ecx-selective-auto"].cacheHits = 1;
    const result = validateW17Evidence(evidence);
    expect(result.pass).toBe(false);
    expect(result.failures).toContain("task-1 automatic selector recall harus 1");
    expect(result.failures).toContain("task-1 ecx-selective-auto cacheHits harus 0");
  });

  it("fails if model identity changes across measured runs", () => {
    const evidence = validEvidence();
    evidence.taskResults[4].runs["ecx-selective-oracle"][4].responseModel = "other:model";
    const result = validateW17Evidence(evidence);
    expect(result.pass).toBe(false);
    expect(result.failures).toContain(
      "model identity harus stabil di seluruh 100 measured calls",
    );
  });

  it("requires a clean synchronized main checkout", () => {
    expect(() =>
      assertClosureRepositoryState({
        branch: "main",
        head: "abc",
        originMain: "abc",
        clean: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertClosureRepositoryState({
        branch: "feature",
        head: "abc",
        originMain: "def",
        clean: false,
      }),
    ).toThrow(/branch harus main.*worktree harus clean.*HEAD harus sama dengan origin\/main/u);
  });
});
