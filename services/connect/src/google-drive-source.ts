import {
  DEFAULT_WORKSPACE_ID,
  GOOGLE_DRIVE_PROVIDER_ID,
  GoogleDriveFileFetchResponseSchema,
  GoogleDriveFileIdSchema,
  MAX_GOOGLE_DRIVE_SOURCE_BYTES,
  type GoogleDriveFileFetchResponse,
} from "@ecorione/shared-schema";
import { z } from "zod";
import type { ProviderCredentialReader } from "./credential-vault.js";
import {
  GoogleDriveOAuthUpstreamError,
  type GoogleDriveAccessToken,
  type GoogleDriveOAuthClient,
} from "./google-drive-token.js";

export const GOOGLE_DRIVE_API_ORIGIN = "https://www.googleapis.com" as const;
export const DEFAULT_GOOGLE_DRIVE_API_TIMEOUT_MS = 15_000;
const MAX_METADATA_BYTES = 64 * 1024;

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDE_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_DRAWING_MIME = "application/vnd.google-apps.drawing";
const GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps.";

const GoogleDriveMetadataSchema = z
  .object({
    id: GoogleDriveFileIdSchema,
    name: z.string().trim().min(1).max(1024),
    mimeType: z.string().trim().min(1).max(255),
    size: z.string().regex(/^\d+$/u).optional(),
    modifiedTime: z.string().datetime({ offset: false }).optional(),
    capabilities: z
      .object({
        canDownload: z.boolean(),
      })
      .strict(),
  })
  .passthrough();

export interface GoogleDriveApiTransportResponse {
  readonly statusCode: number;
  readonly body: Uint8Array;
}

export type GoogleDriveApiTransport = (
  url: URL,
  accessToken: string,
  timeoutMs: number,
  maxBytes: number,
) => Promise<GoogleDriveApiTransportResponse>;

export class GoogleDriveSourceError extends Error {
  constructor(
    readonly statusCode: 403 | 404 | 409 | 413 | 415 | 502 | 503 | 504,
    readonly code:
      | "GOOGLE_DRIVE_NOT_CONNECTED"
      | "GOOGLE_DRIVE_FILE_NOT_FOUND"
      | "GOOGLE_DRIVE_FILE_DOWNLOAD_DENIED"
      | "GOOGLE_DRIVE_FILE_TOO_LARGE"
      | "GOOGLE_DRIVE_FILE_UNSUPPORTED"
      | "GOOGLE_DRIVE_API_INVALID_RESPONSE"
      | "GOOGLE_DRIVE_API_UNAVAILABLE"
      | "GOOGLE_DRIVE_API_TIMEOUT",
    message: string,
  ) {
    super(message);
    this.name = "GoogleDriveSourceError";
  }
}

async function readBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const value = Number(declared);
    if (Number.isFinite(value) && value > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new GoogleDriveSourceError(
        413,
        "GOOGLE_DRIVE_FILE_TOO_LARGE",
        "Google Drive file melewati batas snapshot ECORIONE.",
      );
    }
  }
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    const bytes = Buffer.from(next.value);
    total += bytes.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new GoogleDriveSourceError(
        413,
        "GOOGLE_DRIVE_FILE_TOO_LARGE",
        "Google Drive file melewati batas snapshot ECORIONE.",
      );
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

const MAX_GOOGLE_DRIVE_REDIRECTS = 3;

export function isAllowedGoogleDriveResponseHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/u, "");
  return (
    normalized === "googleapis.com" ||
    normalized.endsWith(".googleapis.com") ||
    normalized === "googleusercontent.com" ||
    normalized.endsWith(".googleusercontent.com")
  );
}

