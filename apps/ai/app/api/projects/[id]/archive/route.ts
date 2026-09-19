import {
  DEFAULT_WORKSPACE_ID,
  ProjectIdSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../../lib/env";
import { jsonError } from "../../../../../lib/proxy";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await context.params;
  const id = ProjectIdSchema.safeParse(rawId);
  if (!id.success) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // Empty body uses the default personal Workspace.
  }
  const candidate =
    typeof raw === "object" && raw !== null && "workspaceId" in raw
      ? (raw as { workspaceId?: unknown }).workspaceId
      : DEFAULT_WORKSPACE_ID;
  const workspaceId = WorkspaceIdSchema.safeParse(candidate);
  if (!workspaceId.success) return jsonError(400, "BAD_REQUEST", "workspaceId tidak valid.");

  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  try {
    const upstream = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(id.data)}/archive`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ workspaceId: workspaceId.data }),
        redirect: "error",
        cache: "no-store",
      },
    );
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }
}
