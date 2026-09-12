import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("Ai favicon route", () => {
  it("serves a cacheable ecorione SVG at /favicon.ico", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");

    const body = await response.text();
    expect(body).toContain("<svg");
    expect(body).toContain("viewBox=\"0 0 64 64\"");
    expect(body).toContain("#a57f35");
  });
});
