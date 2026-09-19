import {
  BrainQuerySchema,
  DEFAULT_WORKSPACE_ID,
  type BrainQuery,
} from "@ecorione/shared-schema";
import { BrainOwnerRequestError, queryBrainGraph } from "../../../lib/brain-projection";
import { jsonError } from "../../../lib/proxy";

function parseQuery(request: Request): BrainQuery | null {
  const url = new URL(request.url);
  const parsed = BrainQuerySchema.safeParse({
    workspaceId: url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
    projectId: url.searchParams.get("projectId"),
    limit: url.searchParams.get("limit") ?? undefined,
    runLimit: url.searchParams.get("runLimit") ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

export async function GET(request: Request): Promise<Response> {
  const query = parseQuery(request);
  if (query === null) {
    return jsonError(400, "BAD_REQUEST", "Brain query tidak valid.");
  }

  try {
    return Response.json(await queryBrainGraph(query));
  } catch (error) {
    if (
      error instanceof BrainOwnerRequestError &&
      error.owner === "HubProject" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return jsonError(404, "PROJECT_UNAVAILABLE", "Project tidak tersedia.");
    }
    return jsonError(502, "BRAIN_OWNER_UNAVAILABLE", "Brain owner data tidak dapat dibaca.");
  }
}
