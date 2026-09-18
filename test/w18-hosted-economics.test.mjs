import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  estimateOpenRouterReservationUsd,
} from "../services/connect/src/providers/openrouter.ts";
import {
  assembleContext,
  benchmarkCacheMarker,
  FIXTURES,
} from "../scripts/comparative-evidence.mjs";
import {
  assertSpendAuthorization,
  assertW18DispatchWithinCap,
  assertW18ProviderPin,
  buildW18ProviderInput,
  configuredSpendCeiling,
  estimateW18ReservationUsd,
  evaluateW18Aggregate,
  evaluateW18Task,
  inspectDurableSpendBudget,
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
  routingProvider = "Anthropic",
  settlement = "settled",
  reservation = 0.1,
  budgetReservation = reservation,
}) {
  return {
    mode,
    pairIndex,
    provider,
    model: "claude-sonnet-4-5-20250929",
    responseModel: "anthropic/claude-sonnet-4.5",
    routingProvider,
    pricingModel: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: {
      inputTokens,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    estimatedReservationUsd: reservation,
    billedCostUsd: cost,
    budget: { reservedUsd: budgetReservation, actualUsd: cost, settlement },
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

  it("derives the tighter configured spend ceiling", () => {
    expect(
      configuredSpendCeiling({
        ECORIONE_SPEND_DAILY_USD: "0.75",
        ECORIONE_SPEND_MONTHLY_USD: "2",
      }),
    ).toEqual({ dailyUsd: 0.75, monthlyUsd: 2, effectiveCeilingUsd: 0.75 });
  });

  it("computes remaining durable headroom from settled and uncertain reservations", () => {
    const root = mkdtempSync(join(tmpdir(), "w18-spend-"));
    try {
      writeFileSync(
        join(root, "ledger.json"),
        JSON.stringify({
          version: 1,
          revision: 3,
          entries: [
            {
              reservationId: "spend_11111111111111111111111111111111",
              operationId: "op_test",
              provider: "openrouter",
              model: "claude-sonnet-4-5-20250929",
              reservedUsd: 0.1,
              actualUsd: 0.03,
              status: "settled",
              createdAt: "2026-09-17T01:00:00.000Z",
              settledAt: "2026-09-17T01:00:01.000Z",
            },
            {
              reservationId: "spend_22222222222222222222222222222222",
              operationId: "op_test",
              provider: "openrouter",
              model: "claude-sonnet-4-5-20250929",
              reservedUsd: 0.11,
              actualUsd: null,
              status: "uncertain",
              createdAt: "2026-09-17T02:00:00.000Z",
              settledAt: null,
            },
          ],
        }),
        "utf8",
      );

      const budget = inspectDurableSpendBudget(
        {
          ECORIONE_SPEND_DAILY_USD: "0.5",
          ECORIONE_SPEND_MONTHLY_USD: "2",
          ECORIONE_SPEND_BUDGET_PATH: "ledger.json",
        },
        { root, now: new Date("2026-09-17T10:00:00.000Z") },
      );

      expect(budget).toMatchObject({
        dailyUsd: 0.5,
        monthlyUsd: 2,
        effectiveCeilingUsd: 0.5,
        dailyCommittedUsd: 0.14,
        monthlyCommittedUsd: 0.14,
        unsettledReservations: 1,
        dailyHeadroomUsd: 0.36,
        effectiveHeadroomUsd: 0.36,
      });
      expect(budget.monthlyHeadroomUsd).toBeCloseTo(1.86, 12);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires explicit current-run authorization within remaining durable headroom", () => {
    expect(() =>
      assertSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: 0.25,
        durableHeadroomUsd: 0.846577,
        costKillSwitch: "0",
      }),
    ).not.toThrow();

    expect(() =>
      assertSpendAuthorization({
        allowSpend: undefined,
        maxSpendUsd: 0.25,
        durableHeadroomUsd: 0.846577,
        costKillSwitch: "0",
      }),
    ).toThrow("ECORIONE_W18_ALLOW_SPEND");

    expect(() =>
      assertSpendAuthorization({
        allowSpend: "YES",
        maxSpendUsd: 0.25,
        durableHeadroomUsd: 0.2,
        costKillSwitch: "0",
      }),
    ).toThrow("melebihi remaining durable spend headroom");
  });

  it("requires exactly the Anthropic-only OpenRouter provider pin", () => {
    expect(assertW18ProviderPin("anthropic")).toEqual(["anthropic"]);
    expect(() => assertW18ProviderPin(undefined)).toThrow(/persis anthropic/iu);
    expect(() => assertW18ProviderPin("amazon-bedrock")).toThrow(/persis anthropic/iu);
    expect(() => assertW18ProviderPin("anthropic,amazon-bedrock")).toThrow(
      /persis anthropic/iu,
    );
  });

  it(
    "keeps every formal reservation estimate coupled to the production OpenRouter estimator",
    () => {
      for (const [taskIndex, task] of FIXTURES.entries()) {
      const marker = benchmarkCacheMarker({
        cacheNamespace: "0".repeat(32),
        taskIndex,
        pairedRunIndex: 1,
        modeIndex: 0,
      });
      const providerInput = buildW18ProviderInput({
        context: assembleContext(task.documents),
        marker,
        userMessage: task.prompt,
      });
      expect(estimateW18ReservationUsd(providerInput)).toBe(
        estimateOpenRouterReservationUsd(providerInput),
      );
      }
    },
  );

  it(
    "blocks a formal provider call before dispatch when the next reservation exceeds remaining authorization",
    () => {
    expect(() =>
      assertW18DispatchWithinCap({
        actualSpentUsd: 0.1,
        reservationUsd: 0.107374,
        maxSpendUsd: 0.25,
      }),
    ).not.toThrow();

    expect(() =>
      assertW18DispatchWithinCap({
        actualSpentUsd: 0.15,
        reservationUsd: 0.107374,
        maxSpendUsd: 0.25,
      }),
    ).toThrow(/pre-dispatch guard menolak call/iu);
    },
  );

  it(
    "passes a task only when automatic ECX preserves quality and reduces provider billed cost",
    () => {
    const task = passingTask();
    expect(task.gate.pass).toBe(true);
    expect(task.gate.failures).toEqual([]);
    expect(task.gate.selection.recall).toBe(1);
    expect(task.gate.autoCostUsd).toBeLessThan(task.gate.fullCostUsd);
      expect(task.gate.inputTokenReductionPct).toBeGreaterThan(0);
    },
  );

  it(
    "fails closed on wrong provider, wrong route, reservation mismatch, or non-settled billing",
    () => {
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
        routingProvider: "Amazon Bedrock",
      }),
      run({
        mode: "ecx-selective-auto",
        pairIndex: 2,
        cost: 0.004,
        inputTokens: 400,
        settlement: "reservation-retained",
        budgetReservation: 0.2,
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
      expect(
        gate.failures.some((failure) => failure.includes("routingProvider bukan Anthropic")),
      ).toBe(true);
      expect(
        gate.failures.some((failure) => failure.includes("reservedUsd != reservation estimate")),
      ).toBe(true);
      expect(gate.failures.some((failure) => failure.includes("settlement bukan settled"))).toBe(
        true,
      );
    },
  );

  it(
    "closes aggregate only with all five tasks, bounded spend, and lower automatic billed cost",
    () => {
    const tasks = Array.from({ length: W18_EXPECTED_TASKS }, (_, index) =>
      passingTask(`task-${index + 1}`),
    );
    const aggregate = evaluateW18Aggregate(tasks, 1);
    expect(aggregate.pass).toBe(true);
    expect(aggregate.measuredModelCalls).toBe(W18_EXPECTED_MODEL_CALLS);
    expect(aggregate.actualRunSpendUsd).toBeLessThan(1);
      expect(aggregate.savedPct).toBeGreaterThan(0);
    },
  );
});
