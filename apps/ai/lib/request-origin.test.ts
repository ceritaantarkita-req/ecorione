import { describe, expect, it } from "vitest";
import { checkRequestOrigin, parseAllowedOrigins } from "./request-origin";

const HOST = "127.0.0.1:3000";

function check(overrides: {
  method?: string;
  secFetchSite?: string | null;
  origin?: string | null;
  host?: string | null;
  allowedOrigins?: readonly string[];
}) {
  return checkRequestOrigin({
    method: overrides.method ?? "POST",
    secFetchSite: overrides.secFetchSite ?? null,
    origin: overrides.origin ?? null,
    host: overrides.host === undefined ? HOST : overrides.host,
    allowedOrigins: overrides.allowedOrigins,
  });
}

describe("checkRequestOrigin", () => {
  it("meloloskan method aman apa pun asalnya", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
      expect(
        check({ method, secFetchSite: "cross-site", origin: "https://evil.example" }).allowed,
      ).toBe(true);
    }
  });

  it("meloloskan mutasi same-origin", () => {
    expect(check({ secFetchSite: "same-origin" }).allowed).toBe(true);
  });

  it("menolak mutasi cross-site walau Origin tidak dikirim", () => {
    const verdict = check({ secFetchSite: "cross-site" });
    expect(verdict.allowed).toBe(false);
  });

  it("menolak same-site dan none — keduanya bukan same-origin", () => {
    expect(check({ secFetchSite: "same-site" }).allowed).toBe(false);
    expect(check({ secFetchSite: "none" }).allowed).toBe(false);
  });

  it("menolak serangan yang dibuktikan di audit 2026-09-14", () => {
    // PUT /api/settings/settings/runtime dari https://evil.example, text/plain,
    // tanpa token — sebelumnya membalas 200 dan memutasi localBaseUrl.
    const verdict = check({
      method: "PUT",
      secFetchSite: "cross-site",
      origin: "https://evil.example",
    });
    expect(verdict.allowed).toBe(false);
  });

  it("jatuh ke pengecekan Origin ketika Sec-Fetch-Site tidak ada", () => {
    expect(check({ origin: "http://127.0.0.1:3000" }).allowed).toBe(true);
    expect(check({ origin: "https://evil.example" }).allowed).toBe(false);
  });

  it("mencocokkan Origin tanpa memedulikan skema dan huruf besar-kecil", () => {
    expect(check({ origin: "https://127.0.0.1:3000" }).allowed).toBe(true);
    expect(check({ origin: "http://LOCALHOST:3000", host: "localhost:3000" }).allowed).toBe(
      true,
    );
  });

  it("menolak Origin yang bukan URL absolut", () => {
    expect(check({ origin: "null" }).allowed).toBe(false);
    expect(check({ origin: "" }).allowed).toBe(false);
  });

  it("menolak ketika Origin ada tapi Host tidak bisa ditentukan", () => {
    expect(check({ origin: "http://127.0.0.1:3000", host: null }).allowed).toBe(false);
  });

  it("meloloskan klien non-browser yang tidak mengirim kedua header", () => {
    expect(check({}).allowed).toBe(true);
  });

  it("menghormati daftar origin tambahan dari operator", () => {
    const allowedOrigins = ["https://ecorione.internal"];
    expect(
      check({ secFetchSite: "cross-site", origin: "https://ecorione.internal", allowedOrigins })
        .allowed,
    ).toBe(true);
    expect(
      check({ secFetchSite: "cross-site", origin: "https://evil.example", allowedOrigins })
        .allowed,
    ).toBe(false);
  });
});

describe("parseAllowedOrigins", () => {
  it("mengembalikan daftar kosong untuk nilai kosong", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
  });

  it("menormalkan dan membuang entri yang tidak valid", () => {
    expect(
      parseAllowedOrigins(" https://A.Example:443/path , bukan-url , ,http://b.example "),
    ).toEqual(["https://a.example", "http://b.example"]);
  });

  it("menolak skema non-HTTP", () => {
    expect(parseAllowedOrigins("file:///etc/passwd,chrome-extension://abc")).toEqual([]);
  });
});
