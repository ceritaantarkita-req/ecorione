import {
  ArtifactPointerSchema,
  ProjectIdSchema,
  ProjectSourceRoleSchema,
  ProjectSourceViewSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { artifactUrl, hubUrl, internalToken } from "../../../../../../lib/env";
import { jsonError } from "../../../../../../lib/proxy";

const MAX_PROJECT_SOURCE_UPLOAD_BYTES = 20 * 1024 * 1024;

function authHeaders(contentType = false): Record<string, string> {
  const result: Record<string, string> = contentType
    ? { "content-type": "application/json" }
    : {};
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

async function responseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function passthrough(response: Response, text: string): Response {
  return new Response(text.length === 0 ? undefined : text, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const projectId = await projectIdFrom(context);
  if (projectId === null) return jsonError(400, "BAD_REQUEST", "Project ID tidak valid.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Body upload tidak valid.");
  }

  const workspaceId = WorkspaceIdSchema.safeParse(form.get("workspaceId"));
  if (!workspaceId.success) {
    return jsonError(400, "BAD_REQUEST", "workspaceId tidak valid.");
  }

  const role = ProjectSourceRoleSchema.safeParse(form.get("role") ?? "source");
  if (!role.success) return jsonError(400, "BAD_REQUEST", "Peran source tidak valid.");

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "BAD_REQUEST", "File wajib diisi.");
  if (file.size === 0) return jsonError(400, "BAD_REQUEST", "File kosong.");
  if (file.size > MAX_PROJECT_SOURCE_UPLOAD_BYTES) {
    return jsonError(
      400,
      "BAD_REQUEST",
      `File melewati batas ${String(MAX_PROJECT_SOURCE_UPLOAD_BYTES)} byte.`,
    );
  }

  const name = file.name.trim() || "project-source";
  const mimeType = file.type.trim() || "application/octet-stream";
  if (mimeType.length > 128) return jsonError(400, "BAD_REQUEST", "MIME type terlalu panjang.");

  let projectResponse: Response;
  try {
    projectResponse = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId.data)}`,
      {
        headers: authHeaders(),
        redirect: "error",
        cache: "no-store",
      },
    );
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }
  const projectText = await responseText(projectResponse);
  if (!projectResponse.ok) return passthrough(projectResponse, projectText);

  const bytes = Buffer.from(await file.arrayBuffer());
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(`${artifactUrl()}/v1/artifacts`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        contentBase64: bytes.toString("base64"),
        mimeType,
        description: `Project source: ${name}`.slice(0, 200),
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      }),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Artifact tidak bisa dihubungi.");
  }

  const uploadText = await responseText(uploadResponse);
  if (!uploadResponse.ok) return passthrough(uploadResponse, uploadText);

  let uploadBody: unknown;
  try {
    uploadBody = JSON.parse(uploadText);
  } catch {
    return jsonError(502, "BAD_UPSTREAM_RESPONSE", "Respons Artifact tidak valid.");
  }
  const uploadObject = object(uploadBody);
  const pointer = ArtifactPointerSchema.safeParse(uploadObject?.pointer);
  if (!pointer.success) {
    return jsonError(502, "BAD_UPSTREAM_RESPONSE", "Respons Artifact tidak valid.");
  }

  let attachResponse: Response;
  try {
    attachResponse = await fetch(
      `${hubUrl()}/v1/projects/${encodeURIComponent(projectId)}/sources`,
      {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          workspaceId: workspaceId.data,
          resourceType: "artifact",
          resourceId: pointer.data.id,
          role: role.data,
        }),
        redirect: "error",
        cache: "no-store",
      },
    );
  } catch {
    return jsonError(502, "UPSTREAM_UNAVAILABLE", "Hub tidak bisa dihubungi.");
  }

  const attachText = await responseText(attachResponse);
  if (!attachResponse.ok) return passthrough(attachResponse, attachText);

  let attachBody: unknown;
  try {
    attachBody = JSON.parse(attachText);
  } catch {
    return jsonError(502, "BAD_UPSTREAM_RESPONSE", "Respons Hub tidak valid.");
  }
  const source = ProjectSourceViewSchema.safeParse(attachBody);
  if (!source.success) {
    return jsonError(502, "BAD_UPSTREAM_RESPONSE", "Respons Hub tidak valid.");
  }

  return Response.json(
    {
      artifact: pointer.data,
      deduplicated: uploadObject?.deduplicated === true,
      source: source.data,
    },
    { status: attachResponse.status },
  );
}
