import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_PROVIDER_ID,
  GoogleDriveConnectionStatusSchema,
  GoogleDriveOAuthStartRequestSchema,
  GoogleDriveOAuthStartResponseSchema,
  type GoogleDriveConnectionStatus,
  type GoogleDriveOAuthStartRequest,
  type GoogleDriveOAuthStartResponse,
} from "@ecorione/shared-schema";
import { z } from "zod";
import type { CredentialMetadata, CredentialVaultAdmin } from "./credential-vault.js";

export const GOOGLE_DRIVE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth" as const;
export const GOOGLE_DRIVE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token" as const;

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
const MIN_REFRESH_TOKEN_LENGTH = 16;

const GoogleDriveOAuthConfigSchema = z
  .object({
    clientId: z.string().trim().min(10).max(4096),
    redirectUri: z.string().url(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const redirect = new URL(value.redirectUri);
    const localHost = new Set(["localhost", "127.0.0.1", "[::1]"]).has(redirect.hostname);
    const secure = redirect.protocol === "https:";
    const localHttp = redirect.protocol === "http:" && localHost;
    if (!secure && !localHttp) {
      ctx.addIssue({
        code: "custom",
        path: ["redirectUri"],
        message: "Google OAuth redirect URI harus HTTPS kecuali localhost.",
      });
    }
    if (redirect.username || redirect.password || redirect.hash) {
      ctx.addIssue({
        code: "custom",
        path: ["redirectUri"],
        message: "Google OAuth redirect URI tidak boleh berisi credential atau fragment.",
      });
    }
  });

export type GoogleDriveOAuthConfig = z.infer<typeof GoogleDriveOAuthConfigSchema>;

interface PendingGoogleDriveOAuth {
  readonly workspaceId: string;
  readonly returnPath: string;
  readonly codeVerifier: string;
  readonly expiresAtMs: number;
}

export interface ConsumedGoogleDriveOAuthState {
  readonly workspaceId: string;
  readonly returnPath: string;
  readonly codeVerifier: string;
}

export class GoogleDriveOAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDriveOAuthStateError";
  }
}

export interface GoogleDriveOAuthStateStoreOptions {
  readonly ttlMs?: number | undefined;
  readonly now?: (() => number) | undefined;
  readonly randomBytes?: ((size: number) => Buffer) | undefined;
}

function codeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
}

export class GoogleDriveOAuthStateStore {
  private readonly pending = new Map<string, PendingGoogleDriveOAuth>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly randomBytes: (size: number) => Buffer;

  constructor(options: GoogleDriveOAuthStateStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_STATE_TTL_MS;
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs < 60_000 || this.ttlMs > 30 * 60_000) {
      throw new GoogleDriveOAuthStateError("OAuth state TTL harus 1-30 menit.");
    }
    this.now = options.now ?? Date.now;
    this.randomBytes = options.randomBytes ?? nodeRandomBytes;
  }

  begin(
    configInput: GoogleDriveOAuthConfig,
    requestInput: GoogleDriveOAuthStartRequest,
  ): GoogleDriveOAuthStartResponse {
    const config = GoogleDriveOAuthConfigSchema.parse(configInput);
    const request = GoogleDriveOAuthStartRequestSchema.parse(requestInput);
    const nowMs = this.now();
    this.pruneExpired(nowMs);

    const state = this.randomBytes(32).toString("base64url");
    const verifier = this.randomBytes(64).toString("base64url");
    if (state.length < 32 || verifier.length < 43 || verifier.length > 128) {
      throw new GoogleDriveOAuthStateError("Entropy OAuth/PKCE tidak memenuhi kontrak.");
    }
    if (this.pending.has(state)) {
      throw new GoogleDriveOAuthStateError("OAuth state collision; ulangi permintaan.");
    }

    const expiresAtMs = nowMs + this.ttlMs;
    this.pending.set(state, {
      workspaceId: request.workspaceId,
      returnPath: request.returnPath,
      codeVerifier: verifier,
      expiresAtMs,
    });

    const authorization = new URL(GOOGLE_DRIVE_AUTHORIZATION_ENDPOINT);
    authorization.searchParams.set("client_id", config.clientId);
    authorization.searchParams.set("redirect_uri", config.redirectUri);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("scope", GOOGLE_DRIVE_FILE_SCOPE);
    authorization.searchParams.set("access_type", "offline");
    authorization.searchParams.set("include_granted_scopes", "true");
    authorization.searchParams.set("prompt", "consent");
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("code_challenge", codeChallenge(verifier));
    authorization.searchParams.set("code_challenge_method", "S256");

    return GoogleDriveOAuthStartResponseSchema.parse({
      authorizationUrl: authorization.toString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
  }

  consume(state: string): ConsumedGoogleDriveOAuthState {
    if (state.length < 32 || state.length > 256) {
      throw new GoogleDriveOAuthStateError("OAuth state tidak valid.");
    }
    const pending = this.pending.get(state);
    if (pending === undefined) {
      throw new GoogleDriveOAuthStateError("OAuth state tidak ditemukan atau sudah dipakai.");
    }
    this.pending.delete(state);
    if (pending.expiresAtMs <= this.now()) {
      throw new GoogleDriveOAuthStateError("OAuth state sudah kedaluwarsa.");
    }
    return {
      workspaceId: pending.workspaceId,
      returnPath: pending.returnPath,
      codeVerifier: pending.codeVerifier,
    };
  }

  private pruneExpired(nowMs: number): void {
    for (const [state, pending] of this.pending) {
      if (pending.expiresAtMs <= nowMs) this.pending.delete(state);
    }
  }
}

export function googleDriveConnectionStatus(
  vault: Pick<CredentialVaultAdmin, "list">,
): GoogleDriveConnectionStatus {
  const metadata = vault
    .list()
    .find(
      (entry) =>
        entry.provider === GOOGLE_DRIVE_PROVIDER_ID &&
        entry.purpose === "tokens" &&
        entry.enabled,
    );
  return GoogleDriveConnectionStatusSchema.parse({
    provider: GOOGLE_DRIVE_PROVIDER_ID,
    connected: metadata !== undefined,
    scope: GOOGLE_DRIVE_FILE_SCOPE,
    updatedAt: metadata?.updatedAt ?? null,
  });
}

export function storeGoogleDriveRefreshToken(
  vault: Pick<CredentialVaultAdmin, "set">,
  refreshToken: string,
  updatedAt: string,
): CredentialMetadata {
  const token = refreshToken.trim();
  if (token.length < MIN_REFRESH_TOKEN_LENGTH) {
    throw new GoogleDriveOAuthStateError("Google refresh token kosong atau terlalu pendek.");
  }
  return vault.set(GOOGLE_DRIVE_PROVIDER_ID, "tokens", token, updatedAt);
}

export function disconnectGoogleDrive(
  vault: Pick<CredentialVaultAdmin, "remove">,
): boolean {
  return vault.remove(GOOGLE_DRIVE_PROVIDER_ID, "tokens");
}
