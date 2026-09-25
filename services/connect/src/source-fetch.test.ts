import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXTERNAL_SOURCE_MAX_BYTES,
  fetchExternalUrl,
  type ExternalSourceFetchError,
} from "./source-fetch.js";

function resolver(
  ...addresses: string[]
): (hostname: string) => Promise<readonly { address: string; family: number }[]> {
  return async () =>
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }));
}

describe("external URL source fetch", () => {
  it("fetches a public HTTPS source with redirect + timeout guards", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("hello project", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }) as unknown as typeof fetch;

    const result = await fetchExternalUrl("https://docs.example/source.txt", {
      resolveHost: resolver("203.0.113.20"),
      fetchImpl,
    });

    expect(result).toMatchObject({
      url: "https://docs.example/source.txt",
      mimeType: "text/plain",
      sizeBytes: 13,
      contentBase64: Buffer.from("hello project").toString("base64"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects local/private URL targets before network fetch", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const privateLiteralResolver = vi.fn(resolver("127.0.0.1"));

    await expect(
      fetchExternalUrl("https://127.0.0.1/private", {
        resolveHost: privateLiteralResolver,
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "URL_SOURCE_BLOCKED",
    });
    expect(privateLiteralResolver).not.toHaveBeenCalled();

    await expect(
      fetchExternalUrl("https://public.example/rebind", {
        resolveHost: resolver("192.168.1.10"),
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "URL_SOURCE_BLOCKED",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects private IPv6 resolved addresses", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      fetchExternalUrl("https://public.example/private-v6", {
        resolveHost: resolver("fd00::5"),
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "URL_SOURCE_BLOCKED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enforces the bounded decompressed body size", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array(DEFAULT_EXTERNAL_SOURCE_MAX_BYTES + 1), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
    ) as unknown as typeof fetch;

    await expect(
      fetchExternalUrl("https://files.example/large.bin", {
        resolveHost: resolver("203.0.113.21"),
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      statusCode: 413,
      code: "URL_SOURCE_TOO_LARGE",
    });
  });

  it("maps timeout failures distinctly from other upstream failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }) as unknown as typeof fetch;

    await expect(
      fetchExternalUrl("https://slow.example/source", {
        resolveHost: resolver("203.0.113.22"),
        fetchImpl,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ExternalSourceFetchError>>({
        statusCode: 504,
        code: "URL_SOURCE_TIMEOUT",
      }),
    );
  });
});