async function defaultTransport(
  fetchImpl: typeof fetch,
  url: URL,
  accessToken: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<GoogleDriveApiTransportResponse> {
  if (url.origin !== GOOGLE_DRIVE_API_ORIGIN) {
    throw new GoogleDriveSourceError(
      502,
      "GOOGLE_DRIVE_API_INVALID_RESPONSE",
      "Google Drive endpoint keluar dari origin yang dipin.",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    let sendAuthorization = true;
    for (
      let redirectCount = 0;
      redirectCount <= MAX_GOOGLE_DRIVE_REDIRECTS;
      redirectCount += 1
    ) {
      const headers: Record<string, string> = {
        accept: "*/*",
        "user-agent": "ECORIONE-GoogleDrive/1.0",
      };
      if (sendAuthorization) headers.authorization = `Bearer ${accessToken}`;

      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers,
        signal: controller.signal,
      });
      if (response.status < 300 || response.status >= 400) {
        return {
          statusCode: response.status,
          body: await readBounded(response, maxBytes),
        };
      }

      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (location === null || redirectCount === MAX_GOOGLE_DRIVE_REDIRECTS) {
        throw new GoogleDriveSourceError(
          502,
          "GOOGLE_DRIVE_API_INVALID_RESPONSE",
          "Google Drive download redirect tidak valid atau terlalu banyak.",
        );
      }
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !isAllowedGoogleDriveResponseHost(next.hostname)) {
        throw new GoogleDriveSourceError(
          502,
          "GOOGLE_DRIVE_API_INVALID_RESPONSE",
          "Google Drive download redirect keluar dari host Google yang diizinkan.",
        );
      }
      current = next;
      sendAuthorization =
        next.hostname === "googleapis.com" || next.hostname.endsWith(".googleapis.com");
    }
    throw new GoogleDriveSourceError(
      502,
      "GOOGLE_DRIVE_API_INVALID_RESPONSE",
      "Google Drive download redirect tidak valid.",
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GoogleDriveSourceError(
        504,
        "GOOGLE_DRIVE_API_TIMEOUT",
        "Google Drive API melewati batas waktu.",
      );
    }
    if (error instanceof GoogleDriveSourceError) throw error;
    throw new GoogleDriveSourceError(
      503,
      "GOOGLE_DRIVE_API_UNAVAILABLE",
      "Google Drive API tidak dapat dijangkau.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function createGoogleDriveApiTransport(
  fetchImpl: typeof fetch = fetch,
): GoogleDriveApiTransport {
  return async (url, accessToken, timeoutMs, maxBytes) =>
    await defaultTransport(fetchImpl, url, accessToken, timeoutMs, maxBytes);
}

function mapHttpStatus(statusCode: number): never {
  if (statusCode === 404) {
    throw new GoogleDriveSourceError(
      404,
      "GOOGLE_DRIVE_FILE_NOT_FOUND",
      "Google Drive file tidak ditemukan.",
    );
  }
  if (statusCode === 401 || statusCode === 403) {
    throw new GoogleDriveSourceError(
      403,
      "GOOGLE_DRIVE_FILE_DOWNLOAD_DENIED",
      "Google Drive menolak akses download file.",
    );
  }
  if (statusCode === 429 || statusCode >= 500) {
    throw new GoogleDriveSourceError(
      503,
      "GOOGLE_DRIVE_API_UNAVAILABLE",
      "Google Drive API sementara tidak tersedia.",
    );
  }
  throw new GoogleDriveSourceError(
    502,
    "GOOGLE_DRIVE_API_INVALID_RESPONSE",
    "Google Drive API mengembalikan status yang tidak diharapkan.",
  );
}

function parseMetadata(body: Uint8Array, expectedFileId: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
  } catch {
    throw new GoogleDriveSourceError(
      502,
      "GOOGLE_DRIVE_API_INVALID_RESPONSE",
      "Metadata Google Drive bukan JSON valid.",
    );
  }
  const parsed = GoogleDriveMetadataSchema.safeParse(raw);
  if (!parsed.success || parsed.data.id !== expectedFileId) {
    throw new GoogleDriveSourceError(
      502,
      "GOOGLE_DRIVE_API_INVALID_RESPONSE",
      "Metadata Google Drive tidak sesuai kontrak file yang diminta.",
    );
  }
  return parsed.data;
}

