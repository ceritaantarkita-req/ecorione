import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { ProviderResponseError } from "./errors.js";
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

  it("fails closed with safe routing diagnostics when HTTP-success has no usable completion text", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    agent
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, {
        model: "anthropic/claude-sonnet-4.5",
        choices: [{ finish_reason: "content_filter", message: { content: "" } }],
        usage: { prompt_tokens: 120, completion_tokens: 1, cost: 0 },
        openrouter_metadata: {
          endpoints: {
            available: [
              { provider: "Amazon Bedrock", selected: false },
              { provider: "Anthropic", selected: true },
            ],
          },
          pipeline: [{ raw: "must-not-survive" }],
        },
      });

    let captured: unknown;
    try {
      await callOpenAiCompatibleHosted({
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        providerName: "OpenRouter",
        apiKey: "test-key",
        runtimeModel: "anthropic/claude-sonnet-4.5",
        costModel: "claude-sonnet-4-5-20250929",
        prefix,
        dynamicText: "fixture",
        userMessage: "reply",
        maxTokensField: "max_tokens",
        extraHeaders: { "x-openrouter-metadata": "enabled" },
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(ProviderResponseError);
    const error = captured as ProviderResponseError;
    expect(error.diagnostics).toEqual({
      responseModel: "anthropic/claude-sonnet-4.5",
      finishReason: "content_filter",
      inputTokens: 120,
      outputTokens: 1,
      routingProvider: "Anthropic",
      providerReportedActualUsd: 0,
    });
    expect(error.message).toContain("finishReason=content_filter");
    expect(error.message).toContain("routingProvider=Anthropic");
    expect(error.message).toContain("usageCostUsd=0.00000000");
    expect(error.message).not.toContain("fixture");
    expect(error.message).not.toContain("test-key");
    expect(error.message).not.toContain("must-not-survive");
  });

  it("surfaces only the selected routing provider on a usable OpenRouter completion", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    agent
      .get("https://openrouter.ai")
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, {
        model: "anthropic/claude-sonnet-4.5",
        choices: [{ finish_reason: "stop", message: { content: "ok" } }],
        usage: { prompt_tokens: 12, completion_tokens: 3, cost: 0.00123 },
        openrouter_metadata: {
          endpoints: { available: [{ provider: "Anthropic", selected: true }] },
        },
      });

    const result = await callOpenAiCompatibleHosted({
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      providerName: "OpenRouter",
      apiKey: "test-key",
      runtimeModel: "anthropic/claude-sonnet-4.5",
      costModel: "claude-sonnet-4-5-20250929",
      prefix,
      dynamicText: "fixture",
      userMessage: "reply",
      maxTokensField: "max_tokens",
      extraHeaders: { "x-openrouter-metadata": "enabled" },
    });

    expect(result.reply).toBe("ok");
    expect(result.routingProvider).toBe("Anthropic");
    expect(result.providerReportedActualUsd).toBe(0.00123);
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
    expect(result.routingProvider).toBeUndefined();
    expect(result.providerReportedActualUsd).toBeUndefined();
  });
});
