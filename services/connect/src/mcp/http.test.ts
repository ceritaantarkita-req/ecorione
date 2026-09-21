import { randomBytes } from "node:crypto";
import { MCP_PROTOCOL_VERSION } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { buildMcpHttpServer, mcpAuthConfig } from "./http.js";

const RESOURCE = "https://edge.example/mcp";
const ORIGIN = "https://client.example";

function body(method = "server/discover", params: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0",
    id: "req-1",
    method,
    params: {
      ...params,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientInfo": { name: "http-test", version: "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

function app() {
  return buildMcpHttpServer({
    hubUrl: "http://127.0.0.1:17024",
    handleKey: randomBytes(32),
    auth: mcpAuthConfig({
      issuer: "https://auth.example",
      resource: RESOURCE,
      jwksUrl: "https://auth.example/jwks",
      allowedOrigins: [ORIGIN],
      defaultMemoryScopes: ["personal"],
      defaultMaxSensitivity: "INTERNAL",
    }),
  });
}

function headers(method: string, name?: string) {
  return {
    origin: ORIGIN,
    "content-type": "application/json",
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    "mcp-method": method,
    ...(name === undefined ? {} : { "mcp-name": name }),
  };
}

function syntacticallyValidBearer(): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://auth.example",
      sub: "user-1",
      aud: RESOURCE,
      exp: 4_102_444_800,
      scope: "memory:read",
    }),
  ).toString("base64url");
  return `Bearer ${header}.${payload}.c2ln`;
}

describe("Connect MCP HTTP", () => {
  it("401 mengiklankan protected resource metadata dan read scope", async () => {
    const server = app();
    const response = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: headers("server/discover"),
      payload: body(),
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toContain(
      'resource_metadata="https://edge.example/.well-known/oauth-protected-resource/mcp"',
    );
    expect(response.headers["www-authenticate"]).toContain('scope="memory:read"');
    expect(response.headers["www-authenticate"]).toContain('error="invalid_token"');
    await server.close();
  });

  it("tools/call unauthenticated mengiklankan least-privilege write scope", async () => {
    const server = app();
    const response = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: headers("tools/call", "memory_propose"),
      payload: body("tools/call", { name: "memory_propose", arguments: {} }),
    });
    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toContain('scope="memory:write"');
    await server.close();
  });

  it("protected resource metadata path mengembalikan resource dan authorization server", async () => {
    const server = app();
    const response = await server.inject({
      method: "GET",
      url: "/.well-known/oauth-protected-resource/mcp",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      resource: RESOURCE,
      authorization_servers: ["https://auth.example"],
    });
    await server.close();
  });

  it("JWKS dependency failure dibalas 502 tanpa bearer challenge atau detail upstream mentah", async () => {
    const server = buildMcpHttpServer({
      hubUrl: "http://127.0.0.1:17024",
      handleKey: randomBytes(32),
      auth: {
        ...mcpAuthConfig({
          issuer: "https://auth.example",
          resource: RESOURCE,
          jwksUrl: "https://auth.example/jwks",
          allowedOrigins: [ORIGIN],
          defaultMemoryScopes: ["personal"],
          defaultMaxSensitivity: "INTERNAL",
        }),
        fetchJson: async () => {
          throw new Error("private upstream diagnostic");
        },
      },
    });
    const response = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        ...headers("server/discover"),
        authorization: syntacticallyValidBearer(),
      },
      payload: body(),
    });

    expect(response.statusCode).toBe(502);
    expect(response.headers["www-authenticate"]).toBeUndefined();
    expect(response.json()).toMatchObject({
      error: { code: -32603 },
    });
    expect(response.body).not.toContain("private upstream diagnostic");
    await server.close();
  });

  it("origin yang tidak diizinkan fail-closed sebelum token/JWKS", async () => {
    const server = app();
    const response = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: {
        ...headers("server/discover"),
        origin: "https://evil.example",
      },
      payload: body(),
    });
    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("Mcp-Method mismatch ditolak 400 sebelum auth", async () => {
    const server = app();
    const response = await server.inject({
      method: "POST",
      url: "/mcp",
      headers: headers("tools/list"),
      payload: body("server/discover"),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/Mcp-Method/);
    await server.close();
  });
});
