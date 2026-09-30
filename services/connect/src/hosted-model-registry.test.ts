import { describe, expect, it } from "vitest";
import {
  executableHostedModelIds,
  executableHostedModelRegistryEntry,
  hostedModelRegistry,
  hostedModelRegistryEntry,
  openRouterExecutionCandidates,
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
      expect(entry.pricing.costModel).not.toBeNull();
      expect(entry.id).toBe(entry.pricing.costModel);
      expect(["verified", "execution-candidate"]).toContain(entry.verification);
      expect(entry.catalogSource).toBe("static-verified");
      expect(entry.capabilities).toEqual(["text"]);
      expect(entry.providerRuntime.length).toBeGreaterThan(0);
      expect(entry.sourceProvider.length).toBeGreaterThan(0);
      expect(["gpt", "gemini", "qwen", "deepseek", "kimi", "glm", "other"]).toContain(
        entry.family,
      );
    }
  });

  it("keeps direct-provider families separate from OpenRouter candidate admission", () => {
    expect(hostedModelRegistry("openai").map((entry) => entry.family)).toEqual(["gpt", "gpt"]);
    expect(hostedModelRegistry("nvidia").map((entry) => entry.family)).toEqual(["glm"]);
    expect(
      hostedModelRegistry("openrouter")
        .filter((entry) => entry.verification === "verified")
        .map((entry) => entry.family),
    ).toEqual(["other", "other"]);
  });

  it("keeps Qwen and DeepSeek as non-executable Session 4E candidates", () => {
    expect(openRouterExecutionCandidates()).toMatchObject([
      {
        id: "qwen/qwen3.8-27b",
        providerRuntime: "qwen/qwen3.8-27b",
        family: "qwen",
        verification: "execution-candidate",
      },
      {
        id: "deepseek/deepseek-v4-pro",
        providerRuntime: "deepseek/deepseek-v4-pro",
        family: "deepseek",
        verification: "execution-candidate",
      },
    ]);
    for (const entry of openRouterExecutionCandidates()) {
      expect(executableHostedModelRegistryEntry("openrouter", entry.id)).toBeUndefined();
    }
  });

  it("uses provider-reported billing authority for every OpenRouter entry", () => {
    for (const entry of hostedModelRegistry("openrouter")) {
      expect(entry.pricing.authority).toBe("provider-reported");
      expect(entry.pricing.currency).toBe("USD");
    }
  });

  it("does not auto-admit future/cross-vendor model strings", () => {
    expect(hostedModelRegistryEntry("openrouter", "deepseek/deepseek-v3.2-exp")).toBeUndefined();
    expect(hostedModelRegistryEntry("openrouter", "gpt-5.6-terra")).toBeUndefined();
    expect(hostedModelRegistryEntry("openrouter", "z-ai/glm-5.3")).toBeUndefined();
    expect(executableHostedModelRegistryEntry("openrouter", "deepseek/deepseek-v3.2-exp")).toBeUndefined();
  });

  it("separates registered candidates from executable models", () => {
    expect(registeredHostedModelIds()).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "qwen/qwen3.8-27b",
      "deepseek/deepseek-v4-pro",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "z-ai/glm-5.3",
    ]);
    expect(executableHostedModelIds()).toEqual([
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-1-20250805",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
      "z-ai/glm-5.3",
    ]);
  });
});