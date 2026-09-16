import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { callOpenAiCompatibleHosted } from "./openai-compatible.js";

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

describe("OpenAI-compatible billed-cost authority", () => {
  it("fails closed when OpenRouter omits usage.cost", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    agent
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, {
        model: "anthropic/claude-sonnet-4.5",
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      });

    await expect(
      callOpenAiCompatibleHosted({
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        providerName: "OpenRouter",
        apiKey: "test-key",
        runtimeModel: "anthropic/claude-sonnet-4.5",
        costModel: "claude-sonnet-4-5-20250929",
        prefix,
        dynamicText: "fixture",
        userMessage: "reply",
        maxTokensField: "max_tokens",
      }),
    ).rejects.toThrow("usage.cost");
  });

  it("retains pricing-snapshot fallback for direct OpenAI when cost is not reported", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    agent
      .get("https://api.openai.com")
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, {
        model: "gpt-5.6-terra",
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      });

    const result = await callOpenAiCompatibleHosted({
      endpoint: "https://api.openai.com/v1/chat/completions",
      providerName: "OpenAI",
      apiKey: "test-key",
      runtimeModel: "gpt-5.6-terra",
      costModel: "gpt-5.6-terra",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
      maxTokensField: "max_completion_tokens",
    });

    expect(result.reply).toBe("ok");
    expect(result.providerReportedActualUsd).toBeUndefined();
  });
});
