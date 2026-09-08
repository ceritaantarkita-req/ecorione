import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Interceptable } from "undici";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";
import { HubRepository } from "./repository.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let contextPool: Interceptable;
let connectPool: Interceptable;
let rndPool: Interceptable;
let db: HubDatabase;
let app: FastifyInstance;
const USAGE = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 };
const FULL_COST = {
  model: "claude-sonnet-4-5-20250929", naiveModel: "claude-sonnet-4-5-20250929",
  usage: USAGE, baselineUsage: USAGE, actualUsd: 0.0001, naiveUsd: 0.0002,
  savedUsd: 0.0001, savedPct: 50, routeReason: "default-hosted", policyVersion: "2", optimizerOverheadMs: 0.1,
};

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent);
  contextPool = agent.get("http://context.local"); connectPool = agent.get("http://connect.local"); rndPool = agent.get("http://rnd.local");
  db = openHubDatabase();
  app = buildHubServer(db, { contextUrl: "http://context.local", connectUrl: "http://connect.local", rndUrl: "http://rnd.local" });
});
afterEach(async () => { setGlobalDispatcher(originalDispatcher); await app.close(); db.close(); });

function mockHappyPathContextAndConnect(): void {
  contextPool.intercept({ path: "/v1/core-memory?scope=personal&maxSensitivity=INTERNAL&hostedEligible=1", method: "GET" }).reply(200, { blocks: [] });
  contextPool.intercept({ path: "/v1/retrieve", method: "POST" }).reply(200, { hits: [], diagnostics: {} });
  contextPool.intercept({ path: "/v1/episodes?sessionId=sess_abc&limit=6&hostedEligible=1", method: "GET" }).reply(200, { episodes: [] });
  contextPool.intercept({ path: "/v1/artifacts?scope=personal&maxSensitivity=INTERNAL&limit=5&hostedEligible=1", method: "GET" }).reply(200, { pointers: [] });
  contextPool.intercept({ path: "/v1/episodes", method: "POST" }).reply(201, { id: "epi_user" }).times(1);
  contextPool.intercept({ path: "/v1/episodes", method: "POST" }).reply(201, { id: "epi_assistant" }).times(1);
  connectPool.intercept({ path: "/v1/complete", method: "POST" }).reply(200, {
    reply: "baik!", model: "claude-sonnet-4-5-20250929", responseModel: "claude-sonnet-4-5-20250929",
    cacheHit: false, usage: USAGE, cost: FULL_COST, routeReason: "default-hosted",
  });
  rndPool.intercept({ path: "/v1/traces", method: "POST" }).reply(201, { id: "span_1" });
}

