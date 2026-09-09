import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { CredentialVaultIntegrityError } from "./credential-vault.js";
import { buildConnectServer } from "./http.js";
import { SpendBudgetBusyError, SpendBudgetExceededError } from "./spend-budget.js";
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
      anthropicApiKey: "test-provider-key",
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
      anthropicApiKey: "test-provider-key",
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

  it("target hosted tanpa credential dikonfigurasi → 502, bukan 500", async () => {
    const app = buildConnectServer({
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
    await app.close();
  });

  it("vault integrity failure → 503 eksplisit tanpa fallback provider", async () => {
    const app = buildConnectServer({
      credentialVault: {
        get() {
          throw new CredentialVaultIntegrityError("anthropic", "messages");
        },
      },
      anthropicApiKey: "dev-fallback-must-not-run",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.type).toBe("CREDENTIAL_VAULT_UNAVAILABLE");
    await app.close();
  });

  it("cost kill switch → 503 eksplisit dan tidak silent fallback", async () => {
    const app = buildConnectServer({
      anthropicApiKey: "test-provider-key",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
      hostedCallsEnabled: false,
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.type).toBe("COST_KILL_SWITCH_ACTIVE");
    expect(res.json().error.message).toContain("ECORIONE_COST_KILL_SWITCH");
    await app.close();
  });

  it("daily/monthly budget rejection → 429 sebelum provider dispatch", async () => {
    const app = buildConnectServer({
      anthropicApiKey: "test-provider-key",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
      spendBudget: {
        reserve() {
          throw new SpendBudgetExceededError({
            period: "daily",
            limitUsd: 1,
            committedUsd: 0.99,
            requestedReserveUsd: 0.02,
          });
        },
        settle() {
          throw new Error("settle must not run");
        },
        markUncertain() {
          throw new Error("uncertain must not run");
        },
      },
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.type).toBe("SPEND_BUDGET_EXCEEDED");
    await app.close();
  });

  it("spend store/lock unavailable → 503 fail-closed", async () => {
    const app = buildConnectServer({
      anthropicApiKey: "test-provider-key",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
      spendBudget: {
        reserve() {
          throw new SpendBudgetBusyError("/tmp/connect-spend-budget.lock");
        },
        settle() {
          throw new Error("settle must not run");
        },
        markUncertain() {
          throw new Error("uncertain must not run");
        },
      },
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.type).toBe("SPEND_BUDGET_UNAVAILABLE");
    await app.close();
  });

  it("provider hosted sukses mengembalikan budget reservation + settlement", async () => {
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, {
      model: "claude-sonnet-4-5-20250929",
      content: [{ type: "text", text: "budgeted" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    let settledActual: number | undefined;
    const app = buildConnectServer({
      anthropicApiKey: "test-provider-key",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "qwen3:8b-instruct-q4_K_M",
      spendBudget: {
        reserve(input) {
          return {
            reservationId: "spend_0123456789abcdef0123456789abcdef",
            operationId: input.operationId,
            provider: "anthropic",
            model: input.model,
            reservedUsd: input.reservedUsd,
            actualUsd: null,
            status: "reserved",
            createdAt: input.now,
            settledAt: null,
          };
        },
        settle(_reservationId, actualUsd) {
          settledActual = actualUsd;
          return {
            reservationId: "spend_0123456789abcdef0123456789abcdef",
            operationId: "op_test",
            provider: "anthropic",
            model: "claude-sonnet-4-5-20250929",
            reservedUsd: 1,
            actualUsd,
            status: "settled",
            createdAt: "2026-09-08T10:30:00.000Z",
            settledAt: "2026-09-08T10:30:00.000Z",
          };
        },
        markUncertain() {
          throw new Error("uncertain must not run");
        },
      },
    });

    const res = await app.inject({ method: "POST", url: "/v1/complete", payload: baseBody() });
    expect(res.statusCode).toBe(200);
    expect(settledActual).toBeGreaterThan(0);
    expect(res.json().budget.settlement).toBe("settled");
    expect(res.json().budget.actualUsd).toBe(settledActual);
    await app.close();
  });

  it("provider hosted gagal (network) → 502, bukan 500", async () => {
    anthropicPool
      .intercept({ path: "/v1/messages", method: "POST" })
      .replyWithError(new Error("boom"));

    const app = buildConnectServer({
      anthropicApiKey: "test-provider-key",
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
      token: "test-internal-token",
    });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json()).toEqual({ status: "ok", service: "connect" });
    await app.close();
  });
});
