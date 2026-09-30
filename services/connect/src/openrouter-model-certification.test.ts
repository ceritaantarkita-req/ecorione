import { describe, expect, it } from "vitest";
import {
  OPENROUTER_MODEL_VALIDATION_CAP_USD,
  openRouterCertificationStatus,
  openRouterValidationPlan,
} from "./openrouter-model-certification.js";

describe("OpenRouter certification status", () => {
  it("keeps a matching fresh execution candidate in Preparing until a real call validates it", () => {
    expect(
      openRouterCertificationStatus({
        id: "qwen/qwen3.8-27b",
        admission: "verified-selectable",
        executable: false,
        promptPricePerToken: "0.0000000449",
        completionPricePerToken: "0.0000044",
      }),
    ).toBe("preparing");
  });

  it("fails closed when a candidate catalog price drifts from the admitted snapshot", () => {
    expect(
      openRouterCertificationStatus({
        id: "deepseek/deepseek-v4-pro",
        admission: "verified-selectable",
        executable: false,
        promptPricePerToken: "0.0000001",
        completionPricePerToken: "0.000001911",
      }),
    ).toBe("unavailable");
  });

  it("reports existing executable models as Ready", () => {
    expect(
      openRouterCertificationStatus({
        id: "anthropic/claude-sonnet-4.5",
        admission: "verified-executable",
        executable: true,
        promptPricePerToken: "0.000003",
        completionPricePerToken: "0.000015",
      }),
    ).toBe("ready");
  });

  it("turns catalog token prices into a bounded USD 0.07 validation plan", () => {
    const plan = openRouterValidationPlan({
      promptPricePerToken: "0.000003",
      completionPricePerToken: "0.000015",
    });

    expect(plan.capUsd).toBe(OPENROUTER_MODEL_VALIDATION_CAP_USD);
    expect(plan.maxOutputTokens).toBeGreaterThan(0);
    expect(plan.reservationUsd).toBeLessThanOrEqual(OPENROUTER_MODEL_VALIDATION_CAP_USD);
    expect(plan.inputUsdPerMTok).toBe(3);
    expect(plan.outputUsdPerMTok).toBe(15);
  });

  it("creates a zero-reservation validation plan for an explicitly free model", () => {
    expect(
      openRouterValidationPlan({
        promptPricePerToken: "0",
        completionPricePerToken: "0",
      }),
    ).toMatchObject({
      capUsd: OPENROUTER_MODEL_VALIDATION_CAP_USD,
      reservationUsd: 0,
      maxOutputTokens: 256,
    });
  });

  it("refuses a model that cannot produce even the minimum validation reply within the cap", () => {
    expect(() =>
      openRouterValidationPlan({
        promptPricePerToken: "0.000003",
        completionPricePerToken: "0.01",
      }),
    ).toThrow(/USD 0.07/u);
  });
  it("reports Ready only when stored validation evidence matches the current catalog price", () => {
    expect(
      openRouterCertificationStatus({
        id: "google/gemini-3.8-flash",
        admission: "verified-selectable",
        executable: false,
        promptPricePerToken: "0.0000005",
        completionPricePerToken: "0.0000015",
        certification: {
          modelId: "google/gemini-3.8-flash",
          promptPricePerToken: "0.0000005",
          completionPricePerToken: "0.0000015",
        },
      }),
    ).toBe("ready");
  });
});
