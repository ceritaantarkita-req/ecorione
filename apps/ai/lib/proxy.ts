/**
 * Bagian yang sama antara `app/api/chat/route.ts` dan `app/api/forget/route.ts`: kedua
 * route handler itu hanya beda skema Zod dan path Hub, sisanya (parse body, forward
 * dengan token, teruskan status/berapa pun Hub balas) identik — ditarik ke sini supaya
 * tidak diduplikasi (AGENTS.md: skema/kontrak jangan diduplikasi antar modul).
 */

import type { ZodType } from "zod";
import { hubUrl, internalToken } from "./env";

export function jsonError(
  status: number,
  type: string,
  message: string,
  detail?: unknown,
): Response {
  const error: Record<string, unknown> = { type, message };
  if (detail !== undefined) error.detail = detail;
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { type: "BAD_GATEWAY", message: "Respons Hub bukan JSON valid." } };
  }
}

/**
 * Validasi body request dengan `schema`, lalu — kalau valid — teruskan ke
 * `${hubUrl()}${hubPath}` sebagai POST dengan `Authorization: Bearer <token>` (kalau
 * token diisi). Status & body respons Hub diteruskan apa adanya (termasuk error Hub),
 * tidak pernah diratakan jadi 500 generik. Kegagalan menghubungi Hub sama sekali (bukan
 * error HTTP dari Hub, tapi jaringan/down) → 502 `UPSTREAM_UNAVAILABLE` eksplisit —
 * tidak ada fallback diam-diam ke jawaban tanpa Hub (`prd.md` §7).
 */
export async function proxyToHub<T>(
  request: Request,
  schema: ZodType<T>,
  hubPath: string,
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Input tidak valid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const token = internalToken();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${hubUrl()}${hubPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(parsed.data),
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }

  const text = await upstream.text();
  const body = text.length > 0 ? safeJsonParse(text) : undefined;

  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
