import { DEFAULT_WORKSPACE_ID } from "@ecorione/shared-schema";
import { proxyGoogleDriveOwner } from "../../../../../lib/google-drive-proxy";
import { jsonError } from "../../../../../lib/proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "workspaceId")) {
    return jsonError(400, "BAD_REQUEST", "Query Google Drive status tidak valid.");
  }
  const workspaceId = url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
  if (workspaceId !== DEFAULT_WORKSPACE_ID) {
    return jsonError(400, "BAD_REQUEST", "Native Google Drive V1 hanya untuk Personal Workspace.");
  }
  return proxyGoogleDriveOwner(
    `/v1/integrations/google-drive/status?workspaceId=${encodeURIComponent(workspaceId)}`,
    "GET",
  );
}
