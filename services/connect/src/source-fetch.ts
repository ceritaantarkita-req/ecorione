import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import {
  ExternalUrlFetchResponseSchema,
  ProjectSourceHttpsUrlSchema,
  type ExternalUrlFetchResponse,
} from "@ecorione/shared-schema";
import { classifyLocalHost, isLocalReachableHost } from "./local-base-url.js";

export const DEFAULT_EXTERNAL_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_EXTERNAL_SOURCE_TIMEOUT_MS = 10_000;

export type ExternalSourceResolveHost = (
  hostname: string,
) => Promise<readonly { readonly address: string; readonly family: number }[]>;

export interface ExternalSourceTransportResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: AsyncIterable<Uint8Array>;
  readonly destroy?: (() => void) | undefined;
}

export type ExternalSourceTransport = (
  url: URL,
  safeAddresses: readonly { readonly address: string; readonly family: number }[],
  timeoutMs: number,
) => Promise<ExternalSourceTransportResponse>;

export interface ExternalSourceFetchDeps {
  readonly resolveHost?: ExternalSourceResolveHost | undefined;
  readonly transport?: ExternalSourceTransport | undefined;
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

function headerValue(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function mimeTypeFrom(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const raw = headerValue(headers, "content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (raw === undefined || raw.length === 0 || raw.length > 128) {
    return "application/octet-stream";
  }
  return raw;
}

async function readBounded(
  response: ExternalSourceTransportResponse,
  maxBytes: number,
): Promise<Buffer> {
  const contentLength = headerValue(response.headers, "content-length");
  if (contentLength !== undefined) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      response.destroy?.();
      throw new ExternalSourceFetchError(
        413,
        "URL_SOURCE_TOO_LARGE",
        `URL source melewati batas ${String(maxBytes)} byte.`,
      );
    }
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > maxBytes) {
      response.destroy?.();
      throw new ExternalSourceFetchError(
        413,
        "URL_SOURCE_TOO_LARGE",
        `URL source melewati batas ${String(maxBytes)} byte.`,
      );
    }
    chunks.push(bytes);
  }

  if (total === 0) {
    throw new ExternalSourceFetchError(502, "URL_SOURCE_UNAVAILABLE", "URL source kosong.");
  }
  return Buffer.concat(chunks, total);
}

function defaultTransport(
  url: URL,
  safeAddresses: readonly { readonly address: string; readonly family: number }[],
  timeoutMs: number,
): Promise<ExternalSourceTransportResponse> {
  return new Promise((resolve, reject) => {
    const addresses = [...safeAddresses];
    let cursor = 0;
    const lookupPinned: RequestOptions["lookup"] = (_hostname, options, callback) => {
      const all =
        typeof options === "object" &&
        options !== null &&
        "all" in options &&
        options.all === true;
      if (all) {
        callback(
          null,
          addresses.map((entry) => ({
            address: entry.address,
            family: entry.family === 6 ? 6 : 4,
          })),
        );
        return;
      }
      const selected = addresses[cursor % addresses.length];
      cursor += 1;
      if (selected === undefined) {
        callback(new Error("No safe DNS address available"), "0.0.0.0", 4);
        return;
      }
      callback(null, selected.address, selected.family === 6 ? 6 : 4);
    };

    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          accept: "*/*",
          "user-agent": "ECORIONE-ProjectSource/1.0",
        },
        lookup: lookupPinned,
        servername: url.hostname,
        timeout: timeoutMs,
      },
      (response) => {
        const headers: Record<string, string | readonly string[] | undefined> = {};
        for (const [name, value] of Object.entries(response.headers)) {
          headers[name.toLowerCase()] = value;
        }
        resolve({
          statusCode: response.statusCode ?? 502,
          headers,
          body: response,
          destroy: () => response.destroy(),
        });
      },
    );
    request.once("timeout", () => {
      request.destroy(
        new ExternalSourceFetchError(
          504,
          "URL_SOURCE_TIMEOUT",
          "URL source melewati batas waktu fetch.",
        ),
      );
    });
    request.once("error", reject);
    request.end();
  });
}

function mapTransportError(error: unknown): never {
  if (error instanceof ExternalSourceFetchError) throw error;
  throw new ExternalSourceFetchError(
    502,
    "URL_SOURCE_UNAVAILABLE",
    "URL source gagal diambil.",
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
  let response: ExternalSourceTransportResponse;
  try {
    response = await (deps.transport ?? defaultTransport)(url, addresses, timeoutMs);
  } catch (error) {
    return mapTransportError(error);
  }

  if (response.statusCode >= 300 && response.statusCode < 400) {
    response.destroy?.();
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      "URL source mencoba redirect; redirect tidak diikuti.",
    );
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    response.destroy?.();
    throw new ExternalSourceFetchError(
      502,
      "URL_SOURCE_UNAVAILABLE",
      `URL source mengembalikan HTTP ${String(response.statusCode)}.`,
    );
  }

  const bytes = await readBounded(response, maxBytes);
  return ExternalUrlFetchResponseSchema.parse({
    url: parsed.data,
    mimeType: mimeTypeFrom(response.headers),
    sizeBytes: bytes.byteLength,
    contentBase64: bytes.toString("base64"),
  });
}
