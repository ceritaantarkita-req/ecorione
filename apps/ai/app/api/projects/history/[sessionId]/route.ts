import {
  DEFAULT_WORKSPACE_ID,
  HistoryRangeSchema,
  HistorySessionSchema,
  ProjectIdSchema,
  SessionIdSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../../lib/env";
import { jsonError } from "../../../../../lib/proxy";

const MAX_REPLAY_EVENTS = 500;

function upstreamHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return headers;
}

function proxyError(status: number, text: string): Response {
  return new Response(text.length === 0 ? undefined : text, {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId: rawSessionId } = await context.params;
  const sessionId = SessionIdSchema.safeParse(rawSessionId);
  const url = new URL(request.url);
  const projectId = ProjectIdSchema.safeParse(url.searchParams.get("projectId"));
  const workspaceId = WorkspaceIdSchema.safeParse(
    url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID,
  );
  if (!sessionId.success || !projectId.success || !workspaceId.success) {
    return jsonError(400, "BAD_REQUEST", "Session/Project/Workspace tidak valid.");
  }

  const grant =
    `scope=personal&workspaceId=${encodeURIComponent(workspaceId.data)}` +
    `&projectId=${encodeURIComponent(projectId.data)}&maxSensitivity=RESTRICTED&hostedEligible=0`;
  const headers = upstreamHeaders();
  const base = `${hubUrl()}/v1/history/sessions/${encodeURIComponent(sessionId.data)}`;

  try {
    const sessionResponse = await fetch(`${base}?${grant}`, {
      headers,
      redirect: "error",
      cache: "no-store",
    });
    const sessionText = await sessionResponse.text();
    if (!sessionResponse.ok) return proxyError(sessionResponse.status, sessionText);

    let rawSession: unknown;
    try {
      rawSession = JSON.parse(sessionText);
    } catch {
      return jsonError(502, "UPSTREAM_INVALID_RESPONSE", "History session tidak valid.");
    }
    const session = HistorySessionSchema.safeParse(rawSession);
    if (!session.success) {
      return jsonError(502, "UPSTREAM_INVALID_RESPONSE", "History session tidak valid.");
    }

    const afterSeq = Math.max(-1, session.data.nextSeq - MAX_REPLAY_EVENTS - 1);
    const rangeResponse = await fetch(
      `${base}/events?${grant}&afterSeq=${String(afterSeq)}&limit=${String(MAX_REPLAY_EVENTS)}`,
      {
        headers,
        redirect: "error",
        cache: "no-store",
      },
    );
    const rangeText = await rangeResponse.text();
    if (!rangeResponse.ok) return proxyError(rangeResponse.status, rangeText);

    let rawRange: unknown;
    try {
      rawRange = JSON.parse(rangeText);
    } catch {
      return jsonError(502, "UPSTREAM_INVALID_RESPONSE", "History events tidak valid.");
    }
    const range = HistoryRangeSchema.safeParse(rawRange);
    if (!range.success) {
      return jsonError(502, "UPSTREAM_INVALID_RESPONSE", "History events tidak valid.");
    }

    return Response.json({
      session: session.data,
      range: range.data,
      truncated: afterSeq >= 0,
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }
}
