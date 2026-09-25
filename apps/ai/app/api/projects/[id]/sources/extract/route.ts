import {
  ProjectIdSchema,
  ProjectSourceExtractRequestSchema,
  makeId,
} from "@ecorione/shared-schema";
import { hubUrl, internalToken } from "../../../../../../lib/env";
import { jsonError } from "../../../../../../lib/proxy";

const BodySchema = ProjectSourceExtractRequestSchema.omit({ operationId: true });

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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const projectId = await projectIdFrom(context);
  if (projectId === null) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body bukan JSON valid.");
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "BAD_REQUEST", "Permintaan extraction tidak valid.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(projectId)}/sources/extract`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          operationId: makeId("operation"),
          workspaceId: parsed.data.workspaceId,
          artifactId: parsed.data.artifactId,
        }),
        redirect: "error",
        cache: "no-store",
      },
    );
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }

  const text = await upstream.text();
  return new Response(text.length === 0 ? undefined : text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
