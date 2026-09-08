import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { buildConnectServer } from "./http.js";
import { prefix } from "./test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let anthropicPool: Interceptable;
let localPool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  anthropicPool = agent.get("https://api.anthropic.com");
  localPool = agent.get("http://127.0.0.1:11434");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: "hosted",
    prefix: prefix(),
    dynamicText: "",
    userMessage: "halo",
    sensitivity: "INTERNAL",
    operationId: "op_test",
    now: "2026-09-08T10:30:00.000Z",
    ...overrides,
  };
}

describe("POST /v1/complete", () => {
  it("target hosted → 200 dengan reply, cost, routeReason", async () => {
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, {
      content: [{ type: "text", text: "halo!" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const app: FastifyInstance = buildConnectServer({
      anthropicApiKey: "sk-test",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reply).toBe("halo!");
    expect(body.routeReason).toBe("default-hosted");
    expect(body.cacheHit).toBe(false);
    await app.close();
  });

  it("target local → 200, model biaya = pin lokal", async () => {
    localPool.intercept({ path: "/v1/chat/completions", method: "POST" }).reply(200, {
      choices: [{ message: { content: "[]" } }],
      usage: { prompt_tokens: 8, completion_tokens: 2 },
    });

    const app = buildConnectServer({
      anthropicApiKey: "sk-test",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/complete",
      payload: baseBody({ target: "local" }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().model).toBe("local/qwen3-8b-instruct-q4_k_m");
    await app.close();
  });

  it("body tidak valid (userMessage kosong) → 400, bukan 500", async () => {
    const app = buildConnectServer({
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/complete",
      payload: baseBody({ userMessage: "" }),
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("target hosted tanpa ANTHROPIC_API_KEY dikonfigurasi → 502, bukan 500", async () => {
    const app = buildConnectServer({
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
    await app.close();
  });

  it("provider hosted gagal (network) → 502, bukan 500", async () => {
    anthropicPool
      .intercept({ path: "/v1/messages", method: "POST" })
      .replyWithError(new Error("boom"));

    const app = buildConnectServer({
      anthropicApiKey: "sk-test",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(502);
    await app.close();
  });
});

describe("/healthz", () => {
  it("jalan tanpa auth", async () => {
    const app = buildConnectServer({
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
      token: "secret",
    });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json()).toEqual({ status: "ok", service: "connect" });
    await app.close();
  });
});
