import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { openRndDatabase, type RndDatabase } from "./db.js";
import { buildRndServer } from "./http.js";

let db: RndDatabase;
let app: FastifyInstance;

beforeEach(() => {
  db = openRndDatabase();
  app = buildRndServer(db, { token: "secret" });
});

afterEach(async () => {
  await app.close();
  db.close();
});

const AUTH = { authorization: "Bearer secret" };

describe("POST /v1/traces", () => {
  it("menyimpan span dan mengembalikan id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: AUTH,
      payload: {
        name: "chat claude-sonnet-4-5-20250929",
        attributes: { "gen_ai.provider.name": "anthropic" },
        operationId: "op_a",
        recordedAt: "2026-09-01T00:00:00.000Z",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toMatch(/^span_/);
  });

  it("menolak body tanpa recordedAt (400, bukan 500)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: AUTH,
      payload: { name: "x", attributes: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.type).toBe("BAD_REQUEST");
  });

  it("menolak tanpa token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      payload: { name: "x", attributes: {}, recordedAt: "2026-09-01T00:00:00.000Z" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /v1/traces", () => {
  it("mengembalikan span yang cocok dengan operationId", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: AUTH,
      payload: {
        name: "x",
        attributes: {},
        operationId: "op_a",
        recordedAt: "2026-09-01T00:00:00.000Z",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/traces?operationId=op_a",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().traces).toHaveLength(1);
  });
});

describe("GET /v1/traces/:id", () => {
  it("404 untuk id yang tidak ada", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/traces/span_nope", headers: AUTH });
    expect(res.statusCode).toBe(404);
  });

  it("mengembalikan span yang ada", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: AUTH,
      payload: { name: "x", attributes: {}, recordedAt: "2026-09-01T00:00:00.000Z" },
    });
    const id = created.json().id as string;

    const res = await app.inject({ method: "GET", url: `/v1/traces/${id}`, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(id);
  });
});

describe("GET /v1/traces/summary", () => {
  it("route statis /summary tidak tertangkap oleh /:id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/summary?operationId=op_kosong",
      headers: AUTH,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      callCount: 0,
      totalActualUsd: 0,
      totalNaiveUsd: 0,
      totalSavedUsd: 0,
    });
  });

  it("menjumlahkan biaya untuk operationId yang diminta", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: AUTH,
      payload: {
        name: "chat",
        attributes: { "ecorione.cost.actual_usd": 0.001, "ecorione.cost.naive_usd": 0.005 },
        operationId: "op_b",
        recordedAt: "2026-09-01T00:00:00.000Z",
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/traces/summary?operationId=op_b",
      headers: AUTH,
    });
    expect(res.json()).toMatchObject({ callCount: 1 });
  });
});

describe("/healthz", () => {
  it("jalan tanpa token", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", service: "rnd" });
  });
});
