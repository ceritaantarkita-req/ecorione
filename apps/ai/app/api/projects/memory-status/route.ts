import {
  DEFAULT_WORKSPACE_ID,
  ProjectIdSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { authorizeBrainProject } from "../../../../lib/brain-projection";
import { contextUrl, internalToken } from "../../../../lib/env";
import { jsonError } from "../../../../lib/proxy";

/** Read-only Project diagnostics; Hub ownership is verified before Context is queried. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const workspace = WorkspaceIdSchema.safeParse(
    params.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
  );
  const project = ProjectIdSchema.safeParse(params.get("projectId"));
  if (!workspace.success || !project.success) {
    return jsonError(400, "BAD_REQUEST", "Workspace atau Project tidak valid.");
  }

  try {
    await authorizeBrainProject({
      workspaceId: workspace.data,
      projectId: project.data,
    });
  } catch {
    return jsonError(404, "PROJECT_UNAVAILABLE", "Project tidak tersedia.");
  }

  const token = internalToken();
  try {
    const response = await fetch(
      `${contextUrl()}/v1/memory/status?projectId=${encodeURIComponent(project.data)}`,
      {
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return jsonError(502, "CONTEXT_UNAVAILABLE", "Status Memory belum bisa dibaca.");
    }
    const body: unknown = await response.json();
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch {
    return jsonError(502, "CONTEXT_UNAVAILABLE", "Status Memory belum bisa dibaca.");
  }
}
