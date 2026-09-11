import { describe, expect, it } from "vitest";
import {
  assembleContext,
  benchmarkCacheMarker,
  evaluateTaskGates,
  extractJsonObject,
  FIXTURES,
  median,
  scoreReply,
  summarizeRuns,
} from "../scripts/comparative-evidence.mjs";

function run({
  mode,
  inputTokens,
  latencyMs,
  quality = 1,
  cacheHit = false,
  model = "gemma4:immutable-test",
  responseModel = "gemma4:immutable-test",
}) {
  return {
    mode,
    cacheHit,
    model,
    responseModel,
    latencyMs,
    modelContextBytes: inputTokens * 4,
    usage: {
      inputTokens,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    cost: { actualUsd: 0 },
    quality: { score: quality },
  };
}

describe("comparative evidence helpers", () => {
  it("computes a deterministic median", () => {
    expect(median([9, 1, 4])).toBe(4);
    expect(median([10, 2, 8, 4])).toBe(6);
    expect(median([])).toBe(0);
  });

  it("extracts and scores the requested JSON fields", () => {
    expect(extractJsonObject('prefix {"answer":"yes","count":2} suffix')).toEqual({
      answer: "yes",
      count: 2,
    });
    expect(scoreReply('{"answer":"yes","count":2}', { answer: "yes", count: 2 })).toMatchObject(
      {
        score: 1,
        matched: 2,
        total: 2,
      },
    );
    expect(scoreReply("not json", { answer: "yes" }).score).toBe(0);
  });

  it("assembles fixture documents in stable order", () => {
    expect(
      assembleContext([
        { id: "a", content: "alpha" },
        { id: "b", content: "beta" },
      ]),
    ).toBe("alpha\n\n---\n\nbeta");
  });

  it("keeps release exact-match values delimiter-safe", () => {
    const task = FIXTURES.find((fixture) => fixture.id === "release-readiness");
    expect(task).toBeDefined();

    const releaseIdDocument = task.documents.find(
      (document) => document.id === "release-id",
    );
    const blockerDocument = task.documents.find(
      (document) => document.id === "release-blocker",
    );

    expect(releaseIdDocument.content).toContain("Release ID: R2026.09.11\n");
    expect(releaseIdDocument.content).not.toContain("Release ID: R2026.09.11.\n");
    expect(blockerDocument.content).toContain(
      "Only open blocker: DB-188 migration checksum mismatch\n",
    );
    expect(blockerDocument.content).not.toContain(
      "Only open blocker: DB-188 migration checksum mismatch.\n",
    );
  });

  it("isolates cache markers across invocations while keeping paired marker shape stable", () => {
    const first = benchmarkCacheMarker({
      cacheNamespace: "a".repeat(32),
      taskIndex: 0,
      pairedRunIndex: 1,
      modeIndex: 0,
    });
    const secondMode = benchmarkCacheMarker({
      cacheNamespace: "a".repeat(32),
      taskIndex: 0,
      pairedRunIndex: 1,
      modeIndex: 1,
    });
    const nextInvocation = benchmarkCacheMarker({
      cacheNamespace: "b".repeat(32),
      taskIndex: 0,
      pairedRunIndex: 1,
      modeIndex: 0,
    });

    expect(first).not.toBe(secondMode);
    expect(first.length).toBe(secondMode.length);
    expect(first).not.toBe(nextInvocation);
    expect(first).toContain("a".repeat(32));
    expect(nextInvocation).toContain("b".repeat(32));
  });

  it("passes predeclared gates when selective hydration reduces bytes and tokens", () => {
    const byMode = {
      "full-inline": [run({ mode: "full-inline", inputTokens: 1000, latencyMs: 1000 })],
      "ecx-all": [run({ mode: "ecx-all", inputTokens: 1010, latencyMs: 980 })],
      "ecx-selective-oracle": [
        run({ mode: "ecx-selective-oracle", inputTokens: 400, latencyMs: 800 }),
      ],
    };
    const summaries = Object.fromEntries(
      Object.entries(byMode).map(([mode, runs]) => [mode, summarizeRuns(runs)]),
    );
    const gates = evaluateTaskGates({
      fullContextBytes: 10_000,
      packetBytes: 500,
      ecxAllHydratedBytes: 9_500,
      selectiveHydratedBytes: 3_000,
      summaries,
      allRuns: Object.values(byMode).flat(),
      expectedRecipient: "agent:reviewer",
      actualRecipient: "agent:reviewer",
    });

    expect(gates.pass).toBe(true);
    expect(gates.failures).toEqual([]);
    expect(gates.measurements.transportReductionPct).toBe(65);
    expect(gates.measurements.inputTokenReductionPct).toBe(60);
  });

  it("fails when a measured lane is cached or loses required quality", () => {
    const byMode = {
      "full-inline": [run({ mode: "full-inline", inputTokens: 1000, latencyMs: 1000 })],
      "ecx-all": [run({ mode: "ecx-all", inputTokens: 1000, latencyMs: 1000, cacheHit: true })],
      "ecx-selective-oracle": [
        run({
          mode: "ecx-selective-oracle",
          inputTokens: 400,
          latencyMs: 800,
          quality: 2 / 3,
        }),
      ],
    };
    const summaries = Object.fromEntries(
      Object.entries(byMode).map(([mode, runs]) => [mode, summarizeRuns(runs)]),
    );
    const gates = evaluateTaskGates({
      fullContextBytes: 10_000,
      packetBytes: 500,
      ecxAllHydratedBytes: 9_500,
      selectiveHydratedBytes: 3_000,
      summaries,
      allRuns: Object.values(byMode).flat(),
      expectedRecipient: "agent:reviewer",
      actualRecipient: "agent:reviewer",
    });

    expect(gates.pass).toBe(false);
    expect(gates.failures).toContain("measured run hit exact cache");
    expect(gates.failures).toContain("ecx-selective-oracle median quality < 1");
  });
});
