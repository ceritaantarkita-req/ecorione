import { connectUrl, internalToken } from "./env";
import { jsonError } from "./proxy";

const ALLOWED = [
  /^\/v1\/settings\/runtime$/,
  /^\/v1\/settings\/credentials(?:\/(?:anthropic|openai|openrouter|mcp))?$/,
  /^\/v1\/settings\/mcp\/servers(?:\/[a-z0-9][a-z0-9._-]*)?(?:\/tools\/[A-Za-z0-9._-]+)?$/,
  /^\/v1\/ops\/provider-canary$/,
];

export async function proxyToConnectSettings(
  request: Request,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
): Promise<Response> {
  if (!ALLOWED.some((pattern) => pattern.test(path)))
    return jsonError(400, "BAD_REQUEST", "Settings proxy path tidak diizinkan.");
  const headers: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (method === "POST" || method === "PUT") {
    try {
      body = JSON.stringify(await request.json());
      headers["content-type"] = "application/json";
    } catch {
      return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
    }
  }
  try {
    const upstream = await fetch(`${connectUrl()}${path}`, {
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
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Connect tidak bisa dihubungi.");
  }
}
