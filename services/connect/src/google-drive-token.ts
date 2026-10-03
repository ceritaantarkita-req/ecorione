import { z } from "zod";
import { GOOGLE_DRIVE_FILE_SCOPE } from "@ecorione/shared-schema";
import {
  GOOGLE_DRIVE_TOKEN_ENDPOINT,
  GoogleDriveOAuthConfigSchema,
  type GoogleDriveOAuthConfig,
} from "./google-drive-oauth.js";

export const GOOGLE_DRIVE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke" as const;
export const DEFAULT_GOOGLE_DRIVE_OAUTH_TIMEOUT_MS = 15_000;
const MAX_OAUTH_RESPONSE_BYTES = 64 * 1024;

const RevocationErrorSchema = z
  .object({
    error: z.string().min(1).max(128),
  })
  .passthrough();

const TokenResponseSchema = z
  .object({
    access_token: z.string().min(1).max(32_768),
    expires_in: z
      .number()
      .int()
      .positive()
      .max(7 * 24 * 60 * 60),
    refresh_token: z.string().min(16).max(32_768).optional(),
    scope: z.string().max(8192).optional(),
    token_type: z.string().min(1).max(64),
  })
  .passthrough();

export interface GoogleDriveAccessToken {
  readonly accessToken: string;
  readonly refreshToken?: string | undefined;
  readonly expiresInSeconds: number;
  readonly scope?: string | undefined;
}

export interface GoogleDriveOAuthTransportResponse {
  readonly statusCode: number;
  readonly bodyText: string;
}

export type GoogleDriveOAuthTransport = (
  url: typeof GOOGLE_DRIVE_TOKEN_ENDPOINT | typeof GOOGLE_DRIVE_REVOKE_ENDPOINT,
  form: URLSearchParams,
  timeoutMs: number,
) => Promise<GoogleDriveOAuthTransportResponse>;

export class GoogleDriveOAuthUpstreamError extends Error {
  constructor(
    readonly statusCode: 502 | 503 | 504,
    readonly code:
      | "GOOGLE_DRIVE_OAUTH_REJECTED"
      | "GOOGLE_DRIVE_OAUTH_UNAVAILABLE"
      | "GOOGLE_DRIVE_OAUTH_TIMEOUT"
      | "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "GoogleDriveOAuthUpstreamError";
  }
}

async function readBoundedText(response: Response): Promise<string> {
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > MAX_OAUTH_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new GoogleDriveOAuthUpstreamError(
        502,
        "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
        "Google OAuth mengembalikan respons terlalu besar.",
      );
    }
    chunks.push(next.value);
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total,
  ).toString("utf8");
}

async function defaultTransport(
  url: typeof GOOGLE_DRIVE_TOKEN_ENDPOINT | typeof GOOGLE_DRIVE_REVOKE_ENDPOINT,
  form: URLSearchParams,
  timeoutMs: number,
): Promise<GoogleDriveOAuthTransportResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
        "user-agent": "ECORIONE-GoogleDrive/1.0",
      },
      body: form.toString(),
      signal: controller.signal,
    });
    return {
      statusCode: response.status,
      bodyText: await readBoundedText(response),
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GoogleDriveOAuthUpstreamError(
        504,
        "GOOGLE_DRIVE_OAUTH_TIMEOUT",
        "Google OAuth melewati batas waktu.",
      );
    }
    if (error instanceof GoogleDriveOAuthUpstreamError) throw error;
    throw new GoogleDriveOAuthUpstreamError(
      503,
      "GOOGLE_DRIVE_OAUTH_UNAVAILABLE",
      "Google OAuth tidak dapat dijangkau.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function scopeIsDriveFileOnly(scope: string | undefined): boolean {
  if (scope === undefined) return true;
  const scopes = scope.split(/\s+/u).filter((candidate) => candidate.length > 0);
  return scopes.length === 1 && scopes[0] === GOOGLE_DRIVE_FILE_SCOPE;
}

