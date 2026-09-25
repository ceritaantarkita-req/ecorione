import {\n  ProjectIdSchema,\n  ProjectUpdateRequestSchema,\n} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../lib/env";
import { jsonError } from "../../../../lib/proxy";

function headers(): Record<string, string> {
  const result: Record<string, string> = { "content-type": "application/json" };
  const token = internalToken();
  if (token !== undefined) result.authorization = `Bearer ${token}`;
  return result;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await context.params;
  const id = ProjectIdSchema.safeParse(rawId);
  if (!id.success) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }

  const parsed = ProjectUpdateRequestSchema.safeParse(raw);
  if (!parsed.success)\n    return jsonError(400, "BAD_REQUEST", "Project settings tidak valid.");

  try {
    const upstream = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(id.data)}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(parsed.data),
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
