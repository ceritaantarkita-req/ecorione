import {
  BrainNeighborhoodQuerySchema,
  DEFAULT_WORKSPACE_ID,
  type BrainNeighborhoodQuery,
} from "@ecorione/shared-schema";
import {
  BrainNeighborhoodSeedError,
  BrainOwnerRequestError,
  queryBrainNeighborhood,
} from "../../../../lib/brain-projection";
import { jsonError } from "../../../../lib/proxy";

function parseQuery(request: Request): BrainNeighborhoodQuery | null {
  const url = new URL(request.url);
  const parsed = BrainNeighborhoodQuerySchema.safeParse({
    workspaceId: url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
    projectId: url.searchParams.get("projectId"),
    seedNodeIds: url.searchParams.getAll("seedNodeId"),
    maxHops: url.searchParams.get("maxHops") ?? undefined,
    maxNodes: url.searchParams.get("maxNodes") ?? undefined,
    nodeTypes: url.searchParams.getAll("nodeType").length
      ? url.searchParams.getAll("nodeType")
      : undefined,
    edgeTypes: url.searchParams.getAll("edgeType").length
      ? url.searchParams.getAll("edgeType")
      : undefined,
  });
  return parsed.success ? parsed.data : null;
}

export async function GET(request: Request): Promise<Response> {
  const query = parseQuery(request);
  if (query === null) {
    return jsonError(400, "BAD_REQUEST", "Brain neighborhood query tidak valid.");
  }

  try {
    return Response.json(await queryBrainNeighborhood(query));
  } catch (error) {
    if (error instanceof BrainNeighborhoodSeedError) {
      return jsonError(404, "BRAIN_SEED_UNAVAILABLE", "Brain seed tidak tersedia.");
    }
    if (
      error instanceof BrainOwnerRequestError &&
      error.owner === "HubProject" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return jsonError(404, "PROJECT_UNAVAILABLE", "Project tidak tersedia.");
    }
    return jsonError(
      502,
      "BRAIN_OWNER_UNAVAILABLE",
      "Brain neighborhood owner data tidak dapat dibaca.",
    );
  }
}
