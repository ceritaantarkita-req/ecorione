import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import type { ChatRequest, Timestamp } from "@ecorione/shared-schema";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { chat, hubPrefixDigest, UpstreamError, type OrchestrateDeps } from "./orchestrate.js";
import { HubRepository } from "./repository.js";

const NOW = "2026-09-08T10:30:00.000Z" as Timestamp;

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let contextPool: Interceptable;
let connectPool: Interceptable;
let rndPool: Interceptable;
let db: HubDatabase;
let deps: OrchestrateDeps;

const CORE_MEMORY = { blocks: [] };

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  contextPool = agent.get("http://context.local");
  connectPool = agent.get("http://connect.local");
  rndPool = agent.get("http://rnd.local");

  db = openHubDatabase();
  deps = {
    repo: new HubRepository(db),
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
    internalToken: undefined,
  };
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  db.close();
});

function chatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    sessionId: "sess_abc" as never,
    message: "halo, apa kabar?",
    scope: "personal",
    maxSensitivity: "INTERNAL",
    autonomy: "L1",
    ...overrides,
  };
}

function mockHappyPathContextAndConnect(): void {
  contextPool.intercept({ path: "/v1/core-memory", method: "GET" }).reply(200, CORE_MEMORY);
  contextPool
    .intercept({ path: "/v1/retrieve", method: "POST" })
    .reply(200, { hits: [], diagnostics: {} });
  contextPool
    .intercept({ path: "/v1/episodes?sessionId=sess_abc&limit=6", method: "GET" })
    .reply(200, { episodes: [] });
  contextPool
    .intercept({ path: "/v1/artifacts?scope=personal&limit=5", method: "GET" })
    .reply(200, { pointers: [] });
  contextPool
    .intercept({ path: "/v1/episodes", method: "POST" })
    .reply(201, { id: "epi_user" })
    .times(1);
  contextPool
    .intercept({ path: "/v1/episodes", method: "POST" })
    .reply(201, { id: "epi_assistant" })
    .times(1);
  connectPool.intercept({ path: "/v1/complete", method: "POST" }).reply(200, {
    reply: "baik, terima kasih!",
    model: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
    cost: { actualUsd: 0.001, naiveUsd: 0.002, savedUsd: 0.001, savedPct: 50 },
    routeReason: "default-hosted",
  });
  rndPool.intercept({ path: "/v1/traces", method: "POST" }).reply(201, { id: "span_1" });
}

describe("chat", () => {
  it("jalur bahagia: mengembalikan ChatResponse lengkap dan mencatat audit trail", async () => {
    mockHappyPathContextAndConnect();

    const result = await chat(deps, chatRequest(), NOW);

    expect(result.reply).toBe("baik, terima kasih!");
    expect(result.sessionId).toBe("sess_abc");
    expect(result.cost.model).toBe("claude-sonnet-4-5-20250929");
    expect(result.cost.cacheHit).toBe(false);
    expect(result.policy).toEqual({
      outcome: "ALLOW",
      reason: "Aksi READ tidak mengubah state apa pun.",
      ruleId: "read-always-allowed",
    });

    const events = deps.repo.listAuditEvents({ operationId: result.operationId });
    expect(events.map((e) => e.type)).toEqual([
      "ACTION_REQUESTED",
      "POLICY_EVALUATED",
      "MODEL_CALLED",
    ]);
  });

  it("Context tidak bisa dihubungi → UpstreamError dengan service Context", async () => {
    contextPool
      .intercept({ path: "/v1/core-memory", method: "GET" })
      .replyWithError(new Error("down"));

    const err = await chat(deps, chatRequest(), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).service).toBe("Context");
  });

  it("Connect tidak bisa dihubungi → UpstreamError dengan service Connect, episode belum ditulis", async () => {
    contextPool.intercept({ path: "/v1/core-memory", method: "GET" }).reply(200, CORE_MEMORY);
    contextPool
      .intercept({ path: "/v1/retrieve", method: "POST" })
      .reply(200, { hits: [], diagnostics: {} });
    contextPool
      .intercept({ path: "/v1/episodes?sessionId=sess_abc&limit=6", method: "GET" })
      .reply(200, { episodes: [] });
    contextPool
      .intercept({ path: "/v1/artifacts?scope=personal&limit=5", method: "GET" })
      .reply(200, { pointers: [] });
    connectPool
      .intercept({ path: "/v1/complete", method: "POST" })
      .replyWithError(new Error("down"));

    const err = await chat(deps, chatRequest(), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).service).toBe("Connect");
  });

  it("RnD tidak bisa dihubungi → UpstreamError dengan service RnD, setelah episode berhasil ditulis", async () => {
    contextPool.intercept({ path: "/v1/core-memory", method: "GET" }).reply(200, CORE_MEMORY);
    contextPool
      .intercept({ path: "/v1/retrieve", method: "POST" })
      .reply(200, { hits: [], diagnostics: {} });
    contextPool
      .intercept({ path: "/v1/episodes?sessionId=sess_abc&limit=6", method: "GET" })
      .reply(200, { episodes: [] });
    contextPool
      .intercept({ path: "/v1/artifacts?scope=personal&limit=5", method: "GET" })
      .reply(200, { pointers: [] });
    contextPool
      .intercept({ path: "/v1/episodes", method: "POST" })
      .reply(201, { id: "epi_user" })
      .times(1);
    contextPool
      .intercept({ path: "/v1/episodes", method: "POST" })
      .reply(201, { id: "epi_assistant" })
      .times(1);
    connectPool.intercept({ path: "/v1/complete", method: "POST" }).reply(200, {
      reply: "ok",
      model: "claude-sonnet-4-5-20250929",
      cacheHit: false,
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
      cost: { actualUsd: 0.0001, naiveUsd: 0.0001, savedUsd: 0, savedPct: 0 },
      routeReason: "default-hosted",
    });
    rndPool.intercept({ path: "/v1/traces", method: "POST" }).replyWithError(new Error("down"));

    const err = await chat(deps, chatRequest(), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).service).toBe("RnD");
  });
});

describe("hubPrefixDigest", () => {
  it("deterministik untuk coreMemory yang sama (prasyarat cache hit Connect, ADR-01)", () => {
    expect(hubPrefixDigest(CORE_MEMORY)).toBe(hubPrefixDigest(CORE_MEMORY));
  });
});
