import { connectUrl, internalToken } from "./env";
import { normalizeOwnerProxyPath } from "./owner-proxy-path";
import { jsonError } from "./proxy";

type GoogleDriveOwnerMethod = "GET" | "POST" | "DELETE";

const ALLOWED_METHODS = new Map<string, ReadonlySet<GoogleDriveOwnerMethod>>([
  ["/v1/integrations/google-drive/status", new Set(["GET"])],
  ["/v1/integrations/google-drive/oauth/start", new Set(["POST"])],
  ["/v1/integrations/google-drive/oauth/callback", new Set(["POST"])],
  ["/v1/integrations/google-drive/picker-session", new Set(["POST"])],
  ["/v1/integrations/google-drive", new Set(["DELETE"])],
]);

function allowedOwnerPath(path: string, method: GoogleDriveOwnerMethod): string | null {
  const normalized = normalizeOwnerProxyPath(path);
  if (normalized === null) return null;
  const methods = ALLOWED_METHODS.get(normalized.pathname);
  if (methods === undefined || !methods.has(method)) return null;

  if (
    normalized.pathname === "/v1/integrations/google-drive/status" ||
    normalized.pathname === "/v1/integrations/google-drive"
  ) {
    const keys = [...normalized.searchParams.keys()];
    const workspaceIds = normalized.searchParams.getAll("workspaceId");
    if (
      keys.some((key) => key !== "workspaceId") ||
      workspaceIds.length !== 1 ||
      workspaceIds[0] !== "ws_personal"
    ) {
      return null;
    }
  } else if (normalized.search.length > 0) {
    return null;
  }
  return normalized.path;
}

export async function proxyGoogleDriveOwner(
  path: string,
  method: GoogleDriveOwnerMethod,
  body?: unknown,
): Promise<Response> {
  const allowedPath = allowedOwnerPath(path, method);
  if (allowedPath === null) {
    return jsonError(400, "BAD_REQUEST", "Google Drive proxy path tidak diizinkan.");
  }

  const headers: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    headers["content-type"] = "application/json";
  }

  try {
    const upstream = await fetch(`${connectUrl()}${allowedPath}`, {
      method,
      headers,
      body: payload,
      redirect: "error",
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store, private",
        pragma: "no-cache",
      },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Connect tidak bisa dihubungi.");
  }
}
