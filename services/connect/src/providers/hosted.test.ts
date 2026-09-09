import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { callHostedProvider, estimateHostedReservationUsd } from "./hosted.js";
import { openAiRuntimeModel } from "./openai.js";
import { openRouterRuntimeModel } from "./openrouter.js";
import { prefix } from "../test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let openrouterPool: Interceptable;
let openaiPool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  openrouterPool = agent.get("https://openrouter.ai");
  openaiPool = agent.get("https://api.openai.com");
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

const base = {
  prefix: prefix(),
  dynamicText: "context",
  userMessage: "halo",
};

describe("hosted provider adapters", () => {
  it("OpenRouter memakai bearer key + canonical Claude slug dan membaca cached usage", async () => {
    openrouterPool
      .intercept({ path: "/api/v1/chat/completions", method: "POST" })
      .reply(200, {
        model: "anthropic/claude-sonnet-4.5",
        choices: [{ message: { content: "via router" } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          prompt_tokens_details: { cached_tokens: 40 },
        },
      });

    const result = await callHostedProvider({
      provider: "openrouter",
      apiKey: "router-test-key",
      model: "claude-sonnet-4-5-20250929",
      ...base,
    });
    expect(openRouterRuntimeModel("claude-sonnet-4-5-20250929")).toBe(
      "anthropic/claude-sonnet-4.5",
    );
    expect(result.reply).toBe("via router");
    expect(result.usage).toEqual({
      inputTokens: 60,
      outputTokens: 20,
      cacheReadTokens: 40,
      cacheWriteTokens: 0,
    });
  });

  it("OpenAI memakai explicit pinned model identity tanpa alias", async () => {
    openaiPool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, {
      model: "gpt-5.6-terra",
      choices: [{ message: { content: "via openai" } }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    });

    const result = await callHostedProvider({
      provider: "openai",
      apiKey: "openai-test-key",
      model: "gpt-5.6-terra",
      ...base,
    });
    expect(openAiRuntimeModel("gpt-5.6-terra")).toBe("gpt-5.6-terra");
    expect(result.reply).toBe("via openai");
    expect(result.usage.inputTokens).toBe(50);
  });

  it("reservation provider-aware tetap positif untuk seluruh hosted provider", () => {
    expect(
      estimateHostedReservationUsd("anthropic", {
        model: "claude-sonnet-4-5-20250929",
        ...base,
      }),
    ).toBeGreaterThan(0);
    expect(
      estimateHostedReservationUsd("openrouter", {
        model: "claude-sonnet-4-5-20250929",
        ...base,
      }),
    ).toBeGreaterThan(0);
    expect(
      estimateHostedReservationUsd("openai", { model: "gpt-5.6-terra", ...base }),
    ).toBeGreaterThan(0);
  });

  it("unsupported provider/model mapping gagal eksplisit", () => {
    expect(() => openRouterRuntimeModel("gpt-5.6-terra")).toThrow(/mapping OpenRouter/);
    expect(() => openAiRuntimeModel("claude-sonnet-4-5-20250929")).toThrow(/mapping OpenAI/);
  });
});
