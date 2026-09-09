import { describe, expect, it } from "vitest";
import { bearerChallenge, protectedResourceMetadataUrl } from "./challenge.js";

describe("MCP OAuth WWW-Authenticate challenge", () => {
  it("resource dengan path memakai RFC 9728 path-specific metadata URL", () => {
    expect(protectedResourceMetadataUrl("https://edge.example/mcp")).toBe(
      "https://edge.example/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("resource root memakai root metadata URL", () => {
    expect(protectedResourceMetadataUrl("https://edge.example/")).toBe(
      "https://edge.example/.well-known/oauth-protected-resource",
    );
  });

  it("challenge mengiklankan metadata, least-privilege scope, dan error", () => {
    expect(
      bearerChallenge(
        { resource: "https://edge.example/mcp" },
        "memory:write",
        "insufficient_scope",
      ),
    ).toBe(
      'Bearer resource_metadata="https://edge.example/.well-known/oauth-protected-resource/mcp", scope="memory:write", error="insufficient_scope"',
    );
  });

  it("resource query/fragment ditolak agar metadata discovery tidak ambigu", () => {
    expect(() => protectedResourceMetadataUrl("https://edge.example/mcp?x=1")).toThrow(/query/);
    expect(() => protectedResourceMetadataUrl("https://edge.example/mcp#x")).toThrow(
      /fragment/,
    );
  });
});
