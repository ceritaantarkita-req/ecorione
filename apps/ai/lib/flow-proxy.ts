import { flowUrl, internalToken } from "./env";
import { normalizeOwnerProxyPath } from "./owner-proxy-path";
import { jsonError } from "./proxy";

const DEFAULT_FLOW_PROXY_TIMEOUT_MS = 10_000;

export async function proxyToFlow(
  request: Request,
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH",
  timeoutMs = DEFAULT_FLOW_PROXY_TIMEOUT_MS,
): Promise<Response> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Flow proxy timeout harus integer 1..60000 ms.");
  }

  const normalized = normalizeOwnerProxyPath(path);
  if (normalized === null) return jsonError(400, "BAD_REQUEST", "Flow proxy path tidak valid.");

  const token = internalToken();
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (method !== "GET") {
    try {
      body = JSON.stringify(await request.json());
      headers["content-type"] = "application/json";
    } catch {
      return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
    }
  }
  try {
    const upstream = await fetch(`${flowUrl()}${normalized.path}`, {
      method,
      headers,
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Flow tidak bisa dihubungi.");
  }
}
