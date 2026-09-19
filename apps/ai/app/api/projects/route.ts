import {
  DEFAULT_WORKSPACE_ID,
  ProjectCreateRequestSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../lib/env";
import { jsonError } from "../../../lib/proxy";

function headers(): Record<string, string> {
  const result: Record<string, string> = { "content-type": "application/json" };
  const token = internalToken();
  if (token !== undefined) result.authorization = `Bearer ${token}`;
  return result;
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

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = WorkspaceIdSchema.safeParse(
    url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
  );
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "workspaceId tidak valid.");
  return forward(`${hubUrl()}/v1/projects?workspaceId=${encodeURIComponent(parsed.data)}`);
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }
  const parsed = ProjectCreateRequestSchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Input Project tidak valid.");
  return forward(`${hubUrl()}/v1/projects`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
}