function snapshotPlan(
  sourceMimeType: string,
):
  | { readonly kind: "blob"; readonly snapshotMimeType: string }
  | { readonly kind: "export"; readonly snapshotMimeType: string } {
  switch (sourceMimeType) {
    case GOOGLE_DOC_MIME:
      return { kind: "export", snapshotMimeType: "text/markdown" };
    case GOOGLE_SHEET_MIME:
      return {
        kind: "export",
        snapshotMimeType: "application/pdf",
      };
    case GOOGLE_SLIDE_MIME:
      return { kind: "export", snapshotMimeType: "text/plain" };
    case GOOGLE_DRAWING_MIME:
      return { kind: "export", snapshotMimeType: "application/pdf" };
    default:
      if (sourceMimeType.startsWith(GOOGLE_NATIVE_PREFIX)) {
        throw new GoogleDriveSourceError(
          415,
          "GOOGLE_DRIVE_FILE_UNSUPPORTED",
          "Tipe Google-native ini belum didukung sebagai snapshot Drive V1.",
        );
      }
      return { kind: "blob", snapshotMimeType: sourceMimeType };
  }
}

function metadataUrl(fileId: string): URL {
  const url = new URL(`/drive/v3/files/${encodeURIComponent(fileId)}`, GOOGLE_DRIVE_API_ORIGIN);
  url.searchParams.set(
    "fields",
    "id,name,mimeType,size,modifiedTime,capabilities(canDownload)",
  );
  url.searchParams.set("supportsAllDrives", "true");
  return url;
}

function contentUrl(fileId: string, plan: ReturnType<typeof snapshotPlan>): URL {
  if (plan.kind === "blob") {
    const url = new URL(
      `/drive/v3/files/${encodeURIComponent(fileId)}`,
      GOOGLE_DRIVE_API_ORIGIN,
    );
    url.searchParams.set("alt", "media");
    url.searchParams.set("supportsAllDrives", "true");
    return url;
  }
  const url = new URL(
    `/drive/v3/files/${encodeURIComponent(fileId)}/export`,
    GOOGLE_DRIVE_API_ORIGIN,
  );
  url.searchParams.set("mimeType", plan.snapshotMimeType);
  return url;
}

export interface GoogleDriveSourceOptions {
  readonly vault: Pick<ProviderCredentialReader, "get">;
  readonly oauthClient: Pick<GoogleDriveOAuthClient, "refreshAccessToken">;
  readonly transport?: GoogleDriveApiTransport | undefined;
  readonly timeoutMs?: number | undefined;
  readonly maxBytes?: number | undefined;
}

export class GoogleDriveSource {
  private readonly transport: GoogleDriveApiTransport;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(private readonly options: GoogleDriveSourceOptions) {
    this.transport = options.transport ?? createGoogleDriveApiTransport();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_GOOGLE_DRIVE_API_TIMEOUT_MS;
    this.maxBytes = options.maxBytes ?? MAX_GOOGLE_DRIVE_SOURCE_BYTES;
    if (
      !Number.isSafeInteger(this.timeoutMs) ||
      this.timeoutMs < 1_000 ||
      this.timeoutMs > 60_000
    ) {
      throw new GoogleDriveSourceError(
        503,
        "GOOGLE_DRIVE_API_UNAVAILABLE",
        "Google Drive timeout config di luar batas 1-60 detik.",
      );
    }
    if (
      !Number.isSafeInteger(this.maxBytes) ||
      this.maxBytes < 1 ||
      this.maxBytes > MAX_GOOGLE_DRIVE_SOURCE_BYTES
    ) {
      throw new GoogleDriveSourceError(
        503,
        "GOOGLE_DRIVE_API_UNAVAILABLE",
        "Google Drive snapshot size config tidak valid.",
      );
    }
  }

