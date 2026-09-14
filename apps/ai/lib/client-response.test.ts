import { describe, expect, it } from "vitest";
import { readJson } from "./client-response";

describe("readJson", () => {
  it("returns successful JSON payloads", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(readJson<{ ok: boolean }>(response)).resolves.toEqual({ ok: true });
  });

  it("surfaces a structured owner/proxy error without raw HTTP payload noise", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Space tidak bisa dihubungi.",
        },
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );

    await expect(readJson(response)).rejects.toThrow("Space tidak bisa dihubungi.");
    await expect(
      readJson(
        new Response(
          JSON.stringify({ error: { message: "Space tidak bisa dihubungi." } }),
          { status: 502 },
        ),
      ),
    ).rejects.not.toThrow(/HTTP 502/);
  });

  it("uses a human-readable fallback for malformed upstream errors", async () => {
    const response = new Response("bad gateway", { status: 502 });

    await expect(readJson(response, "Space sedang tidak tersedia.")).rejects.toThrow(
      "Space sedang tidak tersedia.",
    );
  });
});
