import { describe, expect, it } from "vitest";
import { resolvePublicHttpsEndpoint } from "./public-https-transport.js";
import type { PublicHttpsEndpointError } from "./public-https-transport.js";

const publicDns = async () => [{ address: "8.8.8.8", family: 4 }] as const;

describe("custom provider public HTTPS boundary", () => {
  it("accepts public HTTPS and returns pinned DNS candidates", async () => {
    await expect(
      resolvePublicHttpsEndpoint("https://api.example.com/v1", publicDns),
    ).resolves.toMatchObject({
      url: expect.objectContaining({ protocol: "https:", hostname: "api.example.com" }),
      addresses: [{ address: "8.8.8.8", family: 4 }],
    });
  });

  it.each([
    "http://api.example.com/v1",
    "https://user:pass@api.example.com/v1",
    "https://127.0.0.1/v1",
    "https://localhost/v1",
  ])("blocks unsafe endpoint %s", async (url) => {
    await expect(resolvePublicHttpsEndpoint(url, publicDns)).rejects.toMatchObject({
      name: "PublicHttpsEndpointError",
      code: "CUSTOM_PROVIDER_URL_BLOCKED",
    } satisfies Partial<PublicHttpsEndpointError>);
  });

  it("blocks DNS rebinding to private addresses", async () => {
    await expect(
      resolvePublicHttpsEndpoint("https://api.example.com/v1", async () => [
        { address: "10.0.0.7", family: 4 },
      ]),
    ).rejects.toMatchObject({
      code: "CUSTOM_PROVIDER_URL_BLOCKED",
    });
  });

  it("fails explicitly when DNS is unavailable", async () => {
    await expect(
      resolvePublicHttpsEndpoint("https://api.example.com/v1", async () => {
        throw new Error("dns down");
      }),
    ).rejects.toMatchObject({
      code: "CUSTOM_PROVIDER_DNS_UNAVAILABLE",
    });
  });
});
