import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import {
  callOpenRouter,
  estimateOpenRouterReservationUsd,
  openRouterRuntimeModel,
} from "./openrouter.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;

const prefix = {
  systemPrompt: "Return a short answer.",
  toolDefinitions: [],
  coreMemory: { blocks: [] },
};

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

describe("OpenRouter model registry adapter", () => {
  it("maps legacy Claude and new cross-vendor identities through the registry", () => {
    expect(openRouterRuntimeModel("claude-sonnet-4-5-20250929")).toBe(
      "anthropic/claude-sonnet-4.5",
    );
    expect(openRouterRuntimeModel("gpt-5.6-terra")).toBe("openai/gpt-5.6-terra");
    expect(openRouterRuntimeModel("gpt-5.6-sol")).toBe("openai/gpt-5.6-sol");
    expect(openRouterRuntimeModel("deepseek-v3.2-exp")).toBe("deepseek/deepseek-v3.2-exp");
    expect(() => openRouterRuntimeModel("z-ai/glm-5.3")).toThrow(/belum terdaftar/u);
  });

  it("dispatches a registered DeepSeek runtime slug and keeps billed cost authoritative", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    let requestBody: Record<string, unknown> | undefined;

    agent
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, (opts) => {
        requestBody = JSON.parse(String(opts.body)) as Record<string, unknown>;
        return {
          model: "deepseek/deepseek-v3.2-exp",
          choices: [{ finish_reason: "stop", message: { content: "ok" } }],
          usage: { prompt_tokens: 20, completion_tokens: 5, cost: 0.00042 },
          openrouter_metadata: {
            endpoints: { available: [{ provider: "SiliconFlow", selected: true }] },
          },
        };
      });

    const result = await callOpenRouter({
      apiKey: "test-key",
      model: "deepseek-v3.2-exp",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
    });

    expect(requestBody?.model).toBe("deepseek/deepseek-v3.2-exp");
    expect(result.model).toBe("deepseek/deepseek-v3.2-exp");
    expect(result.routingProvider).toBe("SiliconFlow");
    expect(result.providerReportedActualUsd).toBe(0.00042);
  });

  it("keeps a conservative pre-dispatch reservation for new registry models", () => {
    const reserved = estimateOpenRouterReservationUsd({
      model: "deepseek-v3.2-exp",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
    });
    expect(reserved).toBeGreaterThan(0);
  });
});
