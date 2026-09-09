/** OAuth resource-server boundary for MCP Streamable HTTP. */
import { createPublicKey, verify as verifySignature } from "node:crypto";
import {
  ScopeSchema,
  SensitivitySchema,
  sensitivityRank,
  type Scope,
  type Sensitivity,
} from "@ecorione/shared-schema";
import { z } from "zod";

const JwtHeaderSchema = z.object({ alg: z.enum(["RS256", "ES256"]), kid: z.string().min(1) });
const JwtPayloadSchema = z.object({
  iss: z.string().url(),
  sub: z.string().min(1).max(256),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number().int().positive(),
  nbf: z.number().int().nonnegative().optional(),
  scope: z.union([z.string(), z.array(z.string())]).optional(),
  ecorione_scopes: z.array(ScopeSchema).optional(),
  ecorione_max_sensitivity: SensitivitySchema.optional(),
});
const JwksSchema = z.object({ keys: z.array(z.record(z.string(), z.unknown())).min(1) });

export interface McpAuthConfig {
  readonly issuer: string;
  readonly resource: string;
  readonly jwksUrl: string;
  readonly allowedOrigins: readonly string[];
  readonly defaultMemoryScopes: readonly Scope[];
  readonly defaultMaxSensitivity: Sensitivity;
  readonly fetchJson?: ((url: string) => Promise<unknown>) | undefined;
}

export interface AuthPrincipal {
  readonly id: string;
  readonly oauthScopes: ReadonlySet<string>;
  readonly memoryScopes: readonly Scope[];
  readonly maxSensitivity: Sensitivity;
}

