import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXTERNAL_SOURCE_MAX_BYTES,
  ExternalSourceFetchError,
  fetchExternalUrl,
  type ExternalSourceTransport,
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

function body(...chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

describe("external URL source fetch", () => {
  it("fetches a public HTTPS source through the exact validated DNS addresses", async () => {
    const transport = vi.fn(
      async (_url: URL, addresses: readonly { address: string; family: number }[]) => {
        expect(addresses).toEqual([{ address: "203.0.113.20", family: 4 }]);
        return {
          statusCode: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
          body: body(Buffer.from("hello project")),
        };
      },
    ) as unknown as ExternalSourceTransport;

    const result = await fetchExternalUrl("https://docs.example/source.txt", {
      resolveHost: resolver("203.0.113.20"),
      transport,
    });

    expect(result).toMatchObject({
      url: "https://docs.example/source.txt",
      mimeType: "text/plain",
      sizeBytes: 13,
      contentBase64: Buffer.from("hello project").toString("base64"),
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("rejects local/private URL targets before opening the transport", async () => {
    const transport = vi.fn() as unknown as ExternalSourceTransport;

    await expect(
      fetchExternalUrl("https://127.0.0.1/private", {
        resolveHost: resolver("127.0.0.1"),
        transport,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "URL_SOURCE_BLOCKED",
    });

    await expect(
      fetchExternalUrl("https://public.example/rebind", {
        resolveHost: resolver("192.168.1.10"),
        transport,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "URL_SOURCE_BLOCKED",
    });

    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects private IPv6 resolved addresses before opening the transport", async () => {
    const transport = vi.fn() as unknown as ExternalSourceTransport;
    await expect(
      fetchExternalUrl("https://public.example/private-v6", {
        resolveHost: resolver("fd00::5"),
        transport,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "URL_SOURCE_BLOCKED",
    });
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not follow redirect responses", async () => {
    const destroy = vi.fn();
    const transport: ExternalSourceTransport = async () => ({
      statusCode: 302,
      headers: { location: "https://other.example/target" },
      body: body(),
      destroy,
    });

    await expect(
      fetchExternalUrl("https://docs.example/redirect", {
        resolveHost: resolver("203.0.113.21"),
        transport,
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "URL_SOURCE_UNAVAILABLE",
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("enforces the bounded decompressed body size", async () => {
    const destroy = vi.fn();
    const transport: ExternalSourceTransport = async () => ({
      statusCode: 200,
      headers: { "content-type": "application/octet-stream" },
      body: body(new Uint8Array(DEFAULT_EXTERNAL_SOURCE_MAX_BYTES + 1)),
      destroy,
    });

    await expect(
      fetchExternalUrl("https://files.example/large.bin", {
        resolveHost: resolver("203.0.113.22"),
        transport,
      }),
    ).rejects.toMatchObject({
      statusCode: 413,
      code: "URL_SOURCE_TOO_LARGE",
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("maps timeout failures distinctly from other upstream failures", async () => {
    const transport: ExternalSourceTransport = async () => {
      throw new ExternalSourceFetchError(
        504,
        "URL_SOURCE_TIMEOUT",
        "URL source melewati batas waktu fetch.",
      );
    };

    await expect(
      fetchExternalUrl("https://slow.example/source", {
        resolveHost: resolver("203.0.113.23"),
        transport,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ExternalSourceFetchError>>({
        statusCode: 504,
        code: "URL_SOURCE_TIMEOUT",
      }),
    );
  });
});
