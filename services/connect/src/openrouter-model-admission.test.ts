import { describe, expect, it } from "vitest";
import {
  staleOpenRouterAdmission,
  verifyOpenRouterModelAdmission,
  type OpenRouterAdmissionCandidate,
} from "./openrouter-model-admission.js";

function candidate(
  overrides: Partial<OpenRouterAdmissionCandidate> = {},
): OpenRouterAdmissionCandidate {
  return {
    id: "qwen/qwen3.8-max",
    sourceProvider: "qwen",
    family: "qwen",
    contextWindowTokens: 1_000_000,
    inputModalities: ["text"],
    outputModalities: ["text"],
    supportedParameters: ["max_tokens", "tools"],
    promptPricePerToken: "0.000002",
    completionPricePerToken: "0.000006",
    mutableAlias: false,
    ...overrides,
  };
}

describe("OpenRouter automatic admission", () => {
  it.each([
    ["openai/gpt-6.1", "openai", "gpt"],
    ["google/gemini-3.5-pro", "google", "gemini"],
    ["qwen/qwen3.8-max", "qwen", "qwen"],
    ["deepseek/deepseek-v4", "deepseek", "deepseek"],
    ["moonshotai/kimi-k3", "moonshotai", "kimi"],
    ["z-ai/glm-5.3", "z-ai", "glm"],
  ] as const)("admits a stable %s candidate as selectable", (id, sourceProvider, family) => {
    expect(verifyOpenRouterModelAdmission(candidate({ id, sourceProvider, family }))).toEqual({
      admission: "verified-selectable",
      selectable: true,
      selectionId: id,
      unavailableReason: null,
    });
  });

  it.each([
    [{ duplicateRuntimeId: true }, "duplicate-runtime-id"],
    [{ mutableAlias: true }, "mutable-alias"],
    [{ id: "qwen qwen3.8-max" }, "invalid-runtime-slug"],
    [{ contextWindowTokens: null }, "missing-context-window"],
    [{ inputModalities: ["image"] }, "text-input-unsupported"],
    [{ outputModalities: ["image"] }, "text-output-unsupported"],
    [{ supportedParameters: ["tools"] }, "max-tokens-unsupported"],
    [{ promptPricePerToken: null }, "missing-pricing"],
    [{ completionPricePerToken: "tidak-angka" }, "invalid-pricing"],
  ] as const)("fails closed with %s", (overrides, unavailableReason) => {
    expect(
      verifyOpenRouterModelAdmission(
        candidate(overrides as Partial<OpenRouterAdmissionCandidate>),
      ),
    ).toMatchObject({
      admission: "unavailable",
      selectable: false,
      selectionId: null,
      unavailableReason,
    });
  });

  it("admits a free text model when the catalog explicitly prices both sides at zero", () => {
    expect(
      verifyOpenRouterModelAdmission(
        candidate({ promptPricePerToken: "0", completionPricePerToken: "0" }),
      ),
    ).toMatchObject({
      admission: "verified-selectable",
      selectable: true,
      unavailableReason: null,
    });
  });

  it("admits a stable text model outside the named six families for explicit validation", () => {
    expect(
      verifyOpenRouterModelAdmission(
        candidate({
          id: "perplexity/sonar-pro",
          sourceProvider: "perplexity",
          family: "other",
        }),
      ),
    ).toEqual({
      admission: "verified-selectable",
      selectable: true,
      selectionId: "perplexity/sonar-pro",
      unavailableReason: null,
    });
  });

  it("withdraws dynamic selectability when only stale catalog evidence remains", () => {
    expect(staleOpenRouterAdmission()).toEqual({
      admission: "unavailable",
      selectable: false,
      selectionId: null,
      unavailableReason: "stale-catalog",
    });
  });
});
