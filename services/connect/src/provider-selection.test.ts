import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { ExactMatchCache } from "./cache.js";
import { complete, type CompleteDeps } from "./complete.js";
import { NOW, OPERATION_ID, prefix } from "./test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let openrouterPool: Interceptable;
let openaiPool: Interceptable;
let localPool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  openrouterPool = agent.get("https://openrouter.ai");
  openaiPool = agent.get("https://api.openai.com");
  localPool = agent.get("http://127.0.0.1:11434");
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

function deps(overrides: Partial<CompleteDeps>): CompleteDeps {
  return {
    anthropicApiKey: undefined,
    localBaseUrl: "http://127.0.0.1:11434/v1",
    localModelTag: "qwen3:8b-instruct-q4_K_M",
    cache: new ExactMatchCache(),
    hostedCallsEnabled: true,
    ...overrides,
  };
}

const input = {
  target: "hosted" as const,
  prefix: prefix(),
  dynamicText: "",
  userMessage: "halo",
  sensitivity: "INTERNAL" as const,
  operationId: OPERATION_ID,
  now: NOW,
};

describe("provider selection", () => {
  it("OpenRouter API key benar-benar dipakai oleh completion pipeline", async () => {
    openrouterPool.intercept({ path: "/api/v1/chat/completions", method: "POST" }).reply(200, {
      model: "anthropic/claude-sonnet-4.5",
      choices: [{ message: { content: "router reply" } }],
      usage: { prompt_tokens: 20, completion_tokens: 4 },
    });
    let reservedProvider: string | undefined;
    const result = await complete(
      deps({
        hostedProvider: "openrouter",
        openrouterApiKey: "router-dev-key",
        spendBudget: {
          reserve(value) {
            reservedProvider = value.provider;
            return {
              reservationId: "spend_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              operationId: value.operationId,
              provider: value.provider,
              model: value.model,
              reservedUsd: value.reservedUsd,
              actualUsd: null,
              status: "reserved",
              createdAt: value.now,
              settledAt: null,
            };
          },
          settle(_id, actualUsd) {
            return {
              reservationId: "spend_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              operationId: OPERATION_ID,
              provider: "openrouter",
              model: "claude-sonnet-4-5-20250929",
              reservedUsd: 1,
              actualUsd,
              status: "settled",
              createdAt: NOW,
              settledAt: NOW,
            };
          },
          markUncertain() {
            throw new Error("must not run");
          },
        },
      }),
      input,
    );
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe("claude-sonnet-4-5-20250929");
    expect(result.reply).toBe("router reply");
    expect(reservedProvider).toBe("openrouter");
  });

  it("OpenAI routes normal hosted traffic to pinned Terra", async () => {
    openaiPool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, {
      model: "gpt-5.6-terra",
      choices: [{ message: { content: "openai reply" } }],
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    });
    const result = await complete(
      deps({ hostedProvider: "openai", openaiApiKey: "openai-dev-key" }),
      input,
    );
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5.6-terra");
    expect(result.responseModel).toBe("gpt-5.6-terra");
  });

  it("vault provider scope menang atas semua raw env fallback", async () => {
    openrouterPool.intercept({ path: "/api/v1/chat/completions", method: "POST" }).reply(200, {
      choices: [{ message: { content: "vault router" } }],
      usage: {},
    });
    let requestedScope: string | undefined;
    const result = await complete(
      deps({
        hostedProvider: "openrouter",
        openrouterApiKey: "must-not-be-used",
        credentialVault: {
          get(provider, purpose) {
            requestedScope = `${provider}/${purpose}`;
            return "vault-router-key";
          },
        },
      }),
      input,
    );
    expect(requestedScope).toBe("openrouter/messages");
    expect(result.reply).toBe("vault router");
  });

  it("local route tidak tergantung provider hosted maupun Ollama brand", async () => {
    localPool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, {
      model: "custom-runtime-model",
      choices: [{ message: { content: "local compatible" } }],
      usage: { prompt_tokens: 8, completion_tokens: 2 },
    });
    const result = await complete(
      deps({
        hostedProvider: "openai",
        localRuntime: "openai-compatible",
        localModelTag: "custom-runtime-model",
      }),
      { ...input, target: "local" },
    );
    expect(result.provider).toBe("local");
    expect(result.reply).toBe("local compatible");
  });
});
