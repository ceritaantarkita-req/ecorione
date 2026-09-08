import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Interceptable } from "undici";
import { complete, type CompleteDeps } from "./complete.js";
import { ExactMatchCache } from "./cache.js";
import { MissingCredentialError } from "./providers/errors.js";
import { NOW, OPERATION_ID, prefix } from "./test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let anthropicPool: Interceptable;
let localPool: Interceptable;
beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent);
  anthropicPool = agent.get("https://api.anthropic.com");
  localPool = agent.get("http://127.0.0.1:11434");
});
afterEach(() => { setGlobalDispatcher(originalDispatcher); });
function deps(overrides: Partial<CompleteDeps> = {}): CompleteDeps {
  return { anthropicApiKey: "sk-test", localBaseUrl: "http://127.0.0.1:11434/v1", localModelTag: "qwen3:8b-instruct-q4_K_M", cache: new ExactMatchCache(), ...overrides };
}

describe("complete", () => {
  it("target hosted: memanggil Anthropic, mencatat cost dan response model", async () => {
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, {
      model: "claude-sonnet-4-5-20250929", content: [{ type: "text", text: "halo!" }],
      usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    });
    const result = await complete(deps(), { target: "hosted", prefix: prefix(), dynamicText: "", userMessage: "halo", sensitivity: "INTERNAL", operationId: OPERATION_ID, now: NOW });
    expect(result.reply).toBe("halo!");
    expect(result.model).toBe("claude-sonnet-4-5-20250929");
    expect(result.responseModel).toBe("claude-sonnet-4-5-20250929");
    expect(result.cacheHit).toBe(false);
    expect(result.cost.actualUsd).toBeGreaterThan(0);
    expect(result.cost.operationId).toBe(OPERATION_ID);
  });

  it("internal exact-cache hit tidak memanggil provider dan actual provider cost = 0", async () => {
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, {
      model: "claude-sonnet-4-5-20250929", content: [{ type: "text", text: "halo!" }], usage: { input_tokens: 100, output_tokens: 20 },
    }).times(1);
    const sharedCache = new ExactMatchCache();
    const input = { target: "hosted" as const, prefix: prefix(), dynamicText: "", userMessage: "halo", sensitivity: "INTERNAL" as const, operationId: OPERATION_ID, now: NOW };
    const first = await complete(deps({ cache: sharedCache }), input);
    const second = await complete(deps({ cache: sharedCache }), input);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.reply).toBe(first.reply);
    expect(second.cost.actualUsd).toBe(0);
    expect(second.cost.naiveUsd).toBeCloseTo(first.cost.naiveUsd, 12);
    expect(second.usage).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });

  it("perubahan userMessage membatalkan cache hit", async () => {
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, { content: [{ type: "text", text: "jawaban 1" }], usage: {} }).times(1);
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, { content: [{ type: "text", text: "jawaban 2" }], usage: {} }).times(1);
    const sharedCache = new ExactMatchCache();
    const base = { target: "hosted" as const, prefix: prefix(), dynamicText: "", sensitivity: "INTERNAL" as const, operationId: OPERATION_ID, now: NOW };
    const first = await complete(deps({ cache: sharedCache }), { ...base, userMessage: "a" });
    const second = await complete(deps({ cache: sharedCache }), { ...base, userMessage: "b" });
    expect(first.cacheHit).toBe(false); expect(second.cacheHit).toBe(false); expect(first.reply).not.toBe(second.reply);
  });

  it("target local mencatat pinned cost identity dan runtime response model", async () => {
    localPool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, {
      model: "qwen3:8b-instruct-q4_K_M", choices: [{ message: { content: "[]" } }], usage: { prompt_tokens: 30, completion_tokens: 5 },
    });
    const result = await complete(deps(), { target: "local", prefix: prefix(), dynamicText: "", userMessage: "ekstrak", sensitivity: "INTERNAL", operationId: OPERATION_ID, now: NOW });
    expect(result.model).toBe("local/qwen3-8b-instruct-q4_k_m");
    expect(result.responseModel).toBe("qwen3:8b-instruct-q4_K_M");
    expect(result.routeReason).toBe("local-consolidation");
    expect(result.cost.actualUsd).toBe(0); expect(result.cost.naiveUsd).toBeGreaterThan(0);
  });

  it("target hosted tanpa ANTHROPIC_API_KEY gagal jelas", async () => {
    await expect(complete(deps({ anthropicApiKey: undefined }), { target: "hosted", prefix: prefix(), dynamicText: "", userMessage: "halo", sensitivity: "INTERNAL", operationId: OPERATION_ID, now: NOW })).rejects.toBeInstanceOf(MissingCredentialError);
  });

  it("sensitivity RESTRICTED + target hosted → Opus", async () => {
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, { content: [{ type: "text", text: "jawaban sensitif" }], usage: {} });
    const result = await complete(deps(), { target: "hosted", prefix: prefix(), dynamicText: "", userMessage: "halo", sensitivity: "RESTRICTED", operationId: OPERATION_ID, now: NOW });
    expect(result.model).toBe("claude-opus-4-1-20250805");
  });
});
