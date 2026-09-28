import { describe, expect, it } from "vitest";
import {
  OPENROUTER_MODEL_FAMILY_DEFINITIONS,
  TARGET_OPENROUTER_MODEL_FAMILIES,
  classifyOpenRouterModelFamily,
  isTargetOpenRouterModelFamily,
  openRouterModelFamilyDefinition,
} from "./hosted-model-family.js";

describe("OpenRouter model-family foundation", () => {
  it("defines the six operator-requested families in stable display order", () => {
    expect(TARGET_OPENROUTER_MODEL_FAMILIES).toEqual([
      "gpt",
      "gemini",
      "qwen",
      "deepseek",
      "kimi",
      "glm",
    ]);
    expect(OPENROUTER_MODEL_FAMILY_DEFINITIONS.map((entry) => entry.displayName)).toEqual([
      "GPT",
      "Gemini",
      "Qwen",
      "DeepSeek",
      "Kimi",
      "GLM",
    ]);
  });

  it.each([
    ["~openai/gpt-terra-latest", "GPT Terra Latest", "openai", "gpt"],
    ["google/gemini-3.8-flash", "Gemini 3.8 Flash", "google", "gemini"],
    ["qwen/qwen3.8-max-0902", "Qwen3.8 Max (0902)", "qwen", "qwen"],
    ["deepseek/deepseek-v4.1-flash", "DeepSeek V4.1 Flash", "deepseek", "deepseek"],
    ["deepseek-ai/deepseek-v3", "DeepSeek V3", "deepseek-ai", "deepseek"],
    ["~moonshotai/kimi-latest", "Kimi Latest", "moonshotai", "kimi"],
    ["moonshotai/kimi-k3", "Kimi K3", "moonshotai", "kimi"],
    ["~z-ai/glm-latest", "GLM Latest", "z-ai", "glm"],
    ["z-ai/glm-5.3", "GLM 5.3", "z-ai", "glm"],
  ] as const)(
    "classifies %s as %s",
    (id, displayName, sourceProvider, expectedFamily) => {
      expect(
        classifyOpenRouterModelFamily({ id, displayName, sourceProvider }),
      ).toBe(expectedFamily);
    },
  );

  it("does not classify unrelated models just because the author namespace matches", () => {
    expect(
      classifyOpenRouterModelFamily({
        id: "google/gemma-4-31b",
        displayName: "Gemma 4 31B",
        sourceProvider: "google",
      }),
    ).toBe("other");
    expect(
      classifyOpenRouterModelFamily({
        id: "moonshotai/moonshot-v1",
        displayName: "Moonshot V1",
        sourceProvider: "moonshotai",
      }),
    ).toBe("other");
    expect(
      classifyOpenRouterModelFamily({
        id: "meta-llama/llama-4",
        displayName: "Llama 4",
        sourceProvider: "meta-llama",
      }),
    ).toBe("other");
  });

  it("keeps target-family checks and metadata lookup deterministic", () => {
    expect(isTargetOpenRouterModelFamily("gpt")).toBe(true);
    expect(isTargetOpenRouterModelFamily("other")).toBe(false);
    expect(openRouterModelFamilyDefinition("kimi")).toMatchObject({
      id: "kimi",
      displayName: "Kimi",
      sourceProviders: ["moonshotai"],
    });
  });
});
