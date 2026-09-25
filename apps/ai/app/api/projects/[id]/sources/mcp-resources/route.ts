import {
  DEFAULT_WORKSPACE_ID,
  McpServerRefSchema,
  ProjectIdSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../../../lib/env";
import { jsonError } from "../../../../../../lib/proxy";

function headers(): Record<string, string> {
  const result: Record<string, string> = { "content-type": "application/json" };
  const token = internalToken();
  if (token !== undefined) result.authorization = `Bearer ${token}`;
  return result;
}

async function projectIdFrom(context: {
  params: Promise<{ id: string }>;
}): Promise<string | null> {
  const { id: rawId } = await context.params;
  const parsed = ProjectIdSchema.safeParse(rawId);
  return parsed.success ? parsed.data : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const projectId = await projectIdFrom(context);
  if (projectId === null) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");
  const url = new URL(request.url);
  const workspaceId = WorkspaceIdSchema.safeParse(
    url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
  );
  const serverId = McpServerRefSchema.safeParse(url.searchParams.get("serverId"));
  if (!workspaceId.success || !serverId.success) {
    return jsonError(400, "BAD_REQUEST", "MCP resource query tidak valid.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(projectId)}/sources/mcp-resources?workspaceId=${encodeURIComponent(workspaceId.data)}&serverId=${encodeURIComponent(serverId.data)}`,
      {
        headers: headers(),
        redirect: "error",
        cache: "no-store",
      },
    );
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }

  const text = await upstream.text();
  return new Response(text.length === 0 ? undefined : text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
