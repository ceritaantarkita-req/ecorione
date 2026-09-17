import { describe, expect, it } from "vitest";
import { evaluateW18DiagnosticRun } from "../scripts/w18-hosted-diagnostic.mjs";

function passingRun(overrides = {}) {
  return {
    taskId: "procurement-award",
    mode: "full-inline",
    provider: "openrouter",
    responseModel: "anthropic/claude-sonnet-4.5",
    pricingModel: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: {
      inputTokens: 1_000,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    billedCostUsd: 0.006,
    budget: { actualUsd: 0.006, settlement: "settled" },
    quality: { score: 1 },
    ...overrides,
  };
}

describe("W18 one-call hosted diagnostic", () => {
  it("passes only the intended procurement-award/full-inline settled OpenRouter call", () => {
    const gate = evaluateW18DiagnosticRun(passingRun());
    expect(gate).toEqual({ pass: true, failures: [] });
  });

  it("fails closed on provider, billing, settlement, cache, or quality anomalies", () => {
    const gate = evaluateW18DiagnosticRun(
      passingRun({
        provider: "openai",
        responseModel: "",
        cacheHit: true,
        billedCostUsd: 0,
        budget: { actualUsd: null, settlement: "uncertain" },
        quality: { score: 0 },
      }),
    );

    expect(gate.pass).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        "provider bukan openrouter",
        "responseModel kosong",
        "diagnostic hit exact cache",
        "provider billed cost harus > 0",
        "durable spend settlement bukan settled",
        "budget actualUsd != provider billed cost",
        "exact extraction quality score != 1",
      ]),
    );
  });

  it("cannot be repurposed to another task or lane", () => {
    const gate = evaluateW18DiagnosticRun(
      passingRun({ taskId: "incident-triage", mode: "ecx-selective-auto" }),
    );
    expect(gate.pass).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        "diagnostic task bukan procurement-award",
        "diagnostic mode bukan full-inline",
      ]),
    );
  });
});
