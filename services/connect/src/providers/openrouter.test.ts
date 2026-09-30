import { describe, expect, it } from "vitest";
import { estimateOpenRouterReservationUsd, openRouterRuntimeModel } from "./openrouter.js";

const prefix = {
  systemPrompt: "Return a short answer.",
  toolDefinitions: [],
  coreMemory: { blocks: [] },
};

describe("OpenRouter model registry adapter", () => {
  it("maps the existing verified Claude identities through the registry", () => {
    expect(openRouterRuntimeModel("claude-sonnet-4-5-20250929")).toBe(
      "anthropic/claude-sonnet-4.5",
    );
    expect(openRouterRuntimeModel("claude-opus-4-1-20250805")).toBe(
      "anthropic/claude-opus-4.1",
    );
  });

  it("passes through explicit canonical runtime slugs for dynamic OpenRouter models", () => {
    expect(openRouterRuntimeModel("gpt-5.6-terra")).toBe("gpt-5.6-terra");
    expect(openRouterRuntimeModel("deepseek/deepseek-v4-pro")).toBe(
      "deepseek/deepseek-v4-pro",
    );
    expect(openRouterRuntimeModel("z-ai/glm-5.3")).toBe("z-ai/glm-5.3");
    expect(() => openRouterRuntimeModel("~deepseek/latest")).toThrow(/tidak valid/u);
  });

  it("keeps the existing conservative reservation path intact", () => {
    const reserved = estimateOpenRouterReservationUsd({
      model: "claude-sonnet-4-5-20250929",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
    });
    expect(reserved).toBeGreaterThan(0);
  });
  it("honors a bounded credential-probe output cap when reserving spend", () => {
    const normal = estimateOpenRouterReservationUsd({
      model: "claude-sonnet-4-5-20250929",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
    });
    const probe = estimateOpenRouterReservationUsd({
      model: "claude-sonnet-4-5-20250929",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
      maxOutputTokens: 512,
    });
    expect(probe).toBeLessThan(normal);
    expect(probe).toBeLessThan(0.02);
  });
});
