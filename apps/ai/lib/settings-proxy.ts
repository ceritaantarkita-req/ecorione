import { WorkspaceIdSchema } from "@ecorione/shared-schema";
import { connectUrl, internalToken } from "./env";
import { normalizeOwnerProxyPath } from "./owner-proxy-path";
import { jsonError } from "./proxy";

type Method = "GET" | "POST" | "PUT" | "DELETE";

const ALLOWED = [
  /^\/v1\/settings\/runtime$/,
  /^\/v1\/settings\/credentials(?:\/(?:anthropic|openai|openrouter|mcp))?$/,
  /^\/v1\/settings\/mcp\/servers(?:\/[a-z0-9][a-z0-9._-]*)?(?:\/tools\/[A-Za-z0-9._-]+)?$/,
  /^\/v1\/ops\/provider-canary$/,
];

function allowedSettingsPath(path: string, method: Method): string | null {
  const normalized = normalizeOwnerProxyPath(path);
  if (normalized === null || !ALLOWED.some((pattern) => pattern.test(normalized.pathname))) {
    return null;
  }

  if (normalized.pathname === "/v1/settings/mcp/servers" && method === "GET") {
    const keys = [...normalized.searchParams.keys()];
    const workspaceIds = normalized.searchParams.getAll("workspaceId");
    if (
      keys.some((key) => key !== "workspaceId") ||
      workspaceIds.length > 1 ||
      (workspaceIds.length === 1 && !WorkspaceIdSchema.safeParse(workspaceIds[0]).success)
    ) {
      return null;
    }
  } else if (normalized.search.length > 0) {
    return null;
  }

  return normalized.path;
}

export async function proxyToConnectSettings(
  request: Request,
  path: string,
  method: Method,
): Promise<Response> {
  const allowedPath = allowedSettingsPath(path, method);
  if (allowedPath === null)
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
    const upstream = await fetch(`${connectUrl()}${allowedPath}`, {
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
