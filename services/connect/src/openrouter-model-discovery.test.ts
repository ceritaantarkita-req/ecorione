import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { OpenRouterModelDiscovery } from "./openrouter-model-discovery.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;

const response = {
  data: [
    {
      id: "anthropic/claude-sonnet-4.5",
      name: "Claude Sonnet 4.5",
      context_length: 1_000_000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      pricing: { prompt: "0.000003", completion: "0.000015" },
      supported_parameters: ["max_tokens", "tools", "reasoning"],
    },
    {
      id: "qwen/qwen3.8-max",
      name: "Qwen: Qwen3.8 Max",
      context_length: 1_000_000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      pricing: { prompt: "0.000002", completion: "0.000006" },
      supported_parameters: ["max_tokens", "tools", "reasoning_effort"],
    },
    {
      id: "~deepseek/deepseek-v4-flash-latest",
      name: "DeepSeek V4 Flash Latest",
      context_length: 1_048_576,
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      pricing: { prompt: "0.00000008", completion: "0.00000018" },
      supported_parameters: ["max_tokens", "reasoning"],
    },
  ],
};

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("https://openrouter.ai");
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

describe("OpenRouter model discovery", () => {
  it("fetches live catalog metadata and keeps discovered models non-executable", async () => {
    pool.intercept({ path: "/api/v1/models", method: "GET" }).reply(200, response);
    const discovery = new OpenRouterModelDiscovery();

    const result = await discovery.list({ q: "qwen", limit: 10 });

    expect(result).toMatchObject({
      source: "openrouter:/api/v1/models",
      cache: "refreshed",
      stale: false,
      total: 1,
      returned: 1,
    });
    expect(result.models[0]).toMatchObject({
      id: "qwen/qwen3.8-max",
      displayName: "Qwen: Qwen3.8 Max",
      sourceProvider: "qwen",
      contextWindowTokens: 1_000_000,
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
      promptPricePerToken: "0.000002",
      completionPricePerToken: "0.000006",
      mutableAlias: false,
      admission: "discovered-only",
      executable: false,
      selectionId: null,
    });
  });

  it("marks an existing verified runtime slug separately from discovery-only models", async () => {
    pool.intercept({ path: "/api/v1/models", method: "GET" }).reply(200, response);
    const discovery = new OpenRouterModelDiscovery();

    const result = await discovery.list({ sourceProvider: "anthropic" });

    expect(result.models).toHaveLength(1);
    expect(result.models[0]).toMatchObject({
      id: "anthropic/claude-sonnet-4.5",
      admission: "verified-executable",
      executable: true,
      selectionId: "claude-sonnet-4-5-20250929",
    });
  });

  it("reuses the full cached catalog across search/filter requests", async () => {
    pool.intercept({ path: "/api/v1/models", method: "GET" }).reply(200, response);
    const discovery = new OpenRouterModelDiscovery();

    const first = await discovery.list({ q: "claude" });
    const second = await discovery.list({ sourceProvider: "qwen" });

    expect(first.cache).toBe("refreshed");
    expect(second.cache).toBe("hit");
    expect(second.models.map((model) => model.id)).toEqual(["qwen/qwen3.8-max"]);
  });

  it("labels mutable latest aliases instead of treating them as stable ids", async () => {
    pool.intercept({ path: "/api/v1/models", method: "GET" }).reply(200, response);
    const discovery = new OpenRouterModelDiscovery();

    const result = await discovery.list({ sourceProvider: "deepseek" });

    expect(result.models[0]).toMatchObject({
      id: "~deepseek/deepseek-v4-flash-latest",
      mutableAlias: true,
      admission: "discovered-only",
      executable: false,
    });
  });

  it("serves explicitly stale cache when a refresh fails after a prior success", async () => {
    let now = 1_000;
    pool.intercept({ path: "/api/v1/models", method: "GET" }).reply(200, response);
    pool
      .intercept({ path: "/api/v1/models", method: "GET" })
      .replyWithError(new Error("offline"));
    const discovery = new OpenRouterModelDiscovery({
      ttlMs: 10,
      now: () => now,
    });

    await discovery.list();
    now = 2_000;
    const stale = await discovery.list();

    expect(stale.cache).toBe("stale");
    expect(stale.stale).toBe(true);
    expect(stale.returned).toBe(3);
  });

  it("fails clearly when no cache exists and the upstream response is invalid", async () => {
    pool
      .intercept({ path: "/api/v1/models", method: "GET" })
      .reply(200, { unexpected: [] });
    const discovery = new OpenRouterModelDiscovery();

    await expect(discovery.list()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  });
});
