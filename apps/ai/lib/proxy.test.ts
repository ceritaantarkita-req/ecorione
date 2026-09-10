import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { z } from "zod";
import { proxyToHub } from "./proxy";

const BodySchema = z.object({ message: z.string().min(1) });

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalHubUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://hub.local");

  originalHubUrl = process.env.ECORIONE_HUB_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
  // Hermetic test baseline: a developer may have sourced `.env` before running Vitest.
  // Individual cases that exercise bearer auth set their own explicit token below.
  delete process.env.ECORIONE_INTERNAL_TOKEN;
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

function jsonRequest(body: unknown): Request {
  return new Request("http://ai.local/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("proxyToHub", () => {
  it("body tidak JSON valid → 400 tanpa memanggil Hub", async () => {
    const request = new Request("http://ai.local/api/x", {
      method: "POST",
      body: "bukan json {{{",
    });
    const res = await proxyToHub(request, BodySchema, "/v1/x");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { type: string } }).error.type).toBe("BAD_REQUEST");
  });

  it("body tidak cocok skema → 400 dengan daftar issues, tanpa memanggil Hub", async () => {
    const res = await proxyToHub(jsonRequest({ message: "" }), BodySchema, "/v1/x");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { detail: { issues: unknown[] } } };
    expect(json.error.detail.issues.length).toBeGreaterThan(0);
  });

  it("body valid → diteruskan ke Hub sebagai POST JSON, tanpa Authorization kalau token kosong", async () => {
    let sawAuth: string | undefined;
    pool
      .intercept({ path: "/v1/x", method: "POST", body: JSON.stringify({ message: "halo" }) })
      .reply(200, (opts) => {
        const headers = opts.headers as Record<string, string> | undefined;
        sawAuth = headers?.authorization;
        return { ok: true };
      });

    const res = await proxyToHub(jsonRequest({ message: "halo" }), BodySchema, "/v1/x");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sawAuth).toBeUndefined();
  });

  it("token diisi → diteruskan sebagai Authorization: Bearer <token>", async () => {
    process.env.ECORIONE_INTERNAL_TOKEN = "tok-123";
    let sawAuth: string | undefined;
    pool.intercept({ path: "/v1/x", method: "POST" }).reply(200, (opts) => {
      const headers = opts.headers as Record<string, string> | undefined;
      sawAuth = headers?.authorization;
      return { ok: true };
    });

    await proxyToHub(jsonRequest({ message: "halo" }), BodySchema, "/v1/x");
    expect(sawAuth).toBe("Bearer tok-123");
  });

  it("status & body error Hub diteruskan apa adanya, tidak diratakan jadi 500", async () => {
    pool
      .intercept({ path: "/v1/x", method: "POST" })
      .reply(409, { error: { type: "CONFLICT", message: "sudah ada" } });

    const res = await proxyToHub(jsonRequest({ message: "halo" }), BodySchema, "/v1/x");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { type: "CONFLICT", message: "sudah ada" } });
  });

  it("Hub tidak bisa dihubungi (jaringan) → 502 UPSTREAM_UNAVAILABLE, bukan exception mentah", async () => {
    pool.intercept({ path: "/v1/x", method: "POST" }).replyWithError(new Error("down"));

    const res = await proxyToHub(jsonRequest({ message: "halo" }), BodySchema, "/v1/x");
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: { type: string } }).error.type).toBe(
      "UPSTREAM_UNAVAILABLE",
    );
  });

  it("respons Hub kosong (mis. 204) tidak melempar saat parsing", async () => {
    pool.intercept({ path: "/v1/x", method: "POST" }).reply(204, "");

    const res = await proxyToHub(jsonRequest({ message: "halo" }), BodySchema, "/v1/x");
    expect(res.status).toBe(204);
  });
});
