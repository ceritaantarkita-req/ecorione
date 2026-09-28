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

  it("fails closed for pinned identities not yet admitted to OpenRouter", () => {
    expect(() => openRouterRuntimeModel("gpt-5.6-terra")).toThrow(/belum terdaftar/u);
    expect(() => openRouterRuntimeModel("deepseek-v3.2-exp")).toThrow(/belum terdaftar/u);
    expect(() => openRouterRuntimeModel("z-ai/glm-5.3")).toThrow(/belum terdaftar/u);
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
});