  async fetchSelectedFile(
    workspaceId: string,
    fileIdInput: string,
  ): Promise<GoogleDriveFileFetchResponse> {
    if (workspaceId !== DEFAULT_WORKSPACE_ID) {
      throw new GoogleDriveSourceError(
        409,
        "GOOGLE_DRIVE_NOT_CONNECTED",
        "Native Google Drive V1 hanya tersedia untuk Personal Workspace.",
      );
    }
    const fileId = GoogleDriveFileIdSchema.parse(fileIdInput);
    const refreshToken = this.options.vault.get(GOOGLE_DRIVE_PROVIDER_ID, "tokens");
    if (refreshToken === undefined) {
      throw new GoogleDriveSourceError(
        409,
        "GOOGLE_DRIVE_NOT_CONNECTED",
        "Google Drive belum terhubung.",
      );
    }
    let access: GoogleDriveAccessToken;
    try {
      access = await this.options.oauthClient.refreshAccessToken(refreshToken);
    } catch (error) {
      if (error instanceof GoogleDriveOAuthUpstreamError) {
        if (error.code === "GOOGLE_DRIVE_OAUTH_REJECTED") {
          throw new GoogleDriveSourceError(
            409,
            "GOOGLE_DRIVE_NOT_CONNECTED",
            "Google Drive authorization perlu dihubungkan ulang.",
          );
        }
        if (error.code === "GOOGLE_DRIVE_OAUTH_TIMEOUT") {
          throw new GoogleDriveSourceError(
            504,
            "GOOGLE_DRIVE_API_TIMEOUT",
            "Google Drive authorization melewati batas waktu.",
          );
        }
        if (error.code === "GOOGLE_DRIVE_OAUTH_UNAVAILABLE") {
          throw new GoogleDriveSourceError(
            503,
            "GOOGLE_DRIVE_API_UNAVAILABLE",
            "Google Drive authorization sementara tidak tersedia.",
          );
        }
        throw new GoogleDriveSourceError(
          502,
          "GOOGLE_DRIVE_API_INVALID_RESPONSE",
          "Google Drive authorization mengembalikan respons tidak valid.",
        );
      }
      throw error;
    }

    const metadataResponse = await this.transport(
      metadataUrl(fileId),
      access.accessToken,
      this.timeoutMs,
      MAX_METADATA_BYTES,
    );
    if (metadataResponse.statusCode < 200 || metadataResponse.statusCode >= 300) {
      return mapHttpStatus(metadataResponse.statusCode);
    }
    const metadata = parseMetadata(metadataResponse.body, fileId);
    if (!metadata.capabilities.canDownload) {
      throw new GoogleDriveSourceError(
        403,
        "GOOGLE_DRIVE_FILE_DOWNLOAD_DENIED",
        "Pemilik Google Drive membatasi download file ini.",
      );
    }

    const plan = snapshotPlan(metadata.mimeType);
    if (plan.kind === "blob" && metadata.size !== undefined) {
      const declared = Number(metadata.size);
      if (!Number.isSafeInteger(declared) || declared < 0) {
        throw new GoogleDriveSourceError(
          502,
          "GOOGLE_DRIVE_API_INVALID_RESPONSE",
          "Ukuran file Google Drive tidak valid.",
        );
      }
      if (declared > this.maxBytes) {
        throw new GoogleDriveSourceError(
          413,
          "GOOGLE_DRIVE_FILE_TOO_LARGE",
          "Google Drive file melewati batas snapshot ECORIONE.",
        );
      }
    }

    const contentResponse = await this.transport(
      contentUrl(fileId, plan),
      access.accessToken,
      this.timeoutMs,
      this.maxBytes,
    );
    if (contentResponse.statusCode < 200 || contentResponse.statusCode >= 300) {
      return mapHttpStatus(contentResponse.statusCode);
    }
    const content = Buffer.from(contentResponse.body);
    if (content.byteLength === 0) {
      throw new GoogleDriveSourceError(
        502,
        "GOOGLE_DRIVE_API_INVALID_RESPONSE",
        "Google Drive mengembalikan snapshot kosong.",
      );
    }

    return GoogleDriveFileFetchResponseSchema.parse({
      fileId,
      name: metadata.name,
      sourceMimeType: metadata.mimeType,
      snapshotMimeType: plan.snapshotMimeType,
      modifiedTime: metadata.modifiedTime ?? null,
      sizeBytes: content.byteLength,
      contentBase64: content.toString("base64"),
    });
  }
}
