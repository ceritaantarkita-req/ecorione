import { describe, expect, it } from "vitest";
import {
  evaluateRoundTripCase,
  evaluateRoundTripEvidence,
} from "../scripts/ecx-round-trip-b5-evidence.mjs";

function completion(reply, inputTokens, outputTokens, actualUsd) {
  return {
    reply,
    provider: "local",
    model: "qwen-b5-test",
    responseModel: "qwen-b5-test",
    modelIdentity: "local:test:qwen-b5-test",
    modelIdentityPinned: true,
    cacheHit: false,
    usage: {
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    cost: {
      model: "local/provider-token-zero",
      actualUsd,
      naiveUsd: actualUsd,
      savedUsd: 0,
      savedPct: 0,
      routeReason: "local-consolidation",
      policyVersion: "3",
      optimizerOverheadMs: 0,
    },
    routeReason: "local-consolidation",
  };
}

describe("ECX Batch 5 deterministic quality/economics evidence", () => {
  const measuredResponse = {
    state: "SUCCEEDED",
    replayed: false,
    responseMode: "delta",
    child: {
      target: "local",
      hydratedBytes: 240,
      completion: completion('{"source":"child"}', 12, 4, 0.002),
    },
    returnedResult: { evidence: { replyBytes: 18 } },
    handback: {
      finalReply: '{"answer":"EXPECTED"}',
      parentTarget: "local",
      parentCompletion: completion('{"answer":"EXPECTED"}', 8, 3, 0.003),
    },
  };

  it("passes exact quality while reporting observed economics without a savings claim", () => {
    const result = evaluateRoundTripCase({
      id: "b5-pass",
      response: measuredResponse,
      expected: { answer: "EXPECTED" },
      durationMs: 25,
    });
    expect(result.pass).toBe(true);
    expect(result.quality.score).toBe(1);
    expect(result.economics).toMatchObject({
      modelCalls: 2,
      inputTokens: 20,
      outputTokens: 7,
      actualCostUsd: 0.005,
    });

    const aggregate = evaluateRoundTripEvidence([
      {
        id: "b5-pass",
        response: measuredResponse,
        expected: { answer: "EXPECTED" },
        durationMs: 25,
      },
    ]);
    expect(aggregate.pass).toBe(true);
    expect(aggregate.quality.exactPassRate).toBe(1);
    expect(aggregate.economics.actualCostUsd).toBeCloseTo(0.005, 12);
    expect(aggregate.claimBoundary).toContain("does not establish");
    expect(JSON.stringify(aggregate)).not.toContain('"savedUsd"');
    expect(JSON.stringify(aggregate)).not.toContain('"savedPct"');
  });

  it("fails closed on wrong answer or missing pinned identity/economics telemetry", () => {
    const bad = JSON.parse(JSON.stringify(measuredResponse));
    bad.handback.finalReply = '{"answer":"WRONG"}';
    bad.handback.parentCompletion.modelIdentityPinned = false;
    delete bad.handback.parentCompletion.cost;
    const result = evaluateRoundTripCase({
      id: "b5-fail",
      response: bad,
      expected: { answer: "EXPECTED" },
    });
    expect(result.pass).toBe(false);
    expect(result.failures).toContain("final quality score 0 < 1");
    expect(result.failures).toContain("parent model identity is not pinned");
    expect(result.failures).toContain("parent actual cost telemetry missing or invalid");
  });
});
