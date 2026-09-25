import { lookup } from "node:dns/promises";
import {
  ExternalUrlFetchResponseSchema,
  MAX_EXTERNAL_URL_SOURCE_BYTES,
  ProjectSourceHttpsUrlSchema,
  type ExternalUrlFetchResponse,
} from "@ecorione/shared-schema";
import { classifyLocalHost, isLocalReachableHost } from "./local-base-url.js";

export const DEFAULT_EXTERNAL_SOURCE_MAX_BYTES = MAX_EXTERNAL_URL_SOURCE_BYTES;
export const DEFAULT_EXTERNAL_SOURCE_TIMEOUT_MS = 10_000;

export type ExternalSourceResolveHost = (
  hostname: string,
) => Promise<readonly { readonly address: string; readonly family: number }[]>;

export interface ExternalSourceFetchDeps {
  readonly fetchImpl?: typeof fetch | undefined;
  readonly resolveHost?: ExternalSourceResolveHost | undefined;
  readonly maxBytes?: number | undefined;
  readonly timeoutMs?: number | undefined;
}

export class ExternalSourceFetchError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code:
      | "URL_SOURCE_BLOCKED"
      | "URL_SOURCE_TOO_LARGE"
      | "URL_SOURCE_TIMEOUT"
      | "URL_SOURCE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "ExternalSourceFetchError";
  }
}

async function defaultResolveHost(
  hostname: string,
): Promise<readonly { readonly address: string; readonly family: number }[]> {
  return await lookup(hostname, { all: true, verbatim: true });
}

function ensurePublicHost(
  url: URL,
  addresses: readonly { readonly address: string; readonly family: number }[],
): void {
  if (isLocalReachableHost(url.hostname)) {
    throw new ExternalSourceFetchError(
      400,
      "URL_SOURCE_BLOCKED",
      "URL source harus memakai host publik.",
    );
  }
  if (addresses.length === 0) {
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      "DNS URL source tidak mengembalikan alamat.",
    );
  }
  const unsafe = addresses.find((entry) => classifyLocalHost(entry.address) !== "public");
  if (unsafe !== undefined) {
    throw new ExternalSourceFetchError(
      400,
      "URL_SOURCE_BLOCKED",
      `URL source resolve ke alamat non-publik: ${unsafe.address}.`,
    );
  }
}

function mimeTypeFrom(response: Response): string {
  const raw = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (raw === undefined || raw.length === 0 || raw.length > 128) {
    return "application/octet-stream";
  }
  return raw;
}

async function readBounded(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ExternalSourceFetchError(
        413,
        "URL_SOURCE_TOO_LARGE",
        `URL source melewati batas ${String(maxBytes)} byte.`,
      );
    }
  }
  if (response.body === null) {
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      "URL source tidak mengembalikan body.",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ExternalSourceFetchError(
          413,
          "URL_SOURCE_TOO_LARGE",
          `URL source melewati batas ${String(maxBytes)} byte.`,
        );
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      "URL source kosong.",
    );
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function fetchExternalUrl(
  rawUrl: string,
  deps: ExternalSourceFetchDeps = {},
): Promise<ExternalUrlFetchResponse> {
  const parsed = ProjectSourceHttpsUrlSchema.safeParse(rawUrl);
  if (!parsed.success) {
    throw new ExternalSourceFetchError(
      400,
      "URL_SOURCE_BLOCKED",
      "URL source wajib HTTPS tanpa credential atau fragment.",
    );
  }
  const url = new URL(parsed.data);
  const resolveHost = deps.resolveHost ?? defaultResolveHost;
  let addresses: readonly { readonly address: string; readonly family: number }[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      "DNS URL source tidak tersedia.",
    );
  }
  ensurePublicHost(url, addresses);

  const maxBytes = deps.maxBytes ?? DEFAULT_EXTERNAL_SOURCE_MAX_BYTES;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_EXTERNAL_SOURCE_TIMEOUT_MS;
  const fetchImpl = deps.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(parsed.data, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "*/*",
        "user-agent": "ECORIONE-ProjectSource/1.0",
      },
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new ExternalSourceFetchError(
        504,
        "URL_SOURCE_TIMEOUT",
        "URL source melewati batas waktu fetch.",
      );
    }
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      "URL source gagal diambil atau mencoba redirect.",
    );
  }

  if (!response.ok) {
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      `URL source mengembalikan HTTP ${String(response.status)}.`,
    );
  }

  const bytes = await readBounded(response, maxBytes);
  return ExternalUrlFetchResponseSchema.parse({
    url: parsed.data,
    mimeType: mimeTypeFrom(response),
    sizeBytes: bytes.byteLength,
    contentBase64: bytes.toString("base64"),
  });
}
