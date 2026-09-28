import { describe, expect, it } from "vitest";
import {
  hostedModelRegistry,
  hostedModelRegistryEntry,
  registeredHostedModelIds,
} from "./hosted-model-registry.js";

describe("hosted model registry", () => {
  it("keeps provider/model keys unique and pricing identity aligned", () => {
    const entries = [
      ...hostedModelRegistry("anthropic"),
      ...hostedModelRegistry("openrouter"),
      ...hostedModelRegistry("openai"),
      ...hostedModelRegistry("nvidia"),
    ];
    const keys = entries.map((entry) => `${entry.provider}:${entry.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of entries) {
      expect(entry.id).toBe(entry.pricing.costModel);
      expect(entry.verification).toBe("verified");
      expect(entry.catalogSource).toBe("static-verified");
      expect(entry.verifiedAt).toBe("2026-09-28");
      expect(entry.capabilities).toContain("text");
      expect(entry.providerRuntime.length).toBeGreaterThan(0);
      expect(entry.sourceProvider.length).toBeGreaterThan(0);
    }
  });

  it("admits cross-vendor OpenRouter models without changing direct-provider catalogs", () => {
    expect(hostedModelRegistry("openrouter").map((entry) => entry.sourceProvider)).toEqual([
      "anthropic",
      "anthropic",
      "openai",
      "openai",
      "deepseek",
    ]);
    expect(hostedModelRegistry("anthropic").map((entry) => entry.id)).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
    ]);
    expect(hostedModelRegistry("openai").map((entry) => entry.id)).toEqual([
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ]);
  });

  it("uses provider-reported billing authority for every OpenRouter entry", () => {
    for (const entry of hostedModelRegistry("openrouter")) {
      expect(entry.pricing.authority).toBe("provider-reported");
      expect(entry.pricing.currency).toBe("USD");
    }
  });

  it("returns undefined for an unregistered provider/model pair", () => {
    expect(hostedModelRegistryEntry("openrouter", "z-ai/glm-5.3")).toBeUndefined();
    expect(hostedModelRegistryEntry("nvidia", "deepseek-v3.2-exp")).toBeUndefined();
  });

  it("publishes the unique admitted hosted pricing identities", () => {
    expect(registeredHostedModelIds()).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "deepseek-v3.2-exp",
      "z-ai/glm-5.3",
    ]);
  });
});
