import { describe, expect, it } from "vitest";
import { estimateOpenRouterReservationUsd } from "../services/connect/src/providers/openrouter.ts";
import {
  assertW18DiagnosticReservationWithinCap,
  buildW18DiagnosticProviderInput,
  estimateW18DiagnosticReservationUsd,
  evaluateW18DiagnosticRun,
  sanitizeW18DiagnosticFailure,
  W18DiagnosticHttpError,
} from "../scripts/w18-hosted-diagnostic.mjs";
import {
  assembleContext,
  benchmarkCacheMarker,
  FIXTURES,
} from "../scripts/comparative-evidence.mjs";

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

function diagnosticProviderInput() {
  const taskIndex = FIXTURES.findIndex((task) => task.id === "procurement-award");
  expect(taskIndex).toBeGreaterThanOrEqual(0);
  const task = FIXTURES[taskIndex];
  const marker = benchmarkCacheMarker({
    cacheNamespace: "0".repeat(32),
    taskIndex,
    pairedRunIndex: 1,
    modeIndex: 0,
  });
  return buildW18DiagnosticProviderInput({
    context: assembleContext(task.documents),
    marker,
    userMessage: task.prompt,
  });
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

  it("keeps the harness reservation estimate coupled to the production OpenRouter estimator", () => {
    const providerInput = diagnosticProviderInput();
    const harnessEstimate = estimateW18DiagnosticReservationUsd(providerInput);
    const productionEstimate = estimateOpenRouterReservationUsd(providerInput);

    expect(harnessEstimate).toBe(productionEstimate);
    expect(harnessEstimate).toBe(0.107157);
  });

  it("rejects the provider dispatch when reservation exceeds the explicit diagnostic cap", () => {
    expect(() =>
      assertW18DiagnosticReservationWithinCap({
        reservationUsd: 0.107157,
        maxSpendUsd: 0.02,
      }),
    ).toThrow(/provider call tidak dikirim/iu);

    expect(() =>
      assertW18DiagnosticReservationWithinCap({
        reservationUsd: 0.107157,
        maxSpendUsd: 0.11,
      }),
    ).not.toThrow();
  });

  it("sanitizes an upstream HTTP failure without retaining arbitrary response fields", () => {
    const error = new W18DiagnosticHttpError("http://127.0.0.1:17023/v1/complete", 502, {
      error: {
        type: "UPSTREAM_UNAVAILABLE",
        message:
          "Respons OpenRouter HTTP-success tidak membawa completion text yang dapat dipakai. diagnostic responseModel=anthropic/claude-sonnet-4.5 finishReason=content_filter inputTokens=2002 outputTokens=1 usageCostUsd=0.00000000",
        rawProviderBody: "must-not-survive",
      },
      requestId: "request-safe-id",
      secret: "must-not-survive",
    });

    expect(sanitizeW18DiagnosticFailure(error)).toEqual({
      kind: "http",
      status: 502,
      type: "UPSTREAM_UNAVAILABLE",
      message:
        "Respons OpenRouter HTTP-success tidak membawa completion text yang dapat dipakai. diagnostic responseModel=anthropic/claude-sonnet-4.5 finishReason=content_filter inputTokens=2002 outputTokens=1 usageCostUsd=0.00000000",
      requestId: "request-safe-id",
    });
  });

  it("sanitizes runtime failures into bounded diagnostic text", () => {
    const failure = sanitizeW18DiagnosticFailure(new Error("x".repeat(2_000)));
    expect(failure.kind).toBe("runtime");
    expect(failure.status).toBeNull();
    expect(failure.type).toBe("Error");
    expect(failure.message).toHaveLength(1_000);
    expect(failure.requestId).toBeNull();
  });
});
