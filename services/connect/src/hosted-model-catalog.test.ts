import { describe, expect, it } from "vitest";
import {
  GOVERNED_HOSTED_MODEL,
  HostedModelPreferenceSchema,
  SELECTABLE_HOSTED_MODEL_IDS,
  hostedModelCatalog,
  hostedModelCatalogEntry,
  hostedModelSupported,
} from "./hosted-model-catalog.js";

describe("hosted model catalog", () => {
  it("exposes only currently verified provider/model pairs from the registry", () => {
    expect(hostedModelCatalog("openrouter").map((model) => model.id)).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
    ]);
    expect(hostedModelCatalog("openai").map((model) => model.id)).toEqual([
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ]);
    expect(hostedModelCatalog("nvidia").map((model) => model.id)).toEqual(["z-ai/glm-5.3"]);
  });

  it("keeps the preference shape extensible while execution stays registry-gated", () => {
    expect(HostedModelPreferenceSchema.parse("deepseek/deepseek-v3.2-exp")).toBe(
      "deepseek/deepseek-v3.2-exp",
    );
    expect(hostedModelSupported("openrouter", GOVERNED_HOSTED_MODEL)).toBe(true);
    expect(hostedModelSupported("openrouter", "claude-sonnet-4-5-20250929")).toBe(true);
    expect(hostedModelSupported("openrouter", "deepseek/deepseek-v3.2-exp")).toBe(false);
    expect(hostedModelSupported("openrouter", "gpt-5.6-terra")).toBe(false);
    expect(hostedModelSupported("openrouter", "z-ai/glm-5.3")).toBe(false);
  });

  it("surfaces registry metadata required by later discovery/add-model sessions", () => {
    expect(hostedModelCatalogEntry("openrouter", "claude-sonnet-4-5-20250929")).toMatchObject({
      provider: "openrouter",
      id: "claude-sonnet-4-5-20250929",
      displayName: "Claude Sonnet 4.5",
      providerRuntime: "anthropic/claude-sonnet-4.5",
      sourceProvider: "anthropic",
      contextWindowTokens: 1_000_000,
      capabilities: ["text", "tools", "reasoning"],
      pricing: {
        costModel: "claude-sonnet-4-5-20250929",
        authority: "provider-reported",
        currency: "USD",
      },
      verification: "verified",
      catalogSource: "static-verified",
      verifiedAt: "2026-09-28",
    });
    expect(SELECTABLE_HOSTED_MODEL_IDS).not.toContain("deepseek-v3.2-exp");
  });
});
