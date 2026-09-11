import { describe, expect, it } from "vitest";
import {
  assembleContext,
  evaluateTaskGates,
  extractJsonObject,
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
