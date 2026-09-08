import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ContextDatabase } from "./db.js";
import { buildContextServer } from "./http.js";
import { type ContextRepository } from "./repository.js";
import { createVectorIndex, type VectorIndex } from "./vector.js";
import { factInput, makeRepo, NOW, PROVENANCE, T0 } from "./test-helpers.js";

let db: ContextDatabase;
let repo: ContextRepository;
let vectors: VectorIndex;
let app: FastifyInstance;

beforeEach(() => {
  ({ db, repo } = makeRepo());
  vectors = createVectorIndex(db.raw, { dim: 3, model: "test-embed-1", prefer: "brute-force" });
  app = buildContextServer(repo, vectors, { extractLocal: vi.fn().mockResolvedValue("[]") });
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe("episodes", () => {
  it("POST /v1/episodes lalu GET mengembalikannya, terbaru dulu", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "halo dunia",
        provenance: PROVENANCE,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().id).toMatch(/^epi_/);

    const listed = await app.inject({ method: "GET", url: "/v1/episodes" });
    expect(listed.json().episodes).toHaveLength(1);
  });

  it("GET /v1/episodes memfilter berdasarkan sessionId", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "a",
        provenance: { sourceApp: "cli", sessionId: "sess_x" },
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });
    await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "b",
        provenance: { sourceApp: "cli", sessionId: "sess_y" },
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });

    const res = await app.inject({ method: "GET", url: "/v1/episodes?sessionId=sess_x" });
    expect(res.json().episodes).toHaveLength(1);
    expect(res.json().episodes[0].rawText).toBe("a");
  });
});

describe("facts — propose/promote/forget", () => {
  it("alur lengkap: propose → promote → forget", async () => {
    const proposed = await app.inject({
      method: "POST",
      url: "/v1/facts/propose",
      payload: {
        proposedText: "Amanda suka teh",
        proposedAt: T0,
        provenance: { sourceApp: "chatgpt" },
        trust: "HOSTED_AGENT",
        scope: "personal",
      },
    });
    expect(proposed.statusCode).toBe(201);
    const factId = proposed.json().id as string;

    const promoted = await app.inject({
      method: "POST",
      url: `/v1/facts/${factId}/promote`,
      payload: {
        now: T0,
        subject: "Amanda",
        predicate: "suka",
        object: "teh",
        text: "Amanda suka teh",
        confidence: 0.8,
        salience: 0.5,
        sourceEpisodeIds: ["epi_1"],
        tValid: T0,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
    });
    expect(promoted.statusCode).toBe(200);

    const listed = await app.inject({ method: "GET", url: "/v1/facts" });
    expect(listed.json().facts).toHaveLength(1);

    const forgotten = await app.inject({
      method: "POST",
      url: `/v1/facts/${factId}/forget`,
      payload: { now: NOW },
    });
    expect(forgotten.statusCode).toBe(200);
    expect(forgotten.json().tInvalid).toBe(NOW);

    const afterForget = await app.inject({ method: "GET", url: "/v1/facts" });
    expect(afterForget.json().facts).toHaveLength(0);
  });

  it("forget fakta yang tidak ada → 404, bukan 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/facts/mem_nope/forget",
      payload: { now: NOW },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.type).toBe("NOT_FOUND");
  });

  it("forget dua kali → 409 (FactAlreadyInvalidatedError dipetakan, bukan 500)", async () => {
    const fact = repo.insertFact(factInput());

    await app.inject({
      method: "POST",
      url: `/v1/facts/${fact.id}/forget`,
      payload: { now: T0 },
    });
    const second = await app.inject({
      method: "POST",
      url: `/v1/facts/${fact.id}/forget`,
      payload: { now: NOW },
    });
    expect(second.statusCode).toBe(409);
  });
});

describe("core memory", () => {
  it("PUT lalu GET mengembalikan blok yang sama", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/v1/core-memory/persona",
      payload: { description: "identitas", value: "Nama: Amanda", now: T0 },
    });
    expect(put.statusCode).toBe(200);

    const got = await app.inject({ method: "GET", url: "/v1/core-memory" });
    expect(got.json().blocks).toHaveLength(1);
    expect(got.json().blocks[0].value).toBe("Nama: Amanda");
  });
});

describe("retrieve", () => {
  it("mengembalikan hits kosong kalau tidak ada fakta", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/retrieve",
      payload: { query: "kopi", scopes: ["personal"], now: NOW },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().hits).toEqual([]);
  });

  it("menolak request tanpa scopes (400, bukan mengembalikan semua data)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/retrieve",
      payload: { query: "kopi", scopes: [], now: NOW },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("artifacts", () => {
  it("GET /v1/artifacts mengembalikan pointer yang sudah disimpan", async () => {
    repo.putArtifactPointer({
      id: "art_ab",
      path: "catatan/x.md",
      description: "catatan",
      mimeType: "text/markdown",
      sizeBytes: 10,
      scope: "personal",
      sensitivity: "INTERNAL",
    });

    const res = await app.inject({ method: "GET", url: "/v1/artifacts?scope=personal" });
    expect(res.json().pointers).toHaveLength(1);
  });
});

describe("consolidate", () => {
  it("POST /v1/consolidate/run memproses episode yang belum terkonsolidasi", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "halo",
        provenance: PROVENANCE,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/consolidate/run",
      payload: { now: NOW },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().processed).toBe(1);
  });

  it("500→400 yang jelas kalau extractLocal tidak dikonfigurasi", async () => {
    const bareApp = buildContextServer(repo, vectors);
    const res = await bareApp.inject({
      method: "POST",
      url: "/v1/consolidate/run",
      payload: { now: NOW },
    });
    expect(res.statusCode).toBe(400);
    await bareApp.close();
  });
});

describe("/healthz", () => {
  it("jalan tanpa auth", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json()).toEqual({ status: "ok", service: "context" });
  });
});
