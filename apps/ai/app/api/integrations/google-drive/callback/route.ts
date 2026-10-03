import {
  GoogleDriveOAuthCallbackRequestSchema,
  GoogleDriveOAuthCallbackResponseSchema,
} from "@ecorione/shared-schema";
import { proxyGoogleDriveOwner } from "../../../../../lib/google-drive-proxy";
import { jsonError } from "../../../../../lib/proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = {
    ...(url.searchParams.get("code") === null
      ? {}
      : { code: url.searchParams.get("code") ?? undefined }),
    state: url.searchParams.get("state") ?? "",
    ...(url.searchParams.get("error") === null
      ? {}
      : { error: url.searchParams.get("error") ?? undefined }),
    ...(url.searchParams.get("error_description") === null
      ? {}
      : { errorDescription: url.searchParams.get("error_description") ?? undefined }),
  };
  const parsed = GoogleDriveOAuthCallbackRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Callback Google Drive OAuth tidak valid.");
  }

  const upstream = await proxyGoogleDriveOwner(
    "/v1/integrations/google-drive/oauth/callback",
    "POST",
    parsed.data,
  );
  if (!upstream.ok) return upstream;

  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return jsonError(502, "BAD_GATEWAY", "Respons callback Google Drive tidak valid.");
  }
  const result = GoogleDriveOAuthCallbackResponseSchema.safeParse(body);
  if (!result.success) {
    return jsonError(502, "BAD_GATEWAY", "Respons callback Google Drive tidak sesuai kontrak.");
  }

  const destination = new URL(result.data.returnPath, url.origin);
  if (destination.origin !== url.origin) {
    return jsonError(502, "BAD_GATEWAY", "Tujuan callback Google Drive tidak same-origin.");
  }
  destination.searchParams.set(
    "googleDrive",
    result.data.connected ? "connected" : "cancelled",
  );
  return new Response(null, {
    status: 303,
    headers: {
      location: destination.toString(),
      "cache-control": "no-store, private",
      pragma: "no-cache",
    },
  });
}
