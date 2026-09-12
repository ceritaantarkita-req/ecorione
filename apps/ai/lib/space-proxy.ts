import { internalToken, spaceUrl } from "./env";
import { normalizeOwnerProxyPath } from "./owner-proxy-path";
import { jsonError } from "./proxy";

export async function proxyToSpace(
  request: Request,
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
): Promise<Response> {
  const normalized = normalizeOwnerProxyPath(path);
  if (normalized === null) return jsonError(400, "BAD_REQUEST", "Space proxy path tidak valid.");

  const token = internalToken();
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    try {
      body = JSON.stringify(await request.json());
      headers["content-type"] = "application/json";
    } catch {
      return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
    }
  }
  try {
    const upstream = await fetch(`${spaceUrl()}${normalized.path}`, {
      method,
      headers,
      body,
      redirect: "error",
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Space tidak bisa dihubungi.");
  }
}
