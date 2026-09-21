import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { callAnthropic } from "./anthropic.js";
import { ProviderError } from "./errors.js";
import { prefix } from "../test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("https://api.anthropic.com");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

describe("callAnthropic", () => {
  it("mengirim system dengan cache_control di blok terakhir, tools kosong tetap array", async () => {
    let capturedBody: unknown;
    pool
      .intercept({
        path: "/v1/messages",
        method: "POST",
        headers: { "x-api-key": "sk-test", "anthropic-version": "2023-06-01" },
      })
      .reply(200, (opts) => {
        capturedBody = JSON.parse(opts.body as string);
        return {
          model: "claude-sonnet-4-5-20250929",
          content: [{ type: "text", text: "halo kembali" }],
          usage: {
            input_tokens: 12,
            output_tokens: 4,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 0,
          },
        };
      });

    const result = await callAnthropic({
      apiKey: "sk-test",
      model: "claude-sonnet-4-5-20250929",
      prefix: prefix(),
      dynamicText: "<untrusted_memory></untrusted_memory>",
      userMessage: "halo",
    });

    expect(result.reply).toBe("halo kembali");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 4,
      cacheWriteTokens: 100,
      cacheReadTokens: 0,
    });

    const body = capturedBody as {
      system: Array<{ text: string; cache_control?: unknown }>;
      tools: unknown[];
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.system).toHaveLength(2);
    expect(body.system[1]?.cache_control).toEqual({ type: "ephemeral" });
    expect(body.system[0]?.cache_control).toBeUndefined();
    expect(body.tools).toEqual([]);
    expect(body.messages).toEqual([
      { role: "user", content: "<untrusted_memory></untrusted_memory>\n\nhalo" },
    ]);
  });

  it("memasang cache_control di blok tool terakhir kalau tools tidak kosong", async () => {
    let capturedBody: unknown;
    pool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, (opts) => {
      capturedBody = JSON.parse(opts.body as string);
      return { content: [{ type: "text", text: "ok" }], usage: {} };
    });

    await callAnthropic({
      apiKey: "sk-test",
      model: "claude-sonnet-4-5-20250929",
      prefix: prefix({
        toolDefinitions: [
          { name: "a", description: "alat a", inputSchema: {} },
          { name: "b", description: "alat b", inputSchema: {} },
        ],
      }),
      dynamicText: "",
      userMessage: "halo",
    });

    const body = capturedBody as { tools: Array<{ name: string; cache_control?: unknown }> };
    expect(body.tools).toHaveLength(2);
    expect(body.tools[0]?.cache_control).toBeUndefined();
    expect(body.tools[1]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("usage hilang di respons → default ke nol, bukan melempar", async () => {
    pool
      .intercept({ path: "/v1/messages", method: "POST" })
      .reply(200, { content: [{ type: "text", text: "ok" }] });

    const result = await callAnthropic({
      apiKey: "sk-test",
      model: "claude-sonnet-4-5-20250929",
      prefix: prefix(),
      dynamicText: "",
      userMessage: "halo",
    });
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it("401/403 → ProviderError invalid-credential", async () => {
    pool
      .intercept({ path: "/v1/messages", method: "POST" })
      .reply(401, { error: { message: "invalid x-api-key" } });

    await expect(
      callAnthropic({
        apiKey: "sk-bad",
        model: "claude-sonnet-4-5-20250929",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "halo",
      }),
    ).rejects.toMatchObject({ name: "ProviderError", kind: "invalid-credential" });
  });

  it("respons bukan JSON valid → ProviderError", async () => {
    pool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, "bukan json {{{");

    await expect(
      callAnthropic({
        apiKey: "sk-test",
        model: "claude-sonnet-4-5-20250929",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "halo",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("redirect Anthropic ditolak fail-closed", async () => {
    let redirectedTargetHit = false;
    pool
      .intercept({ path: "/v1/messages", method: "POST" })
      .reply(302, "", { headers: { location: "/redirected" } });
    pool.intercept({ path: "/redirected", method: "POST" }).reply(200, () => {
      redirectedTargetHit = true;
      return { content: [{ type: "text", text: "should-not-run" }] };
    });

    await expect(
      callAnthropic({
        apiKey: "sk-test",
        model: "claude-sonnet-4-5-20250929",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "halo",
      }),
    ).rejects.toMatchObject({ name: "ProviderError", kind: "unreachable" });
    expect(redirectedTargetHit).toBe(false);
  });

  it("kegagalan jaringan → ProviderError unreachable", async () => {
    pool.intercept({ path: "/v1/messages", method: "POST" }).replyWithError(new Error("boom"));

    await expect(
      callAnthropic({
        apiKey: "sk-test",
        model: "claude-sonnet-4-5-20250929",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "halo",
      }),
    ).rejects.toMatchObject({ name: "ProviderError", kind: "unreachable" });
  });
});
