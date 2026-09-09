/** AEAD-bound MCP handles and requestState. No hidden protocol session state. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { McpDeliverySchema, ScopeSchema, SensitivitySchema } from "@ecorione/shared-schema";

const HANDLE_VERSION = "h1";
const AAD_HANDLE = Buffer.from("ecorione:mcp:handle:v1", "utf8");
const AAD_STATE = Buffer.from("ecorione:mcp:request-state:v1", "utf8");
const DEFAULT_HANDLE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

const HandleClaimsSchema = z.object({
  principalId: z.string().min(1).max(256),
  allowedScopes: z.array(ScopeSchema).min(1).max(64),
  maxSensitivity: SensitivitySchema,
  delivery: McpDeliverySchema,
  issuedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().positive(),
});
export type HandleClaims = z.infer<typeof HandleClaimsSchema>;

const RequestStateEnvelopeSchema = z.object({
  principalId: z.string().min(1).max(256),
  requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  issuedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().positive(),
  state: z.unknown(),
});

export class InvalidMcpHandleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMcpHandleError";
  }
}

export function parseHandleKey(raw: string | undefined): Buffer {
  if (raw === undefined || raw.trim() === "") return randomBytes(32);
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64url");
  } catch {
    throw new InvalidMcpHandleError("ECORIONE_MCP_HANDLE_KEY harus base64url 32-byte.");
  }
  if (key.length !== 32)
    throw new InvalidMcpHandleError("ECORIONE_MCP_HANDLE_KEY harus tepat 32 byte.");
  return key;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

export function requestDigest(request: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(request)))
    .digest("hex");
}

function sealJson(key: Buffer, value: unknown, aad: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    HANDLE_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function openJson(key: Buffer, token: string, aad: Buffer): unknown {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== HANDLE_VERSION)
    throw new InvalidMcpHandleError("Format handle tidak valid.");
  try {
    const iv = Buffer.from(parts[1]!, "base64url");
    const ciphertext = Buffer.from(parts[2]!, "base64url");
    const tag = Buffer.from(parts[3]!, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof InvalidMcpHandleError) throw error;
    throw new InvalidMcpHandleError("Handle gagal diverifikasi (AEAD/tag tidak cocok).");
  }
}

export function mintHandle(
  key: Buffer,
  claims: Omit<HandleClaims, "issuedAtMs" | "expiresAtMs">,
  nowMs: number,
  ttlMs: number = DEFAULT_HANDLE_TTL_MS,
): string {
  const parsed = HandleClaimsSchema.parse({
    ...claims,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  });
  return sealJson(key, parsed, AAD_HANDLE);
}

export function openHandle(
  key: Buffer,
  token: string,
  principalId: string,
  nowMs: number,
): HandleClaims {
  const claims = HandleClaimsSchema.parse(openJson(key, token, AAD_HANDLE));
  if (claims.principalId !== principalId)
    throw new InvalidMcpHandleError("Handle terikat principal lain.");
  if (claims.expiresAtMs <= nowMs) throw new InvalidMcpHandleError("Handle sudah kedaluwarsa.");
  return claims;
}

export function sealRequestState(
  key: Buffer,
  principalId: string,
  request: unknown,
  state: unknown,
  nowMs: number,
  ttlMs: number = DEFAULT_STATE_TTL_MS,
): string {
  const envelope = RequestStateEnvelopeSchema.parse({
    principalId,
    requestDigest: requestDigest(request),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
    state,
  });
  return sealJson(key, envelope, AAD_STATE);
}

export function openRequestState<T>(
  key: Buffer,
  token: string,
  principalId: string,
  request: unknown,
  nowMs: number,
): T {
  const envelope = RequestStateEnvelopeSchema.parse(openJson(key, token, AAD_STATE));
  if (envelope.principalId !== principalId)
    throw new InvalidMcpHandleError("requestState terikat principal lain.");
  if (envelope.expiresAtMs <= nowMs)
    throw new InvalidMcpHandleError("requestState sudah kedaluwarsa.");
  if (envelope.requestDigest !== requestDigest(request))
    throw new InvalidMcpHandleError("requestState tidak cocok dengan request yang diulang.");
  return envelope.state as T;
}
