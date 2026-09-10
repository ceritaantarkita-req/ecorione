/**
 * Client HTTP tipis untuk panggilan antar-service. Bukan abstraksi umum — dipangkas
 * khusus untuk pola JSON antar-service: bearer internal + error RemoteServiceError.
 */

import { RemoteServiceError } from "./errors.js";
import { outgoingTraceHeaders } from "./observability.js";

export interface HttpJsonOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly token?: string | undefined;
  readonly headers?: Readonly<Record<string, string>>;
  /** `AbortSignal` opsional — dipakai test untuk memastikan tidak ada panggilan menggantung. */
  readonly signal?: AbortSignal;
}

export async function httpJson<T>(url: string, options: HttpJsonOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
    ...outgoingTraceHeaders(),
    ...options.headers,
  };
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
  };
  if (body !== undefined) init.body = body;
  if (options.signal !== undefined) init.signal = options.signal;

  const res = await fetch(url, init);

  const text = await res.text();
  const parsed: unknown = text.length === 0 ? undefined : safeJsonParse(text);

  if (!res.ok) throw new RemoteServiceError(url, res.status, parsed ?? text);
  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
