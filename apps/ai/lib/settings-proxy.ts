import { WorkspaceIdSchema } from "@ecorione/shared-schema";
import { connectUrl, internalToken } from "./env";
import { normalizeOwnerProxyPath } from "./owner-proxy-path";
import { jsonError } from "./proxy";

type Method = "GET" | "POST" | "PUT" | "DELETE";

const ALLOWED = [
  /^\/v1\/settings\/runtime$/,
  /^\/v1\/settings\/providers$/,
  /^\/v1\/settings\/providers\/openrouter\/models$/,
  /^\/v1\/settings\/local-runtime\/status$/,
  /^\/v1\/settings\/credentials(?:\/[a-z0-9][a-z0-9-]{0,63}(?:\/test)?)?$/,
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
  } else if (normalized.pathname === "/v1/settings/providers/openrouter/models") {
    if (method !== "GET") return null;
    const allowedKeys = new Set(["q", "sourceProvider", "limit", "refresh"]);
    const keys = [...normalized.searchParams.keys()];
    if (keys.some((key) => !allowedKeys.has(key))) return null;
    for (const key of allowedKeys) {
      if (normalized.searchParams.getAll(key).length > 1) return null;
    }
    const q = normalized.searchParams.get("q");
    if (q !== null && q.trim().length > 120) return null;
    const sourceProvider = normalized.searchParams.get("sourceProvider");
    if (
      sourceProvider !== null &&
      !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(sourceProvider.trim())
    ) {
      return null;
    }
    const limit = normalized.searchParams.get("limit");
    if (limit !== null) {
      if (!/^\d{1,3}$/u.test(limit)) return null;
      const parsedLimit = Number(limit);
      if (parsedLimit < 1 || parsedLimit > 100) return null;
    }
    const refresh = normalized.searchParams.get("refresh");
    if (refresh !== null && refresh !== "0" && refresh !== "1") return null;
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
