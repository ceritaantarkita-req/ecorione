/**
 * Test integrasi lintas-service — `docs/api-fase1.md` "Test integrasi lintas-service".
 *
 * RnD, Context, dan Connect dijalankan sebagai server HTTP **sungguhan** di port acak
 * (`listen({ port: 0 })`) untuk durasi file ini, ditutup di `afterAll`. Hub juga
 * sungguhan — ia memanggil ketiganya lewat `fetch` asli, bukan lewat mock, supaya
 * jalur HTTP antar-service benar-benar dilatih, bukan cuma logikanya secara terpisah
 * (itu sudah dicakup `http.test.ts` masing-masing service).
 *
 * Satu-satunya yang di-mock adalah provider hosted (Anthropic) lewat `undici`
 * `MockAgent` — **sengaja tidak** `disableNetConnect()`: origin lain (server lokal di
 * `127.0.0.1`) harus tetap lewat jaringan asli (loopback), cuma
 * `https://api.anthropic.com` yang dicegat. Tidak ada test di sini yang butuh
 * `ANTHROPIC_API_KEY` asli.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";

import { openContextDatabase } from "../services/context/src/db.js";
import { buildContextServer } from "../services/context/src/http.js";
import { ContextRepository } from "../services/context/src/repository.js";

import { openRndDatabase } from "../services/rnd/src/db.js";
import { buildRndServer } from "../services/rnd/src/http.js";

import { buildConnectServer } from "../services/connect/src/http.js";

import { openHubDatabase } from "../services/hub/src/db.js";
import { buildHubServer } from "../services/hub/src/http.js";

const SONNET = "claude-sonnet-4-5-20250929";
const OPUS = "claude-opus-4-1-20250805";
const ANTHROPIC_API_KEY = "sk-test-golden";

// ---------------------------------------------------------------------------
// Tipe respons minimal — cuma bidang yang dipakai assertion di bawah, dideklarasikan
// lokal (bukan diimpor dari `@ecorione/shared-schema`) supaya file ini tidak perlu
// masuk sebagai dependency root package.json cuma untuk tipe.
// ---------------------------------------------------------------------------

interface ChatResponseBody {
  readonly operationId: string;
  readonly sessionId: string;
  readonly reply: string;
  readonly memoryUsed: {
    readonly coreMemoryBlocks: readonly string[];
    readonly recalledFacts: readonly unknown[];
    readonly episodicSummaries: readonly unknown[];
  };
  readonly cost: {
    readonly model: string;
    readonly cacheHit: boolean;
    readonly actualUsd: number;
    readonly naiveUsd: number;
    readonly savedUsd: number;
    readonly savedPct: number;
    readonly routeReason: string;
  };
  readonly policy: {
    readonly outcome: string;
    readonly reason: string;
    readonly ruleId: string;
  };
}

interface AuditEventBody {
  readonly id: string;
  readonly ts: string;
  readonly type: string;
  readonly operationId: string | null;
  readonly module: string;
  readonly detail: Record<string, unknown>;
  readonly ruleId: string | null;
}

interface ErrorBody {
  readonly error: {
    readonly type: string;
    readonly message: string;
    readonly detail?: unknown;
  };
  readonly requestId: string;
}

interface HttpResult {
  readonly status: number;
  readonly body: unknown;
}

async function postJson(url: string, body: unknown): Promise<HttpResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text.length > 0 ? (JSON.parse(text) as unknown) : undefined,
  };
}

async function getJson(url: string): Promise<HttpResult> {
  const res = await fetch(url);
  const text = await res.text();
  return {
    status: res.status,
    body: text.length > 0 ? (JSON.parse(text) as unknown) : undefined,
  };
}

async function listenRandomPort(
  app: Awaited<ReturnType<typeof buildRndServer>>,
): Promise<string> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as { port: number };
  return `http://127.0.0.1:${String(address.port)}`;
}

function anthropicReply(
  text: string,
  usage: { readonly input?: number; readonly output?: number } = {},
): Record<string, unknown> {
  return {
    content: [{ type: "text", text }],
    usage: {
      input_tokens: usage.input ?? 50,
      output_tokens: usage.output ?? 20,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Empat service sungguhan, satu kali untuk seluruh file.
// ---------------------------------------------------------------------------

let rndDb: ReturnType<typeof openRndDatabase>;
let rndApp: Awaited<ReturnType<typeof buildRndServer>>;
let rndUrl: string;

let contextDb: ReturnType<typeof openContextDatabase>;
let contextApp: Awaited<ReturnType<typeof buildContextServer>>;
let contextUrl: string;

let connectApp: Awaited<ReturnType<typeof buildConnectServer>>;
let connectUrl: string;

let hubDb: ReturnType<typeof openHubDatabase>;
let hubApp: Awaited<ReturnType<typeof buildHubServer>>;
let hubUrl: string;

beforeAll(async () => {
  rndDb = openRndDatabase();
  rndApp = buildRndServer(rndDb);
  rndUrl = await listenRandomPort(rndApp);

  contextDb = openContextDatabase();
  const contextRepo = new ContextRepository(contextDb);
  contextApp = buildContextServer(contextRepo, undefined, {
    extractLocal: () => Promise.resolve("[]"),
  });
  contextUrl = await listenRandomPort(contextApp);

  connectApp = buildConnectServer({
    anthropicApiKey: ANTHROPIC_API_KEY,
    // Tidak ada kasus `target: "local"` di test ini — URL ini sengaja tidak pernah dipanggil.
    localBaseUrl: "http://127.0.0.1:1",
    localModelTag: "unused",
  });
  connectUrl = await listenRandomPort(connectApp);

  hubDb = openHubDatabase();
  hubApp = buildHubServer(hubDb, { contextUrl, connectUrl, rndUrl });
  hubUrl = await listenRandomPort(hubApp);
});

afterAll(async () => {
  await hubApp.close();
  await connectApp.close();
  await contextApp.close();
  await rndApp.close();
  hubDb.close();
  contextDb.close();
  rndDb.close();
});

// ---------------------------------------------------------------------------
// Anthropic — satu-satunya panggilan keluar yang di-mock.
// ---------------------------------------------------------------------------

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let anthropicPool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  // Sengaja TIDAK disableNetConnect() — lihat komentar berkas.
  setGlobalDispatcher(agent);
  anthropicPool = agent.get("https://api.anthropic.com");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

// ---------------------------------------------------------------------------
// Kasus emas
// ---------------------------------------------------------------------------

describe("loop chat penuh: Ai→Hub→Context→Connect→RnD", () => {
  it("giliran pertama: 200, model default Sonnet, cache miss, audit berurutan, ringkasan biaya RnD", async () => {
    anthropicPool
      .intercept({ path: "/v1/messages", method: "POST" })
      .reply(200, anthropicReply("Halo! Ada yang bisa saya bantu?"));

    const chatRes = await postJson(`${hubUrl}/v1/chat`, {
      sessionId: "sess_golden1",
      message: "Halo, apa kabar?",
    });
    expect(chatRes.status).toBe(200);
    const chat = chatRes.body as ChatResponseBody;
    expect(chat.reply).toBe("Halo! Ada yang bisa saya bantu?");
    expect(chat.operationId).toMatch(/^op_/);
    expect(chat.cost).toMatchObject({
      model: SONNET,
      cacheHit: false,
      routeReason: "default-hosted",
    });
    expect(chat.memoryUsed).toEqual({
      coreMemoryBlocks: [],
      recalledFacts: [],
      episodicSummaries: [],
    });
    expect(chat.policy.outcome).toBe("ALLOW");
    expect(chat.policy.ruleId).toBe("read-always-allowed");
    expect(typeof chat.policy.reason).toBe("string");

    // Audit: urutan ACTION_REQUESTED → POLICY_EVALUATED → MODEL_CALLED (bukan urutan
    // lain — ini mengunci ulang perbaikan `ORDER BY ts ASC, rowid ASC` di repository.ts).
    const auditRes = await getJson(`${hubUrl}/v1/audit?operationId=${chat.operationId}`);
    expect(auditRes.status).toBe(200);
    const events = (auditRes.body as { events: AuditEventBody[] }).events;
    expect(events.map((e) => e.type)).toEqual([
      "ACTION_REQUESTED",
      "POLICY_EVALUATED",
      "MODEL_CALLED",
    ]);

    // RnD: ringkasan biaya untuk operationId ini konsisten dengan ChatResponse.cost.
    const summaryRes = await getJson(
      `${rndUrl}/v1/traces/summary?operationId=${chat.operationId}`,
    );
    expect(summaryRes.status).toBe(200);
    const summary = summaryRes.body as {
      callCount: number;
      totalActualUsd: number;
      totalNaiveUsd: number;
    };
    expect(summary.callCount).toBe(1);
    expect(summary.totalActualUsd).toBeCloseTo(chat.cost.actualUsd, 10);
    expect(summary.totalNaiveUsd).toBeCloseTo(chat.cost.naiveUsd, 10);
  });

  it("cache exact-match kena untuk pesan identik dari sesi berbeda; Anthropic cuma dipanggil sekali", async () => {
    // Cuma satu interceptor didaftarkan (bukan `.persist()`) — kalau cache tidak kena,
    // panggilan kedua ke Anthropic akan gagal karena tidak ada interceptor tersisa yang
    // cocok, dan itu akan membuat assertion status 200 di bawah gagal dengan jelas.
    anthropicPool
      .intercept({ path: "/v1/messages", method: "POST" })
      .reply(200, anthropicReply("Jawaban yang sama untuk pertanyaan yang sama."));

    const message = "Berapa hasil dari dua ditambah dua?";
    const first = await postJson(`${hubUrl}/v1/chat`, { sessionId: "sess_cache_a", message });
    const second = await postJson(`${hubUrl}/v1/chat`, { sessionId: "sess_cache_b", message });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstChat = first.body as ChatResponseBody;
    const secondChat = second.body as ChatResponseBody;
    expect(firstChat.cost.cacheHit).toBe(false);
    expect(secondChat.cost.cacheHit).toBe(true);
    expect(secondChat.reply).toBe(firstChat.reply);
  });

  it("system block yang dikirim ke Anthropic byte-identik di dua giliran berbeda (ADR-01)", async () => {
    const capturedBodies: Array<{ system: unknown; messages: unknown }> = [];
    const capture = (opts: { readonly body?: unknown }): Record<string, unknown> => {
      capturedBodies.push(
        JSON.parse(opts.body as string) as { system: unknown; messages: unknown },
      );
      return anthropicReply(`Balasan untuk giliran ke-${String(capturedBodies.length)}`);
    };
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, capture);
    anthropicPool.intercept({ path: "/v1/messages", method: "POST" }).reply(200, capture);

    await postJson(`${hubUrl}/v1/chat`, {
      sessionId: "sess_prefix_a",
      message: "Ceritakan tentang cuaca hari ini.",
    });
    await postJson(`${hubUrl}/v1/chat`, {
      sessionId: "sess_prefix_b",
      message: "Apa rencana kerja minggu ini?",
    });

    expect(capturedBodies).toHaveLength(2);
    const [bodyA, bodyB] = capturedBodies;
    expect(bodyA?.system).toEqual(bodyB?.system);
    expect(bodyA?.messages).not.toEqual(bodyB?.messages);
  });

  it("maxSensitivity RESTRICTED merutekan ke model Opus, bukan default Sonnet (ADR-02)", async () => {
    anthropicPool
      .intercept({ path: "/v1/messages", method: "POST" })
      .reply(200, anthropicReply("Jawaban untuk permintaan sensitif."));

    const { status, body } = await postJson(`${hubUrl}/v1/chat`, {
      sessionId: "sess_restricted",
      message: "Ini permintaan yang perlu penanganan paling hati-hati.",
      maxSensitivity: "RESTRICTED",
    });

    expect(status).toBe(200);
    const chat = body as ChatResponseBody;
    expect(chat.cost.model).toBe(OPUS);
    expect(chat.cost.routeReason).toBe("sensitivity-restricted");
  });

  it("fakta dipromosikan lewat karantina lalu dilupakan lewat Hub — audit MEMORY_INVALIDATED tercatat", async () => {
    const proposeRes = await postJson(`${contextUrl}/v1/facts/propose`, {
      proposedText: "Amanda memesan kopi susu gula aren setiap pagi.",
      proposedAt: "2026-01-01T00:00:00.000Z",
      provenance: { sourceApp: "cli" },
      trust: "HOSTED_AGENT",
      scope: "personal",
    });
    expect(proposeRes.status).toBe(201);
    const factId = (proposeRes.body as { id: string }).id;

    const promoteRes = await postJson(`${contextUrl}/v1/facts/${factId}/promote`, {
      now: "2026-01-01T00:05:00.000Z",
      subject: "Amanda",
      predicate: "memesan",
      object: "kopi susu gula aren",
      text: "Amanda memesan kopi susu gula aren setiap pagi.",
      confidence: 0.9,
      salience: 0.7,
      sourceEpisodeIds: ["epi_placeholder"],
      tValid: "2026-01-01T00:00:00.000Z",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    });
    expect(promoteRes.status).toBe(200);

    const beforeForget = await getJson(`${contextUrl}/v1/facts?scopes=personal`);
    const beforeIds = (beforeForget.body as { facts: Array<{ id: string }> }).facts.map(
      (f) => f.id,
    );
    expect(beforeIds).toContain(factId);

    const forgetRes = await postJson(`${hubUrl}/v1/memory/forget`, {
      factId,
      reason: "Diminta pengguna untuk uji integrasi.",
    });
    expect(forgetRes.status).toBe(200);

    // Default `listFacts` menyaring yang sudah di-invalidate (aturan 4) — fakta ini
    // tidak boleh muncul lagi di daftar fakta yang berlaku.
    const afterForget = await getJson(`${contextUrl}/v1/facts?scopes=personal`);
    const afterIds = (afterForget.body as { facts: Array<{ id: string }> }).facts.map(
      (f) => f.id,
    );
    expect(afterIds).not.toContain(factId);

    const auditRes = await getJson(`${hubUrl}/v1/audit`);
    const events = (auditRes.body as { events: AuditEventBody[] }).events;
    const invalidated = events.find(
      (e) => e.type === "MEMORY_INVALIDATED" && e.detail.factId === factId,
    );
    expect(invalidated).toBeDefined();
  });

  it("Context tidak bisa dihubungi → Hub membalas 502 UPSTREAM_UNAVAILABLE, bukan jawaban tanpa konteks (prd.md §7)", async () => {
    const brokenHubDb = openHubDatabase();
    const brokenHubApp = buildHubServer(brokenHubDb, {
      contextUrl: "http://127.0.0.1:1", // tidak ada apa pun yang mendengarkan di sini
      connectUrl,
      rndUrl,
    });
    const brokenHubUrl = await listenRandomPort(brokenHubApp);

    try {
      const { status, body } = await postJson(`${brokenHubUrl}/v1/chat`, {
        sessionId: "sess_broken",
        message: "Pesan apa saja.",
      });
      expect(status).toBe(502);
      expect((body as ErrorBody).error.type).toBe("UPSTREAM_UNAVAILABLE");
    } finally {
      await brokenHubApp.close();
      brokenHubDb.close();
    }
  });

  it("Connect tanpa ANTHROPIC_API_KEY untuk target hosted → 502 UPSTREAM_UNAVAILABLE, pesan jelas", async () => {
    const bareConnectApp = buildConnectServer({
      anthropicApiKey: undefined,
      localBaseUrl: "http://127.0.0.1:1",
      localModelTag: "unused",
    });
    const bareConnectUrl = await listenRandomPort(bareConnectApp);

    try {
      const { status, body } = await postJson(`${bareConnectUrl}/v1/complete`, {
        target: "hosted",
        prefix: { systemPrompt: "x", toolDefinitions: [], coreMemory: { blocks: [] } },
        dynamicText: "",
        userMessage: "halo",
        sensitivity: "INTERNAL",
        operationId: "op_test123456789",
        now: "2026-01-01T00:00:00.000Z",
      });
      expect(status).toBe(502);
      const err = body as ErrorBody;
      expect(err.error.type).toBe("UPSTREAM_UNAVAILABLE");
      expect(err.error.message).toMatch(/ANTHROPIC_API_KEY/);
    } finally {
      await bareConnectApp.close();
    }
  });

  it("POST /v1/actions/evaluate: IRREVERSIBLE_WRITE selalu REQUIRE_APPROVAL, otonomi melebihi plafon selalu DENY", async () => {
    const gated = await postJson(`${hubUrl}/v1/actions/evaluate`, {
      operationId: "op_evalgate0001",
      module: "Hub",
      tool: "some.irreversible.tool",
      actionClass: "IRREVERSIBLE_WRITE",
      args: {},
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
      idempotencyKey: "idem-key-eval-gate-1",
    });
    expect(gated.status).toBe(200);
    expect((gated.body as { outcome: string }).outcome).toBe("REQUIRE_APPROVAL");

    const denied = await postJson(`${hubUrl}/v1/actions/evaluate`, {
      operationId: "op_evalgate0002",
      module: "Hub",
      tool: "some.reversible.tool",
      actionClass: "REVERSIBLE_WRITE",
      args: {},
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L4",
      idempotencyKey: "idem-key-eval-gate-2",
    });
    expect(denied.status).toBe(200);
    expect((denied.body as { outcome: string }).outcome).toBe("DENY");
  });
});
