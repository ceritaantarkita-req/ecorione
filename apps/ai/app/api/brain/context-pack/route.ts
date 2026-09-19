import { BrainOwnerRequestError, BrainNeighborhoodSeedError } from "../../../../lib/brain-projection";
import {
  BrainContextEcxRequestSchema,
  runBrainContextEcx,
} from "../../../../lib/brain-context-ecx";
import { jsonError } from "../../../../lib/proxy";

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body JSON tidak valid.");
  }
  const parsed = BrainContextEcxRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Brain + Context + ECX request tidak valid.");
  }

  try {
    return Response.json(await runBrainContextEcx(parsed.data));
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
    return jsonError(502, "PE07_UPSTREAM_UNAVAILABLE", "PE-07 owner path tidak tersedia.");
  }
}
