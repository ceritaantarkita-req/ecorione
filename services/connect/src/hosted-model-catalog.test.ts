import { describe, expect, it } from "vitest";
import {
  GOVERNED_HOSTED_MODEL,
  SELECTABLE_HOSTED_MODEL_IDS,
  hostedModelCatalog,
  hostedModelCatalogEntry,
  hostedModelSupported,
} from "./hosted-model-catalog.js";

describe("hosted model catalog", () => {
  it("exposes verified provider/model pairs from the registry", () => {
    expect(hostedModelCatalog("openrouter").map((model) => model.id)).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "deepseek-v3.2-exp",
    ]);
    expect(hostedModelCatalog("openai").map((model) => model.id)).toEqual([
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ]);
    expect(hostedModelCatalog("nvidia").map((model) => model.id)).toEqual(["z-ai/glm-5.3"]);
  });

  it("keeps governed routing and fails closed on unregistered provider/model pairs", () => {
    expect(hostedModelSupported("openrouter", GOVERNED_HOSTED_MODEL)).toBe(true);
    expect(hostedModelSupported("openrouter", "claude-sonnet-4-5-20250929")).toBe(true);
    expect(hostedModelSupported("openrouter", "gpt-5.6-terra")).toBe(true);
    expect(hostedModelSupported("openrouter", "deepseek-v3.2-exp")).toBe(true);
    expect(hostedModelSupported("openrouter", "z-ai/glm-5.3")).toBe(false);
    expect(hostedModelSupported("openai", "claude-sonnet-4-5-20250929")).toBe(false);
    expect(hostedModelSupported("nvidia", GOVERNED_HOSTED_MODEL)).toBe(true);
    expect(hostedModelSupported("nvidia", "z-ai/glm-5.3")).toBe(true);
    expect(hostedModelSupported("nvidia", "gpt-5.6-terra")).toBe(false);
  });

  it("surfaces registry metadata needed by later discovery/add-model sessions", () => {
    expect(hostedModelCatalogEntry("openrouter", "deepseek-v3.2-exp")).toMatchObject({
      provider: "openrouter",
      id: "deepseek-v3.2-exp",
      displayName: "DeepSeek V3.2 Exp",
      providerRuntime: "deepseek/deepseek-v3.2-exp",
      sourceProvider: "deepseek",
      contextWindowTokens: 163_840,
      capabilities: ["text", "tools", "reasoning"],
      pricing: {
        costModel: "deepseek-v3.2-exp",
        authority: "provider-reported",
        currency: "USD",
      },
      verification: "verified",
    });
    expect(SELECTABLE_HOSTED_MODEL_IDS).toContain("deepseek-v3.2-exp");
  });
});
