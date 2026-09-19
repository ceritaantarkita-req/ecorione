import {
  DEFAULT_WORKSPACE_ID,
  ProjectIdSchema,
  ProjectSourceAttachRequestSchema,
  ProjectSourceDetachRequestSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../../lib/env";
import { jsonError } from "../../../../../lib/proxy";

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

async function forward(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    const upstream = await fetch(url, {
      ...init,
      headers: { ...headers(), ...(init.headers ?? {}) },
      redirect: "error",
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }
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
  if (!workspaceId.success) return jsonError(400, "BAD_REQUEST", "workspaceId tidak valid.");
  return forward(
    `${hubUrl()}/v1/projects/${encodeURIComponent(id)}/sources?workspaceId=${encodeURIComponent(workspaceId.data)}`,
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const id = await projectIdFrom(context);
  if (id === null) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }
  const parsed = ProjectSourceAttachRequestSchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Project Source tidak valid.");
  return forward(`${hubUrl()}/v1/projects/${encodeURIComponent(id)}/sources`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const id = await projectIdFrom(context);
  if (id === null) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }
  const parsed = ProjectSourceDetachRequestSchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Project Source tidak valid.");
  return forward(`${hubUrl()}/v1/projects/${encodeURIComponent(id)}/sources`, {
    method: "DELETE",
    body: JSON.stringify(parsed.data),
  });
}
