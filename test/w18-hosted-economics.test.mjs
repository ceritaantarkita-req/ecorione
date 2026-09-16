import { describe, expect, it } from "vitest";
import {
  assertSpendAuthorization,
  configuredSpendCeiling,
  evaluateW18Aggregate,
  evaluateW18Task,
  summaryPathFor,
  W18_EXPECTED_MODEL_CALLS,
  W18_EXPECTED_TASKS,
} from "../scripts/w18-hosted-economics.mjs";

function run({
  mode,
  pairIndex,
  cost,
  inputTokens,
  provider = "openrouter",
  settlement = "settled",
}) {
  return {
    mode,
    pairIndex,
    provider,
    model: "claude-sonnet-4-5-20250929",
    responseModel: "anthropic/claude-sonnet-4.5",
    pricingModel: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: {
      inputTokens,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    billedCostUsd: cost,
    budget: { actualUsd: cost, settlement },
    quality: { score: 1 },
  };
}

function passingTask(id = "task") {
  const fullRuns = [
    run({ mode: "full-inline", pairIndex: 1, cost: 0.01, inputTokens: 1_000 }),
    run({ mode: "full-inline", pairIndex: 2, cost: 0.011, inputTokens: 1_020 }),
  ];
  const autoRuns = [
    run({ mode: "ecx-selective-auto", pairIndex: 1, cost: 0.004, inputTokens: 420 }),
    run({ mode: "ecx-selective-auto", pairIndex: 2, cost: 0.0045, inputTokens: 430 }),
  ];
  const gate = evaluateW18Task({
    id,
    fullContextBytes: 10_000,
    autoHydratedBytes: 3_000,
    selectedRefIndexes: [0, 2],
    relevantRefIndexes: [0, 2],
    expectedRecipient: "agent:w18-hosted-economics-reviewer",
    actualRecipient: "agent:w18-hosted-economics-reviewer",
    fullRuns,
    autoRuns,
  });
  return { id, fullRuns, autoRuns, gate };
}

describe("W18 hosted economics helpers", () => {
  it("keeps evidence and summary paths distinct", () => {
    expect(summaryPathFor("C:/tmp/w18.json")).toBe("C:/tmp/w18.summary.json");
    expect(summaryPathFor("C:/tmp/w18-evidence")).toBe("C:/tmp/w18-evidence.summary.json");
  });

  it("derives the tighter durable spend ceiling", () => {
    expect(
      configuredSpendCeiling({
        ECORIONE_SPEND_DAILY_USD: "0.75",
        ECORIONE_SPEND_MONTHLY_USD: "2",
      }),
    ).toEqual({ dailyUsd: 0.75, monthlyUsd: 2, effectiveCeilingUsd: 0.75 });
  });

  it("requires explicit current-run authorization and a durable cap no looser than it", () => {
    expect(() =>
      assertSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: 1,
        configuredCeilingUsd: 0.75,
        costKillSwitch: "0",
      }),
    ).not.toThrow();

    expect(() =>
      assertSpendAuthorization({
        allowSpend: undefined,
        maxSpendUsd: 1,
        configuredCeilingUsd: 0.75,
        costKillSwitch: "0",
      }),
    ).toThrow("ECORIONE_W18_ALLOW_SPEND");

    expect(() =>
      assertSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: 0.5,
        configuredCeilingUsd: 1,
        costKillSwitch: "0",
      }),
    ).toThrow("lebih longgar");
  });

  it("passes a task only when automatic ECX preserves quality and reduces provider billed cost", () => {
    const task = passingTask();
    expect(task.gate.pass).toBe(true);
    expect(task.gate.failures).toEqual([]);
    expect(task.gate.selection.recall).toBe(1);
    expect(task.gate.autoCostUsd).toBeLessThan(task.gate.fullCostUsd);
    expect(task.gate.inputTokenReductionPct).toBeGreaterThan(0);
  });

  it("fails closed on wrong provider or non-settled billed-cost accounting", () => {
    const fullRuns = [
      run({ mode: "full-inline", pairIndex: 1, cost: 0.01, inputTokens: 1_000 }),
      run({ mode: "full-inline", pairIndex: 2, cost: 0.01, inputTokens: 1_000 }),
    ];
    const autoRuns = [
      run({
        mode: "ecx-selective-auto",
        pairIndex: 1,
        cost: 0.004,
        inputTokens: 400,
        provider: "anthropic",
      }),
      run({
        mode: "ecx-selective-auto",
        pairIndex: 2,
        cost: 0.004,
        inputTokens: 400,
        settlement: "reservation-retained",
      }),
    ];
    const gate = evaluateW18Task({
      id: "bad",
      fullContextBytes: 10_000,
      autoHydratedBytes: 3_000,
      selectedRefIndexes: [0, 2],
      relevantRefIndexes: [0, 2],
      expectedRecipient: "agent:w18-hosted-economics-reviewer",
      actualRecipient: "agent:w18-hosted-economics-reviewer",
      fullRuns,
      autoRuns,
    });

    expect(gate.pass).toBe(false);
    expect(gate.failures.some((failure) => failure.includes("provider bukan openrouter"))).toBe(
      true,
    );
    expect(gate.failures.some((failure) => failure.includes("settlement bukan settled"))).toBe(
      true,
    );
  });

  it("closes aggregate only with all five tasks, bounded spend, and lower automatic billed cost", () => {
    const tasks = Array.from({ length: W18_EXPECTED_TASKS }, (_, index) =>
      passingTask(`task-${index + 1}`),
    );
    const aggregate = evaluateW18Aggregate(tasks, 1);
    expect(aggregate.pass).toBe(true);
    expect(aggregate.measuredModelCalls).toBe(W18_EXPECTED_MODEL_CALLS);
    expect(aggregate.actualRunSpendUsd).toBeLessThan(1);
    expect(aggregate.savedPct).toBeGreaterThan(0);
  });
});
