import { describe, expect, it } from "vitest";
import {
  assertW18DiagnosticSpendAuthorization,
  diagnosticTask,
  evaluateW18DiagnosticRun,
  W18_DIAGNOSTIC_ABSOLUTE_MAX_USD,
  W18_DIAGNOSTIC_MODE,
  W18_DIAGNOSTIC_MODEL_CALLS,
  W18_DIAGNOSTIC_TASK_ID,
} from "../scripts/w18-hosted-diagnostic.mjs";

function passingRun(overrides = {}) {
  return {
    taskId: W18_DIAGNOSTIC_TASK_ID,
    mode: W18_DIAGNOSTIC_MODE,
    provider: "openrouter",
    responseModel: "anthropic/claude-sonnet-4.5",
    pricingModel: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: {
      inputTokens: 1_884,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    billedCostUsd: 0.006,
    budget: {
      actualUsd: 0.006,
      settlement: "settled",
    },
    quality: { score: 1 },
    ...overrides,
  };
}

describe("W18 one-call diagnostic helpers", () => {
  it("pins the diagnostic to procurement-award/full-inline and exactly one hosted call", () => {
    const { task } = diagnosticTask();
    expect(task.id).toBe("procurement-award");
    expect(W18_DIAGNOSTIC_TASK_ID).toBe("procurement-award");
    expect(W18_DIAGNOSTIC_MODE).toBe("full-inline");
    expect(W18_DIAGNOSTIC_MODEL_CALLS).toBe(1);
  });

  it("requires a separate explicit diagnostic spend authorization", () => {
    expect(() =>
      assertW18DiagnosticSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: 0.15,
        durableHeadroomUsd: 0.8,
        costKillSwitch: "0",
      }),
    ).not.toThrow();

    expect(() =>
      assertW18DiagnosticSpendAuthorization({
        allowSpend: undefined,
        maxSpendUsd: 0.15,
        durableHeadroomUsd: 0.8,
        costKillSwitch: "0",
      }),
    ).toThrow("ECORIONE_W18_DIAGNOSTIC_ALLOW_SPEND");

    expect(() =>
      assertW18DiagnosticSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: W18_DIAGNOSTIC_ABSOLUTE_MAX_USD + 0.01,
        durableHeadroomUsd: 0.8,
        costKillSwitch: "0",
      }),
    ).toThrow("diagnostic safety ceiling");

    expect(() =>
      assertW18DiagnosticSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: 0.15,
        durableHeadroomUsd: 0.1,
        costKillSwitch: "0",
      }),
    ).toThrow("remaining durable spend headroom");
  });

  it("passes only with usable quality and settled provider-reported billing", () => {
    expect(evaluateW18DiagnosticRun(passingRun())).toEqual({ pass: true, failures: [] });

    const bad = evaluateW18DiagnosticRun(
      passingRun({
        billedCostUsd: 0,
        budget: { actualUsd: 0, settlement: "reservation-retained" },
        quality: { score: 0 },
      }),
    );
    expect(bad.pass).toBe(false);
    expect(bad.failures).toContain("quality score != 1");
    expect(bad.failures).toContain("provider billed cost harus > 0");
    expect(bad.failures).toContain("durable spend settlement bukan settled");
  });

  it("fails closed when provider identity or billed-cost settlement disagrees", () => {
    const gate = evaluateW18DiagnosticRun(
      passingRun({
        provider: "openai",
        pricingModel: "gpt-5-mini-2025-08-07",
        billedCostUsd: 0.006,
        budget: { actualUsd: 0.005, settlement: "settled" },
      }),
    );
    expect(gate.pass).toBe(false);
    expect(gate.failures).toContain("provider bukan openrouter");
    expect(gate.failures).toContain("pricingModel tidak pinned ke W18 model");
    expect(gate.failures).toContain("budget actualUsd != billed cost");

    const missingActual = evaluateW18DiagnosticRun(
      passingRun({ budget: { settlement: "settled" } }),
    );
    expect(missingActual.pass).toBe(false);
    expect(missingActual.failures).toContain("budget actualUsd tidak valid");
  });
});
