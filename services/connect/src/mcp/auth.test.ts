import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
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

  it("JWKS redirect ditolak sebagai trust-root escape", async () => {
    const originalDispatcher = getGlobalDispatcher();
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);

    try {
      const pool = agent.get("https://auth.example");
      let redirectedTargetHit = false;
      pool
        .intercept({ path: "/jwks", method: "GET" })
        .reply(302, "", { headers: { location: "/redirected" } });
      pool.intercept({ path: "/redirected", method: "GET" }).reply(200, () => {
        redirectedTargetHit = true;
        return { keys: [PUBLIC_JWK] };
      });

      const cfg: McpAuthConfig = { ...config(), fetchJson: undefined };
      await expect(new JwksCache(cfg).keys(NOW_MS)).rejects.toThrow();
      expect(redirectedTargetHit).toBe(false);
    } finally {
      setGlobalDispatcher(originalDispatcher);
    }
  });

  it("membatasi waktu tunggu default JWKS fetch dan memetakan timeout sebagai dependency failure", async () => {
    const originalDispatcher = getGlobalDispatcher();
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);

    try {
      const pool = agent.get("https://auth.example");
      pool
        .intercept({ path: "/jwks", method: "GET" })
        .reply(200, { keys: [PUBLIC_JWK] })
        .delay(250);

      const cfg: McpAuthConfig = { ...config(), fetchJson: undefined };
      await expect(
        new JwksCache(cfg, 5 * 60 * 1000, 30 * 1000, 25).keys(NOW_MS),
      ).rejects.toMatchObject({
        name: "McpAuthDependencyError",
        statusCode: 502,
      });
    } finally {
      setGlobalDispatcher(originalDispatcher);
    }
  });

  it("refreshes a still-fresh JWKS cache once when a rotated kid appears", async () => {
    let fetches = 0;
    const rotated = { ...PUBLIC_JWK, kid: "k2" };
    const cfg: McpAuthConfig = {
      ...config(),
      fetchJson: async () => {
        fetches += 1;
        return { keys: fetches === 1 ? [PUBLIC_JWK] : [rotated] };
      },
    };
    const cache = new JwksCache(cfg);

    expect((await cache.keyForKid("k1", NOW_MS))?.kid).toBe("k1");
    expect(fetches).toBe(1);
    expect((await cache.keyForKid("k2", NOW_MS + 1_000))?.kid).toBe("k2");
    expect(fetches).toBe(2);
  });

  it("keeps JWKS refresh outages as dependency failures during cooldown", async () => {
    let fetches = 0;
    const cfg: McpAuthConfig = {
      ...config(),
      fetchJson: async () => {
        fetches += 1;
        if (fetches === 1) return { keys: [PUBLIC_JWK] };
        throw new Error("authorization server unavailable");
      },
    };
    const cache = new JwksCache(cfg, 5 * 60 * 1000, 30 * 1000);

    expect((await cache.keyForKid("k1", NOW_MS))?.kid).toBe("k1");
    await expect(cache.keyForKid("rotated-kid", NOW_MS + 1_000)).rejects.toMatchObject({
      name: "McpAuthDependencyError",
      statusCode: 502,
    });
    expect(fetches).toBe(2);

    await expect(cache.keyForKid("another-kid", NOW_MS + 2_000)).rejects.toMatchObject({
      name: "McpAuthDependencyError",
      statusCode: 502,
    });
    expect(fetches).toBe(2);
  });

  it("throttles repeated unknown-kid refreshes inside the cooldown", async () => {
    let fetches = 0;
    const cfg: McpAuthConfig = {
      ...config(),
      fetchJson: async () => {
        fetches += 1;
        return { keys: [PUBLIC_JWK] };
      },
    };
    const cache = new JwksCache(cfg, 5 * 60 * 1000, 30 * 1000);

    expect((await cache.keyForKid("k1", NOW_MS))?.kid).toBe("k1");
    expect(await cache.keyForKid("missing-1", NOW_MS + 1_000)).toBeUndefined();
    expect(fetches).toBe(2);
    expect(await cache.keyForKid("missing-2", NOW_MS + 2_000)).toBeUndefined();
    expect(fetches).toBe(2);
  });

  it("malformed JWT schema diklasifikasikan sebagai 401 invalid_token", async () => {
    const cfg = config();
    const parts = jwt().split(".");
    const invalidHeader = Buffer.from(
      JSON.stringify({ alg: "HS256", kid: "k1", typ: "JWT" }),
    ).toString("base64url");

    await expect(
      authenticateBearer(
        `Bearer ${invalidHeader}.${parts[1]!}.${parts[2]!}`,
        cfg,
        new JwksCache(cfg),
        NOW_MS,
      ),
    ).rejects.toMatchObject({
      name: "McpAuthError",
      statusCode: 401,
      code: "invalid_token",
    });
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
