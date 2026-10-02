import { connectUrl } from "../../../../lib/env";
import { jsonError } from "../../../../lib/proxy";

const HOOK_ID = /^[a-z0-9][a-z0-9_-]{15,63}$/u;
const MAX_BODY_BYTES = 96 * 1024;
const FORWARD_TIMEOUT_MS = 10_000;

type RouteContext = { params: Promise<{ hookId: string }> };

function tooLarge(): Response {
  return jsonError(413, "PAYLOAD_TOO_LARGE", "Webhook body melebihi batas 96 KiB.");
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { hookId } = await context.params;
  if (!HOOK_ID.test(hookId)) return new Response("Not Found", { status: 404 });

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_BODY_BYTES
    ) {
      return tooLarge();
    }
  }

  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Webhook body tidak bisa dibaca.");
  }
  if (body.byteLength > MAX_BODY_BYTES) return tooLarge();

  const headers: Record<string, string> = {
    "content-type": request.headers.get("content-type") ?? "application/json",
  };
  const webhookToken = request.headers.get("x-ecorione-webhook-token");
  if (webhookToken !== null) headers["x-ecorione-webhook-token"] = webhookToken;

  try {
    const upstream = await fetch(`${connectUrl()}/v1/webhooks/${encodeURIComponent(hookId)}`, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    const text = await upstream.text();
    return new Response(text.length === 0 ? undefined : text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Connect webhook ingress tidak tersedia.");
  }
}