function parseTokenResponse(
  response: GoogleDriveOAuthTransportResponse,
): GoogleDriveAccessToken {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new GoogleDriveOAuthUpstreamError(
      502,
      "GOOGLE_DRIVE_OAUTH_REJECTED",
      "Google OAuth menolak pertukaran credential.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.bodyText) as unknown;
  } catch {
    throw new GoogleDriveOAuthUpstreamError(
      502,
      "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
      "Respons token Google OAuth bukan JSON valid.",
    );
  }
  const result = TokenResponseSchema.safeParse(parsed);
  if (!result.success || result.data.token_type.toLowerCase() !== "bearer") {
    throw new GoogleDriveOAuthUpstreamError(
      502,
      "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
      "Respons token Google OAuth tidak sesuai kontrak.",
    );
  }
  if (!scopeIsDriveFileOnly(result.data.scope)) {
    throw new GoogleDriveOAuthUpstreamError(
      502,
      "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
      "Google OAuth mengembalikan scope di luar Drive file yang diwajibkan.",
    );
  }
  return {
    accessToken: result.data.access_token,
    ...(result.data.refresh_token === undefined
      ? {}
      : { refreshToken: result.data.refresh_token }),
    expiresInSeconds: result.data.expires_in,
    ...(result.data.scope === undefined ? {} : { scope: result.data.scope }),
  };
}

export interface GoogleDriveOAuthClientOptions {
  readonly transport?: GoogleDriveOAuthTransport | undefined;
  readonly timeoutMs?: number | undefined;
}

export class GoogleDriveOAuthClient {
  private readonly config: GoogleDriveOAuthConfig;
  private readonly transport: GoogleDriveOAuthTransport;
  private readonly timeoutMs: number;

  constructor(config: GoogleDriveOAuthConfig, options: GoogleDriveOAuthClientOptions = {}) {
    this.config = GoogleDriveOAuthConfigSchema.parse(config);
    this.transport = options.transport ?? defaultTransport;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_GOOGLE_DRIVE_OAUTH_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(this.timeoutMs) ||
      this.timeoutMs < 1_000 ||
      this.timeoutMs > 60_000
    ) {
      throw new GoogleDriveOAuthUpstreamError(
        503,
        "GOOGLE_DRIVE_OAUTH_UNAVAILABLE",
        "Google OAuth timeout config di luar batas 1-60 detik.",
      );
    }
  }

  async exchangeAuthorizationCode(
    authorizationCode: string,
    codeVerifier: string,
  ): Promise<GoogleDriveAccessToken> {
    if (authorizationCode.length < 1 || authorizationCode.length > 4096) {
      throw new GoogleDriveOAuthUpstreamError(
        502,
        "GOOGLE_DRIVE_OAUTH_REJECTED",
        "Authorization code Google OAuth tidak valid.",
      );
    }
    if (codeVerifier.length < 43 || codeVerifier.length > 128) {
      throw new GoogleDriveOAuthUpstreamError(
        502,
        "GOOGLE_DRIVE_OAUTH_REJECTED",
        "PKCE verifier Google OAuth tidak valid.",
      );
    }
    const form = new URLSearchParams({
      client_id: this.config.clientId,
      code: authorizationCode,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    });
    if (this.config.clientSecret !== undefined) {
      form.set("client_secret", this.config.clientSecret);
    }
    return parseTokenResponse(
      await this.transport(GOOGLE_DRIVE_TOKEN_ENDPOINT, form, this.timeoutMs),
    );
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleDriveAccessToken> {
    if (refreshToken.length < 16 || refreshToken.length > 32_768) {
      throw new GoogleDriveOAuthUpstreamError(
        502,
        "GOOGLE_DRIVE_OAUTH_REJECTED",
        "Refresh token Google OAuth tidak valid.",
      );
    }
    const form = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    if (this.config.clientSecret !== undefined) {
      form.set("client_secret", this.config.clientSecret);
    }
    return parseTokenResponse(
      await this.transport(GOOGLE_DRIVE_TOKEN_ENDPOINT, form, this.timeoutMs),
    );
  }

  async revoke(refreshToken: string): Promise<void> {
    if (refreshToken.length < 16 || refreshToken.length > 32_768) {
      throw new GoogleDriveOAuthUpstreamError(
        502,
        "GOOGLE_DRIVE_OAUTH_REJECTED",
        "Refresh token Google OAuth tidak valid.",
      );
    }
    const response = await this.transport(
      GOOGLE_DRIVE_REVOKE_ENDPOINT,
      new URLSearchParams({ token: refreshToken }),
      this.timeoutMs,
    );
    if (response.statusCode === 200) return;

    if (response.statusCode === 400) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.bodyText) as unknown;
      } catch {
        parsed = undefined;
      }
      const revocationError = RevocationErrorSchema.safeParse(parsed);
      if (revocationError.success && revocationError.data.error === "invalid_token") {
        return;
      }
    }

    throw new GoogleDriveOAuthUpstreamError(
      502,
      "GOOGLE_DRIVE_OAUTH_REJECTED",
      "Google OAuth menolak pencabutan credential.",
    );
  }
}
