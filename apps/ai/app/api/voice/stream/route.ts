import { VoiceEventsQuerySchema } from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../lib/env";
import { jsonError } from "../../../lib/proxy";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = VoiceEventsQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    after: url.searchParams.get("after") ?? "-1",
  });
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Query voice stream tidak valid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const headers: Record<string, string> = { accept: "text/event-stream" };
  const token = internalToken();
  if (token !== undefined) headers.authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    const query = new URLSearchParams({
      sessionId: parsed.data.sessionId,
      after: String(parsed.data.after),
    });
    upstream = await fetch(`${hubUrl()}/v1/voice/stream?${query.toString()}`, {
      headers,
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub voice stream tidak bisa dihubungi.");
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
