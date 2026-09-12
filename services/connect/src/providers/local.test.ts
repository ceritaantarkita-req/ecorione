import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { callLocal } from "./local.js";
import { ProviderError } from "./errors.js";
import { prefix } from "../test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://127.0.0.1:11434");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

describe("callLocal", () => {
  it("format OpenAI chat-completions, cache tokens selalu nol", async () => {
    let capturedBody: unknown;
    pool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, (opts) => {
      capturedBody = JSON.parse(opts.body as string);
      return {
        choices: [{ message: { content: '[{"worthRemembering":false}]' } }],
        usage: { prompt_tokens: 50, completion_tokens: 20 },
      };
    });

    const result = await callLocal({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b-instruct-q4_K_M",
      prefix: prefix(),
      dynamicText: "",
      userMessage: "ekstrak fakta dari episode berikut",
    });

    expect(result.reply).toBe('[{"worthRemembering":false}]');
    expect(result.usage).toEqual({
      inputTokens: 50,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });

    const body = capturedBody as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("qwen3:8b-instruct-q4_K_M");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[0]?.content).toContain(prefix().systemPrompt);
    expect(body.messages[0]?.content).toContain("exactly that string and nothing else");
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "ekstrak fakta dari episode berikut",
    });
  });

  it("dynamic context tetap data terpisah dan live user request selalu message terakhir", async () => {
    let capturedBody: unknown;
    pool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, (opts) => {
      capturedBody = JSON.parse(opts.body as string);
      return { choices: [{ message: { content: "ok" } }], usage: {} };
    });

    await callLocal({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b-instruct-q4_K_M",
      prefix: prefix(),
      dynamicText: "<untrusted_memory>x</untrusted_memory>",
      userMessage: "Balas tepat: UX_LOCAL_OK",
    });

    const body = capturedBody as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1]).toEqual({
      role: "user",
      content: "<untrusted_memory>x</untrusted_memory>",
    });
    expect(body.messages[2]).toEqual({
      role: "user",
      content: "Balas tepat: UX_LOCAL_OK",
    });
  });

  it("core memory ikut context data, bukan digabung dengan live request", async () => {
    let capturedBody: unknown;
    pool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, (opts) => {
      capturedBody = JSON.parse(opts.body as string);
      return { choices: [{ message: { content: "ok" } }], usage: {} };
    });

    await callLocal({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b-instruct-q4_K_M",
      prefix: prefix({
        coreMemory: {
          blocks: [
            {
              label: "preferences",
              description: "user preferences",
              value: "jawab singkat",
              scope: "personal",
              sensitivity: "INTERNAL",
              syncClass: "LOCAL_ONLY",
              updatedAt: "2026-09-12T00:00:00.000Z",
            },
          ],
        },
      }),
      dynamicText: "",
      userMessage: "halo",
    });

    const body = capturedBody as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1]?.content).toContain("<core_memory>");
    expect(body.messages[1]?.content).toContain("jawab singkat");
    expect(body.messages[2]).toEqual({ role: "user", content: "halo" });
  });

  it("usage hilang → default ke nol", async () => {
    pool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(200, { choices: [{ message: { content: "ok" } }] });

    const result = await callLocal({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3:8b-instruct-q4_K_M",
      prefix: prefix(),
      dynamicText: "",
      userMessage: "halo",
    });
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });

  it("status bukan 2xx → ProviderError", async () => {
    pool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(500, { error: "boom" });

    await expect(
      callLocal({
        baseUrl: "http://127.0.0.1:11434/v1",
        modelTag: "qwen3:8b-instruct-q4_K_M",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "halo",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("kegagalan jaringan (server lokal tidak jalan) → ProviderError", async () => {
    pool
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .replyWithError(new Error("ECONNREFUSED"));

    await expect(
      callLocal({
        baseUrl: "http://127.0.0.1:11434/v1",
        modelTag: "qwen3:8b-instruct-q4_K_M",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "halo",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
