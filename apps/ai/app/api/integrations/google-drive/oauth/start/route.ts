import { GoogleDriveOAuthStartRequestSchema } from "@ecorione/shared-schema";
import { proxyGoogleDriveOwner } from "../../../../../../lib/google-drive-proxy";
import { jsonError } from "../../../../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }
  const parsed = GoogleDriveOAuthStartRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Permintaan Google Drive OAuth tidak valid.");
  }
  return proxyGoogleDriveOwner(
    "/v1/integrations/google-drive/oauth/start",
    "POST",
    parsed.data,
  );
}
