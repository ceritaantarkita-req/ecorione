import { flowUrl, internalToken } from "./env";
import { jsonError } from "./proxy";

export async function proxyToFlow(request: Request, path: string, method: "GET" | "POST" | "PUT"): Promise<Response> {
  if (!path.startsWith("/v1/") || path.includes("..") || path.includes("\\")) return jsonError(400, "BAD_REQUEST", "Flow proxy path tidak valid.");
  const token = internalToken();
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  let body: string | undefined;
  if (method !== "GET") {
    try { body = JSON.stringify(await request.json()); headers["content-type"] = "application/json"; }
    catch { return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid."); }
  }
  try {
    const upstream = await fetch(`${flowUrl()}${path}`, { method, headers, body });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Flow tidak bisa dihubungi.");
  }
}
