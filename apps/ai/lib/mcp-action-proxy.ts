import {
  ScopeSchema,
  SensitivitySchema,
  WorkspaceIdSchema,
  makeId,
} from "@ecorione/shared-schema";
import { z } from "zod";
import { connectUrl, internalToken } from "./env";
import { jsonError } from "./proxy";

const ServerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

const DiscoverBodySchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    scope: ScopeSchema,
    sensitivity: SensitivitySchema,
  })
  .strict();

const DEFAULT_TIMEOUT_MS = 30_000;

function internalHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  if (json) headers["content-type"] = "application/json";
  return headers;
}

async function relay(url: string, init: RequestInit): Promise<Response> {
  try {
    const upstream = await fetch(url, {
      ...init,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Connect MCP tidak bisa dihubungi.");
  }
}

export async function listMcpActionServers(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = [...url.searchParams.keys()];
  const workspaceIds = url.searchParams.getAll("workspaceId");
  if (
    keys.some((key) => key !== "workspaceId") ||
    workspaceIds.length !== 1 ||
    !WorkspaceIdSchema.safeParse(workspaceIds[0]).success
  ) {
    return jsonError(400, "BAD_REQUEST", "workspaceId MCP action tidak valid.");
  }

  return relay(
    `${connectUrl()}/v1/mcp-outbound/servers?workspaceId=${encodeURIComponent(
      workspaceIds[0]!,
    )}`,
    { method: "GET", headers: internalHeaders() },
  );
}

export async function discoverMcpActionServer(
  request: Request,
  rawServerId: string,
): Promise<Response> {
  const server = ServerIdSchema.safeParse(rawServerId);
  if (!server.success) return jsonError(404, "NOT_FOUND", "MCP server tidak valid.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body discovery bukan JSON valid.");
  }
  const parsed = DiscoverBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Context discovery MCP tidak valid.");
  }

  return relay(
    `${connectUrl()}/v1/mcp-outbound/servers/${encodeURIComponent(server.data)}/discover`,
    {
      method: "POST",
      headers: internalHeaders(true),
      body: JSON.stringify({
        ...parsed.data,
        operationId: makeId("operation"),
        autonomy: "L0",
        now: new Date().toISOString(),
      }),
    },
  );
}
