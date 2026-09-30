import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { classifyLocalHost, isLocalReachableHost } from "../local-base-url.js";
import type {
  OpenAiCompatibleTransport,
  OpenAiCompatibleTransportRequest,
} from "./openai-compatible.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export type PublicHttpsResolveHost = (
  hostname: string,
) => Promise<readonly { readonly address: string; readonly family: number }[]>;

export class PublicHttpsEndpointError extends Error {
  constructor(
    readonly code:
      | "CUSTOM_PROVIDER_URL_BLOCKED"
      | "CUSTOM_PROVIDER_DNS_UNAVAILABLE"
      | "CUSTOM_PROVIDER_RESPONSE_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.name = "PublicHttpsEndpointError";
  }
}

async function defaultResolveHost(
  hostname: string,
): Promise<readonly { readonly address: string; readonly family: number }[]> {
  return await lookup(hostname, { all: true, verbatim: true });
}

export async function resolvePublicHttpsEndpoint(
  rawUrl: string,
  resolveHost: PublicHttpsResolveHost = defaultResolveHost,
): Promise<{
  readonly url: URL;
  readonly addresses: readonly { readonly address: string; readonly family: number }[];
}> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicHttpsEndpointError(
      "CUSTOM_PROVIDER_URL_BLOCKED",
      "Custom provider endpoint harus URL valid.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new PublicHttpsEndpointError(
      "CUSTOM_PROVIDER_URL_BLOCKED",
      "Custom provider endpoint wajib HTTPS tanpa inline credential atau fragment.",
    );
  }
  if (isLocalReachableHost(url.hostname)) {
    throw new PublicHttpsEndpointError(
      "CUSTOM_PROVIDER_URL_BLOCKED",
      "Custom provider endpoint wajib memakai host publik.",
    );
  }

  let addresses: readonly { readonly address: string; readonly family: number }[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new PublicHttpsEndpointError(
      "CUSTOM_PROVIDER_DNS_UNAVAILABLE",
      "DNS custom provider tidak tersedia.",
    );
  }
  if (addresses.length === 0) {
    throw new PublicHttpsEndpointError(
      "CUSTOM_PROVIDER_DNS_UNAVAILABLE",
      "DNS custom provider tidak mengembalikan alamat.",
    );
  }
  const unsafe = addresses.find((entry) => classifyLocalHost(entry.address) !== "public");
  if (unsafe !== undefined) {
    throw new PublicHttpsEndpointError(
      "CUSTOM_PROVIDER_URL_BLOCKED",
      `Custom provider resolve ke alamat non-publik: ${unsafe.address}.`,
    );
  }
  return { url, addresses };
}

async function readBoundedResponse(response: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const raw of response) {
    const chunk = Buffer.from(raw as Uint8Array);
    total += chunk.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      throw new PublicHttpsEndpointError(
        "CUSTOM_PROVIDER_RESPONSE_TOO_LARGE",
        `Respons custom provider melewati batas ${String(MAX_RESPONSE_BYTES)} byte.`,
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

export function createPublicHttpsOpenAiTransport(
  options: {
    readonly resolveHost?: PublicHttpsResolveHost | undefined;
    readonly timeoutMs?: number | undefined;
  } = {},
): OpenAiCompatibleTransport {
  return async (input: OpenAiCompatibleTransportRequest): Promise<Response> => {
    const resolved = await resolvePublicHttpsEndpoint(
      input.endpoint,
      options.resolveHost ?? defaultResolveHost,
    );
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return await new Promise<Response>((resolve, reject) => {
      const addresses = [...resolved.addresses];
      let cursor = 0;
      const lookupPinned: RequestOptions["lookup"] = (_hostname, requestOptions, callback) => {
        const all =
          typeof requestOptions === "object" &&
          requestOptions !== null &&
          "all" in requestOptions &&
          requestOptions.all === true;
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
        resolved.url,
        {
          method: "POST",
          headers: input.headers,
          lookup: lookupPinned,
          servername: resolved.url.hostname,
          timeout: timeoutMs,
        },
        (response) => {
          void (async () => {
            try {
              const body = await readBoundedResponse(response);
              const headers = new Headers();
              for (const [name, value] of Object.entries(response.headers)) {
                if (Array.isArray(value)) {
                  for (const item of value) headers.append(name, item);
                } else if (value !== undefined) {
                  headers.set(name, String(value));
                }
              }
              resolve(
                new Response(body, {
                  status: response.statusCode ?? 502,
                  headers,
                }),
              );
            } catch (error) {
              response.destroy();
              reject(error);
            }
          })();
        },
      );

      const abort = (): void => {
        request.destroy(new Error("Custom provider request aborted."));
      };
      input.signal?.addEventListener("abort", abort, { once: true });
      request.once("timeout", () =>
        request.destroy(new Error(`Custom provider timeout setelah ${String(timeoutMs)}ms.`)),
      );
      request.once("error", reject);
      request.once("close", () => input.signal?.removeEventListener("abort", abort));
      request.end(input.body);
    });
  };
}
