import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";
import { HubRepository } from "./repository.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let contextPool: Interceptable;
let connectPool: Interceptable;
let rndPool: Interceptable;
let db: HubDatabase;
let app: FastifyInstance;

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
  app = buildHubServer(db, {
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
  });
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await app.close();
  db.close();
});

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
    reply: "baik!",
    model: "claude-sonnet-4-5-20250929",
    cacheHit: false,
    usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
    cost: { actualUsd: 0.0001, naiveUsd: 0.0002, savedUsd: 0.0001, savedPct: 50 },
    routeReason: "default-hosted",
  });
  rndPool.intercept({ path: "/v1/traces", method: "POST" }).reply(201, { id: "span_1" });
}

describe("POST /v1/chat", () => {
  it("jalur bahagia → 200 dengan ChatResponse", async () => {
    mockHappyPathContextAndConnect();

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat",
      payload: { sessionId: "sess_abc", message: "halo" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toBe("baik!");
  });

  it("Context tidak bisa dihubungi → 502, bukan 500", async () => {
    contextPool
      .intercept({ path: "/v1/core-memory", method: "GET" })
      .replyWithError(new Error("down"));

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat",
      payload: { sessionId: "sess_abc", message: "halo" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("body tidak valid (message kosong) → 400, bukan 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/chat",
      payload: { sessionId: "sess_abc", message: "" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /v1/memory/forget", () => {
  it("jalur bahagia → 200 dengan MemoryFact yang sudah di-invalidate, dan audit MEMORY_INVALIDATED tercatat", async () => {
    contextPool
      .intercept({ path: "/v1/facts/mem_a/forget", method: "POST" })
      .reply(200, { id: "mem_a", tInvalid: "2026-09-08T10:30:00.000Z" });

    const res = await app.inject({
      method: "POST",
      url: "/v1/memory/forget",
      payload: { factId: "mem_a", reason: "diminta pengguna" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tInvalid).toBe("2026-09-08T10:30:00.000Z");

    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    const types = (audit.json().events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toEqual(["ACTION_REQUESTED", "POLICY_EVALUATED", "MEMORY_INVALIDATED"]);
  });

  it("Context menjawab 404 (fakta tidak ada) → diteruskan apa adanya sebagai 404, bukan disamarkan jadi 502 upstream-unavailable", async () => {
    // Ini bukan kegagalan konektivitas — Context hidup dan menjawab jelas bahwa fakta
    // dengan id itu tidak ada. Pengguna yang mengklik "lupakan" pada fakta yang sudah
    // dilupakan di tab lain berhak melihat "tidak ditemukan", bukan "layanan tidak bisa
    // dihubungi" (lihat komentar `forwardOrUpstreamError` di `http.ts`).
    contextPool
      .intercept({ path: "/v1/facts/mem_nope/forget", method: "POST" })
      .reply(404, { error: { type: "NOT_FOUND", message: "tidak ada" } });

    const res = await app.inject({
      method: "POST",
      url: "/v1/memory/forget",
      payload: { factId: "mem_nope" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toEqual({ type: "NOT_FOUND", message: "tidak ada" });
  });

  it("Context menjawab 409 (sudah di-invalidate) → diteruskan apa adanya sebagai 409", async () => {
    contextPool
      .intercept({ path: "/v1/facts/mem_gone/forget", method: "POST" })
      .reply(409, { error: { type: "CONFLICT", message: "sudah di-invalidate" } });

    const res = await app.inject({
      method: "POST",
      url: "/v1/memory/forget",
      payload: { factId: "mem_gone" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("Context sungguhan tidak bisa dihubungi (jaringan) → tetap 502 UPSTREAM_UNAVAILABLE", async () => {
    contextPool
      .intercept({ path: "/v1/facts/mem_x/forget", method: "POST" })
      .replyWithError(new Error("jaringan putus"));

    const res = await app.inject({
      method: "POST",
      url: "/v1/memory/forget",
      payload: { factId: "mem_x" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("POST /v1/actions/evaluate", () => {
  it("READ → ALLOW", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/actions/evaluate",
      payload: {
        operationId: "op_a",
        module: "Hub",
        tool: "chat.reply",
        actionClass: "READ",
        args: {},
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: null,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("ALLOW");
  });

  it("SPEND → REQUIRE_APPROVAL", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/actions/evaluate",
      payload: {
        operationId: "op_a",
        module: "Hub",
        tool: "pay.invoice",
        actionClass: "SPEND",
        args: {},
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "idem-key-12345",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("REQUIRE_APPROVAL");
  });
});

describe("POST /v1/approvals/:operationId/decide", () => {
  it("APPROVE approval yang ada → 200 dan audit APPROVAL_DECIDED tercatat", async () => {
    const evalRes = await app.inject({
      method: "POST",
      url: "/v1/actions/evaluate",
      payload: {
        operationId: "op_test1",
        module: "Hub",
        tool: "pay.invoice",
        actionClass: "SPEND",
        args: {},
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "idem-key-12345",
      },
    });
    expect(evalRes.json().outcome).toBe("REQUIRE_APPROVAL");

    // Fase 1 belum punya endpoint pembuat approval otomatis dari /v1/actions/evaluate —
    // baris ini menyiapkan approval PENDING langsung lewat repository di dalam server
    // yang sama supaya /decide punya sesuatu untuk diputuskan.
    const repo = new HubRepository(db);
    repo.createApproval({
      operationId: "op_test1" as never,
      actionRequest: {
        operationId: "op_test1" as never,
        module: "Hub",
        tool: "pay.invoice",
        actionClass: "SPEND",
        args: {},
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "idem-key-12345",
      },
      prompt: "Setujui pembayaran?",
      now: "2026-09-08T10:00:00.000Z" as never,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/approvals/op_test1/decide",
      payload: { decision: "APPROVE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("APPROVE");

    const audit = await app.inject({ method: "GET", url: "/v1/audit?operationId=op_test1" });
    const types = (audit.json().events as Array<{ type: string }>).map((e) => e.type);
    expect(types).toContain("APPROVAL_DECIDED");
  });

  it("approval yang tidak ada → 404, bukan 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/approvals/op_nope/decide",
      payload: { decision: "APPROVE" },
    });
    expect(res.statusCode).toBe(404);
  });

  it('decision "RESPOND" untuk approval efek-samping → 400, bukan diam-diam sukses', async () => {
    const repo = new HubRepository(db);
    repo.createApproval({
      operationId: "op_test2" as never,
      actionRequest: {
        operationId: "op_test2" as never,
        module: "Hub",
        tool: "pay.invoice",
        actionClass: "SPEND",
        args: {},
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "idem-key-67890",
      },
      prompt: "Setujui?",
      now: "2026-09-08T10:00:00.000Z" as never,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/approvals/op_test2/decide",
      payload: { decision: "RESPOND" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("/healthz", () => {
  it("jalan tanpa auth", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json()).toEqual({ status: "ok", service: "hub" });
  });
});
