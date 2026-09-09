import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import type { ChatRequest, Timestamp } from "@ecorione/shared-schema";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
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
const USAGE = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 };
function cost(usage = USAGE) {
  return {
    model: "claude-sonnet-4-5-20250929",
    naiveModel: "claude-sonnet-4-5-20250929",
    usage,
    baselineUsage: usage,
    actualUsd: 0.001,
    naiveUsd: 0.002,
    savedUsd: 0.001,
    savedPct: 50,
    routeReason: "default-hosted",
    policyVersion: "2",
    optimizerOverheadMs: 0.25,
  };
}

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
    history: new HistoryLedger(db),
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
function mockContextBeforeConnect(): void {
  contextPool
    .intercept({
      path: "/v1/core-memory?scope=personal&maxSensitivity=INTERNAL&hostedEligible=1",
      method: "GET",
    })
    .reply(200, CORE_MEMORY);
  contextPool
    .intercept({ path: "/v1/retrieve", method: "POST" })
    .reply(200, { hits: [], diagnostics: {} });
  contextPool
    .intercept({
      path: "/v1/episodes?sessionId=sess_abc&limit=6&hostedEligible=1",
      method: "GET",
    })
    .reply(200, { episodes: [] });
  contextPool
    .intercept({
      path: "/v1/artifacts?scope=personal&maxSensitivity=INTERNAL&limit=5&hostedEligible=1",
      method: "GET",
    })
    .reply(200, { pointers: [] });
}
function mockEpisodeWrites(): void {
  contextPool
    .intercept({ path: "/v1/episodes", method: "POST" })
    .reply(201, { id: "epi_user" })
    .times(1);
  contextPool
    .intercept({ path: "/v1/episodes", method: "POST" })
    .reply(201, { id: "epi_assistant" })
    .times(1);
}
function mockComplete(reply = "baik, terima kasih!"): void {
  connectPool.intercept({ path: "/v1/complete", method: "POST" }).reply(200, {
    reply,
    model: "claude-sonnet-4-5-20250929",
    responseModel: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: USAGE,
    cost: cost(),
    routeReason: "default-hosted",
  });
}
function mockHappy(): void {
  mockContextBeforeConnect();
  mockEpisodeWrites();
  mockComplete();
  rndPool.intercept({ path: "/v1/traces", method: "POST" }).reply(201, { id: "span_1" });
}

describe("chat", () => {
  it("jalur bahagia mengembalikan response, audit trail, dan chronological ledger", async () => {
    mockHappy();
    const result = await chat(deps, chatRequest(), NOW);
    expect(result.reply).toBe("baik, terima kasih!");
    expect(result.cost.model).toBe("claude-sonnet-4-5-20250929");
    expect(result.policy.ruleId).toBe("read-always-allowed");
    expect(
      deps.repo.listAuditEvents({ operationId: result.operationId }).map((e) => e.type),
    ).toEqual(["ACTION_REQUESTED", "POLICY_EVALUATED", "MODEL_CALLED"]);

    const range = deps.history.readRange({
      sessionId: chatRequest().sessionId,
      afterSeq: -1,
      limit: 10,
      grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: true },
    });
    expect(range.events.map((event) => event.eventType)).toEqual([
      "user.message",
      "model.called",
      "agent.message",
    ]);
    expect(range.events.map((event) => event.seq)).toEqual([0, 1, 2]);
    expect(range.events[1]?.parentEventId).toBe(range.events[0]?.id);
    expect(range.events[2]?.parentEventId).toBe(range.events[1]?.id);
  });

  it("Context tidak bisa dihubungi → UpstreamError Context", async () => {
    contextPool
      .intercept({
        path: "/v1/core-memory?scope=personal&maxSensitivity=INTERNAL&hostedEligible=1",
        method: "GET",
      })
      .replyWithError(new Error("down"));
    const err = await chat(deps, chatRequest(), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).service).toBe("Context");
  });

  it("Connect tidak bisa dihubungi → UpstreamError Connect sebelum episode ditulis", async () => {
    mockContextBeforeConnect();
    connectPool
      .intercept({ path: "/v1/complete", method: "POST" })
      .replyWithError(new Error("down"));
    const err = await chat(deps, chatRequest(), NOW).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).service).toBe("Connect");
  });

  it("Historical Ledger gagal setelah provider sukses tidak membuat provider dipanggil ulang", async () => {
    mockHappy();
    db.raw.exec(`
      CREATE TRIGGER history_reject_model_insert
      BEFORE INSERT ON history_events
      WHEN NEW.event_type='model.called'
      BEGIN
        SELECT RAISE(ABORT, 'forced post-provider history failure');
      END;
    `);

    const result = await chat(deps, chatRequest(), NOW);
    expect(result.reply).toBe("baik, terima kasih!");
    const audit = deps.repo.listAuditEvents({ operationId: result.operationId });
    expect(audit.map((event) => event.type)).toContain("HISTORY_WRITE_FAILED");

    const range = deps.history.readRange({
      sessionId: chatRequest().sessionId,
      afterSeq: -1,
      limit: 10,
      grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: true },
    });
    expect(range.events.map((event) => event.eventType)).toEqual(["user.message"]);
    expect(range.nextSeq).toBe(1);
  });

  it("RnD gagal setelah provider/state sukses tidak membuat chat retryable 502", async () => {
    mockContextBeforeConnect();
    mockEpisodeWrites();
    mockComplete("ok");
    rndPool.intercept({ path: "/v1/traces", method: "POST" }).replyWithError(new Error("down"));
    const result = await chat(deps, chatRequest(), NOW);
    expect(result.reply).toBe("ok");
    const events = deps.repo.listAuditEvents({ operationId: result.operationId });
    expect(events.map((e) => e.type)).toContain("TRACE_WRITE_FAILED");
  });
});

describe("hubPrefixDigest", () => {
  it("deterministik untuk coreMemory yang sama", () => {
    expect(hubPrefixDigest(CORE_MEMORY)).toBe(hubPrefixDigest(CORE_MEMORY));
  });
});
