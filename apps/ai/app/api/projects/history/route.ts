import {
  DEFAULT_WORKSPACE_ID,
  ProjectIdSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../lib/env";
import { jsonError } from "../../../../lib/proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const projectId = ProjectIdSchema.safeParse(url.searchParams.get("projectId"));
  const workspaceId = WorkspaceIdSchema.safeParse(
    url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
  );
  if (!projectId.success || !workspaceId.success) {
    return jsonError(400, "BAD_REQUEST", "Project/Workspace tidak valid.");
  }

  const headers: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  try {
    const upstream = await fetch(
      `${hubUrl()}/v1/history/sessions?scope=personal&workspaceId=${encodeURIComponent(workspaceId.data)}&projectId=${encodeURIComponent(projectId.data)}&maxSensitivity=RESTRICTED&hostedEligible=0`,
      { headers, redirect: "error", cache: "no-store" },
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
