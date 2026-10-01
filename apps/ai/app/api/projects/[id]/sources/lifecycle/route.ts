import {
  DEFAULT_WORKSPACE_ID,
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
  const id = await projectIdFrom(context);
  if (id === null) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");
  const url = new URL(request.url);
  const workspaceId = WorkspaceIdSchema.safeParse(
    url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
  );
  if (!workspaceId.success) {
    return jsonError(400, "BAD_REQUEST", "workspaceId tidak valid.");
  }

  try {
    const upstream = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(id)}/sources/lifecycle?workspaceId=${encodeURIComponent(workspaceId.data)}`,
      {
        headers: headers(),
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