export class McpAuthError extends Error {
  constructor(
    readonly statusCode: 401 | 403,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

function decodeJson(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new McpAuthError(401, "invalid_token", "JWT tidak dapat didekode.");
  }
}

function splitScopes(value: string | string[] | undefined): Set<string> {
  if (value === undefined) return new Set();
  const items = Array.isArray(value) ? value : value.split(/\s+/u);
  return new Set(items.map((item) => item.trim()).filter(Boolean));
}

function audienceIncludes(aud: string | string[], resource: string): boolean {
  return Array.isArray(aud) ? aud.includes(resource) : aud === resource;
}

function normalizeIssuer(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function defaultFetchJson(url: string): Promise<unknown> {
  return fetch(url, { headers: { accept: "application/json" } }).then(async (response) => {
    if (!response.ok) throw new Error(`JWKS endpoint membalas ${String(response.status)}.`);
    return response.json() as Promise<unknown>;
  });
}

export class JwksCache {
  private cached: {
    readonly expiresAtMs: number;
    readonly keys: readonly Record<string, unknown>[];
  } | null = null;

  constructor(
    private readonly config: McpAuthConfig,
    private readonly ttlMs: number = 5 * 60 * 1000,
  ) {}

  async keys(nowMs: number): Promise<readonly Record<string, unknown>[]> {
    if (this.cached !== null && this.cached.expiresAtMs > nowMs) return this.cached.keys;
    const raw = await (this.config.fetchJson ?? defaultFetchJson)(this.config.jwksUrl);
    const parsed = JwksSchema.parse(raw);
    this.cached = { expiresAtMs: nowMs + this.ttlMs, keys: parsed.keys };
    return parsed.keys;
  }
}

function verifyJwtSignature(
  signingInput: string,
  signature: Buffer,
  header: z.infer<typeof JwtHeaderSchema>,
  jwk: Record<string, unknown>,
): boolean {
  const key = createPublicKey({ key: jwk as never, format: "jwk" });
  if (header.alg === "RS256") {
    return verifySignature("RSA-SHA256", Buffer.from(signingInput, "utf8"), key, signature);
  }
  return verifySignature(
    "sha256",
    Buffer.from(signingInput, "utf8"),
    { key, dsaEncoding: "ieee-p1363" },
    signature,
  );
}

function narrowMemoryScopes(
  defaults: readonly Scope[],
  claimed: readonly Scope[] | undefined,
): Scope[] {
  const base = new Set(defaults);
  if (claimed === undefined) return [...base].sort();
  return [...new Set(claimed.filter((scope) => base.has(scope)))].sort();
}

function narrowSensitivity(
  defaultMax: Sensitivity,
  claimed: Sensitivity | undefined,
): Sensitivity {
  if (claimed === undefined) return defaultMax;
  return sensitivityRank(claimed) <= sensitivityRank(defaultMax) ? claimed : defaultMax;
}

export async function authenticateBearer(
  authorization: string | undefined,
  config: McpAuthConfig,
  jwks: JwksCache,
  nowMs: number,
): Promise<AuthPrincipal> {
  if (authorization === undefined || !authorization.startsWith("Bearer ")) {
    throw new McpAuthError(401, "invalid_token", "Bearer access token wajib.");
  }
  const token = authorization.slice("Bearer ".length).trim();
  const segments = token.split(".");
  if (segments.length !== 3)
    throw new McpAuthError(401, "invalid_token", "Access token harus JWT tiga segmen.");
  const header = JwtHeaderSchema.parse(decodeJson(segments[0]!));
  const payload = JwtPayloadSchema.parse(decodeJson(segments[1]!));

  if (normalizeIssuer(payload.iss) !== normalizeIssuer(config.issuer)) {
    throw new McpAuthError(
      401,
      "invalid_token",
      "Issuer token tidak cocok dengan authorization server MCP.",
    );
  }
  if (!audienceIncludes(payload.aud, config.resource)) {
    throw new McpAuthError(
      401,
      "invalid_token",
      "Audience/resource indicator token bukan ecorione MCP resource.",
    );
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  if (payload.exp <= nowSeconds || (payload.nbf !== undefined && payload.nbf > nowSeconds)) {
    throw new McpAuthError(
      401,
      "invalid_token",
      "Access token kedaluwarsa atau belum berlaku.",
    );
  }

  const keys = await jwks.keys(nowMs);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (jwk === undefined)
    throw new McpAuthError(401, "invalid_token", "JWK untuk kid token tidak ditemukan.");
  const signingInput = `${segments[0]!}.${segments[1]!}`;
  let signatureValid = false;
  try {
    signatureValid = verifyJwtSignature(
      signingInput,
      Buffer.from(segments[2]!, "base64url"),
      header,
      jwk,
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid)
    throw new McpAuthError(401, "invalid_token", "Signature JWT tidak valid.");

  const memoryScopes = narrowMemoryScopes(config.defaultMemoryScopes, payload.ecorione_scopes);
  if (memoryScopes.length === 0)
    throw new McpAuthError(
      403,
      "insufficient_scope",
      "Token tidak memiliki scope memori ecorione yang diizinkan deployment.",
    );
  return {
    id: payload.sub,
    oauthScopes: splitScopes(payload.scope),
    memoryScopes,
    maxSensitivity: narrowSensitivity(
      config.defaultMaxSensitivity,
      payload.ecorione_max_sensitivity,
    ),
  };
}

export function requireOAuthScope(principal: AuthPrincipal, scope: string): void {
  if (!principal.oauthScopes.has(scope)) {
    throw new McpAuthError(
      403,
      "insufficient_scope",
      `OAuth scope ${scope} wajib untuk tool ini.`,
    );
  }
}

export function validateOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): void {
  if (origin === undefined) return;
  if (!allowedOrigins.includes(origin)) {
    throw new McpAuthError(403, "origin_not_allowed", `Origin MCP tidak diizinkan: ${origin}`);
  }
}

export function protectedResourceMetadata(config: McpAuthConfig): Record<string, unknown> {
  return {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: ["memory:read", "memory:write", "memory:delete"],
    bearer_methods_supported: ["header"],
  };
}
