import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  JwksCache,
  McpAuthError,
  authenticateBearer,
  requireOAuthScope,
  type McpAuthConfig,
} from "./auth.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PUBLIC_JWK = {
  ...publicKey.export({ format: "jwk" }),
  kid: "k1",
  alg: "RS256",
  use: "sig",
};
const NOW_MS = 1_800_000_000_000;

function jwt(overrides: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://auth.example",
      sub: "user-1",
      aud: "https://memory.example/mcp",
      exp: Math.floor(NOW_MS / 1000) + 600,
      scope: "memory:read memory:write",
      ecorione_scopes: ["personal"],
      ecorione_max_sensitivity: "INTERNAL",
      ...overrides,
    }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  return `${input}.${signature}`;
}

function config(): McpAuthConfig {
  return {
    issuer: "https://auth.example",
    resource: "https://memory.example/mcp",
    jwksUrl: "https://auth.example/jwks",
    allowedOrigins: ["https://app.example"],
    defaultMemoryScopes: ["personal", "work"],
    defaultMaxSensitivity: "SENSITIVE",
    fetchJson: async () => ({ keys: [PUBLIC_JWK] }),
  };
}

describe("MCP OAuth resource server", () => {
  it("memvalidasi signature + issuer + audience/resource + scopes", async () => {
    const cfg = config();
    const principal = await authenticateBearer(
      `Bearer ${jwt()}`,
      cfg,
      new JwksCache(cfg),
      NOW_MS,
    );
    expect(principal.id).toBe("user-1");
    expect(principal.memoryScopes).toEqual(["personal"]);
    expect(principal.maxSensitivity).toBe("INTERNAL");
    expect(() => requireOAuthScope(principal, "memory:read")).not.toThrow();
  });

  it("menolak token dengan audience lain (anti token passthrough)", async () => {
    const cfg = config();
    await expect(
      authenticateBearer(
        `Bearer ${jwt({ aud: "https://other.example" })}`,
        cfg,
        new JwksCache(cfg),
        NOW_MS,
      ),
    ).rejects.toBeInstanceOf(McpAuthError);
  });

  it("scope OAuth write tidak bisa dipalsukan dari memory scope", async () => {
    const cfg = config();
    const principal = await authenticateBearer(
      `Bearer ${jwt({ scope: "memory:read" })}`,
      cfg,
      new JwksCache(cfg),
      NOW_MS,
    );
    expect(() => requireOAuthScope(principal, "memory:write")).toThrow(/memory:write/);
  });
});
