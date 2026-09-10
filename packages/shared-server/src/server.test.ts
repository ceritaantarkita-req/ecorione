import { describe, expect, it } from "vitest";
import { createServer } from "./server.js";
import { BadRequestError, NotFoundError } from "./errors.js";

describe("createServer", () => {
  it("melayani /healthz tanpa token, bahkan saat auth aktif", async () => {
    const app = createServer({ name: "test-svc", token: "secret" });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", service: "test-svc" });
  });

  it("menolak request tanpa token yang benar saat auth aktif", async () => {
    const app = createServer({ name: "test-svc", token: "secret" });
    app.get("/protected", async () => ({ ok: true }));

    const missing = await app.inject({ method: "GET", url: "/protected" });
    expect(missing.statusCode).toBe(401);
    expect(missing.json().error.type).toBe("UNAUTHORIZED");

    const wrong = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.statusCode).toBe(401);
  });

  it("meloloskan request dengan token yang benar", async () => {
    const app = createServer({ name: "test-svc", token: "secret" });
    app.get("/protected", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer secret" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("tidak mengecek auth sama sekali kalau token tidak dikonfigurasi", async () => {
    const app = createServer({ name: "test-svc" });
    app.get("/protected", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(200);
  });

  it("memetakan HttpError ke status code dan bentuk body yang benar", async () => {
    const app = createServer({ name: "test-svc" });
    app.get("/boom", async () => {
      throw new BadRequestError("input jelek", { field: "x" });
    });

    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { type: "BAD_REQUEST", message: "input jelek", detail: { field: "x" } },
    });
  });

  it("memetakan NotFoundError ke 404", async () => {
    const app = createServer({ name: "test-svc" });
    app.get("/missing", async () => {
      throw new NotFoundError("tidak ada");
    });

    const res = await app.inject({ method: "GET", url: "/missing" });
    expect(res.statusCode).toBe(404);
  });

  it("route yang tidak terdaftar menghasilkan 404 terstruktur", async () => {
    const app = createServer({ name: "test-svc" });
    const res = await app.inject({ method: "GET", url: "/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.type).toBe("NOT_FOUND");
  });

  it("error tak terduga jadi 500 tanpa membocorkan detail internal", async () => {
    const app = createServer({ name: "test-svc" });
    app.get("/crash", async () => {
      throw new Error("detail internal rahasia");
    });

    const res = await app.inject({ method: "GET", url: "/crash" });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.message).toBe("Kesalahan internal service.");
    expect(res.body).not.toContain("detail internal rahasia");
  });

  it("menyertakan request id aman dari klien di error body", async () => {
    const app = createServer({ name: "test-svc" });
    app.get("/missing", async () => {
      throw new NotFoundError("tidak ada");
    });

    const res = await app.inject({
      method: "GET",
      url: "/missing",
      headers: { "x-request-id": "req-fixed-123" },
    });
    expect(res.json().requestId).toBe("req-fixed-123");
  });

  it("mengganti request id berkarakter kontrol agar tidak menjadi log/header injection", async () => {
    const app = createServer({ name: "test-svc" });
    const res = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { "x-request-id": "bad id with spaces" },
    });
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("menambahkan response security headers pada service boundary", async () => {
    const app = createServer({ name: "test-svc" });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("rate limit fail-closed dengan Retry-After tetapi health check tetap exempt", async () => {
    const app = createServer({
      name: "test-svc",
      rateLimit: { max: 2, windowMs: 60_000 },
    });
    app.get("/limited", async () => ({ ok: true }));

    expect((await app.inject({ method: "GET", url: "/limited" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/limited" })).statusCode).toBe(200);
    const limited = await app.inject({ method: "GET", url: "/limited" });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.json().error.type).toBe("RATE_LIMITED");
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
  });
});