describe("POST /v1/chat", () => {
  it("jalur bahagia → 200", async () => {
    mockHappyPathContextAndConnect();
    const res = await app.inject({ method: "POST", url: "/v1/chat", payload: { sessionId: "sess_abc", message: "halo" } });
    expect(res.statusCode).toBe(200); expect(res.json().reply).toBe("baik!");
  });
  it("Context down → 502", async () => {
    contextPool.intercept({ path: "/v1/core-memory?scope=personal&maxSensitivity=INTERNAL&hostedEligible=1", method: "GET" }).replyWithError(new Error("down"));
    const res = await app.inject({ method: "POST", url: "/v1/chat", payload: { sessionId: "sess_abc", message: "halo" } });
    expect(res.statusCode).toBe(502); expect(res.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
  });
  it("message kosong → 400", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/chat", payload: { sessionId: "sess_abc", message: "" } });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /v1/memory/forget", () => {
  it("jalur bahagia dan audit MEMORY_INVALIDATED", async () => {
    contextPool.intercept({ path: "/v1/facts/mem_a/forget", method: "POST" }).reply(200, { id: "mem_a", tInvalid: "2026-09-08T10:30:00.000Z" });
    const res = await app.inject({ method: "POST", url: "/v1/memory/forget", payload: { factId: "mem_a", reason: "diminta pengguna" } });
    expect(res.statusCode).toBe(200);
    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    expect((audit.json().events as Array<{ type: string }>).map((e) => e.type)).toEqual(["ACTION_REQUESTED", "POLICY_EVALUATED", "MEMORY_INVALIDATED"]);
  });
  it("retry request yang sama menggunakan durable idempotent result tanpa Context call kedua", async () => {
    contextPool.intercept({ path: "/v1/facts/mem_same/forget", method: "POST" }).reply(200, { id: "mem_same", tInvalid: "2026-09-08T10:30:00.000Z" }).times(1);
    const payload = { factId: "mem_same", reason: "diminta pengguna" };
    const a = await app.inject({ method: "POST", url: "/v1/memory/forget", payload });
    const b = await app.inject({ method: "POST", url: "/v1/memory/forget", payload });
    expect(a.statusCode).toBe(200); expect(b.statusCode).toBe(200);
    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    expect((audit.json().events as Array<{ type: string }>).map((e) => e.type)).toContain("ACTION_SKIPPED_IDEMPOTENT");
  });
  it("Context 404 diteruskan", async () => {
    contextPool.intercept({ path: "/v1/facts/mem_nope/forget", method: "POST" }).reply(404, { error: { type: "NOT_FOUND", message: "tidak ada" } });
    const res = await app.inject({ method: "POST", url: "/v1/memory/forget", payload: { factId: "mem_nope" } });
    expect(res.statusCode).toBe(404); expect(res.json().error).toEqual({ type: "NOT_FOUND", message: "tidak ada" });
  });
  it("Context 409 diteruskan", async () => {
    contextPool.intercept({ path: "/v1/facts/mem_gone/forget", method: "POST" }).reply(409, { error: { type: "CONFLICT", message: "sudah di-invalidate" } });
    const res = await app.inject({ method: "POST", url: "/v1/memory/forget", payload: { factId: "mem_gone" } });
    expect(res.statusCode).toBe(409);
  });
  it("network down tetap 502", async () => {
    contextPool.intercept({ path: "/v1/facts/mem_x/forget", method: "POST" }).replyWithError(new Error("jaringan putus"));
    const res = await app.inject({ method: "POST", url: "/v1/memory/forget", payload: { factId: "mem_x" } });
    expect(res.statusCode).toBe(502);
  });
});

describe("POST /v1/actions/evaluate", () => {
  it("READ → ALLOW", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/actions/evaluate", payload: {
      operationId: "op_a", module: "Hub", tool: "chat.reply", actionClass: "READ", args: {}, scope: "personal", sensitivity: "INTERNAL", autonomy: "L1", idempotencyKey: null,
    }});
    expect(res.statusCode).toBe(200); expect(res.json().outcome).toBe("ALLOW");
  });
  it("side effect tanpa idempotency key → 400", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/actions/evaluate", payload: {
      operationId: "op_no_idem", module: "Hub", tool: "x.write", actionClass: "REVERSIBLE_WRITE", args: {}, scope: "personal", sensitivity: "INTERNAL", autonomy: "L1", idempotencyKey: null,
    }});
    expect(res.statusCode).toBe(400);
  });
  it("SPEND membuat approval durable otomatis", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/actions/evaluate", payload: {
      operationId: "op_auto", module: "Hub", tool: "pay.invoice", actionClass: "SPEND", args: {}, scope: "personal", sensitivity: "INTERNAL", autonomy: "L1", idempotencyKey: "idem-key-auto-1",
    }});
    expect(res.json().outcome).toBe("REQUIRE_APPROVAL");
    expect(new HubRepository(db).getApproval("op_auto")?.status).toBe("PENDING");
  });
  it("L4 + SPEND → DENY, bukan REQUIRE_APPROVAL", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/actions/evaluate", payload: {
      operationId: "op_l4", module: "Hub", tool: "pay.invoice", actionClass: "SPEND", args: {}, scope: "personal", sensitivity: "INTERNAL", autonomy: "L4", idempotencyKey: "idem-key-l4-123",
    }});
    expect(res.json().outcome).toBe("DENY");
  });
});

describe("approval decide", () => {
  it("evaluate → approve tanpa repository setup manual", async () => {
    await app.inject({ method: "POST", url: "/v1/actions/evaluate", payload: {
      operationId: "op_test1", module: "Hub", tool: "pay.invoice", actionClass: "SPEND", args: {}, scope: "personal", sensitivity: "INTERNAL", autonomy: "L1", idempotencyKey: "idem-key-12345",
    }});
    const res = await app.inject({ method: "POST", url: "/v1/approvals/op_test1/decide", payload: { decision: "APPROVE" } });
    expect(res.statusCode).toBe(200); expect(res.json().status).toBe("APPROVE");
  });
  it("approval tidak ada → 404", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/approvals/op_nope/decide", payload: { decision: "APPROVE" } });
    expect(res.statusCode).toBe(404);
  });
  it("RESPOND untuk efek-samping → 400", async () => {
    const repo = new HubRepository(db);
    repo.createApproval({ operationId: "op_test2" as never, actionRequest: {
      operationId: "op_test2" as never, module: "Hub", tool: "pay.invoice", actionClass: "SPEND", args: {}, scope: "personal", sensitivity: "INTERNAL", autonomy: "L1", idempotencyKey: "idem-key-67890",
    }, prompt: "Setujui?", now: "2026-09-08T10:00:00.000Z" as never });
    const res = await app.inject({ method: "POST", url: "/v1/approvals/op_test2/decide", payload: { decision: "RESPOND" } });
    expect(res.statusCode).toBe(400);
  });
});

describe("/healthz", () => {
  it("jalan tanpa auth", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json()).toEqual({ status: "ok", service: "hub" });
  });
});
