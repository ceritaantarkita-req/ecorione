import { SessionIdSchema } from "@ecorione/shared-schema";
import {
  AttachmentInputError,
  AttachmentUpstreamError,
  MAX_CHAT_ATTACHMENT_BYTES,
  ingestAttachment,
  type AttachmentTarget,
} from "../../../lib/attachment-ingest";

export const runtime = "nodejs";

function errorResponse(status: number, type: string, message: string): Response {
  return Response.json({ error: { type, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "ATTACHMENT_INVALID", "Form lampiran tidak valid.");
  }

  const sessionResult = SessionIdSchema.safeParse(form.get("sessionId"));
  if (!sessionResult.success) {
    return errorResponse(400, "ATTACHMENT_INVALID", "Session lampiran tidak valid.");
  }

  const targetEntry = form.get("target");
  if (targetEntry !== "local" && targetEntry !== "hosted") {
    return errorResponse(400, "ATTACHMENT_INVALID", "Target lampiran harus local atau hosted.");
  }
  const target: AttachmentTarget = targetEntry;

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    return errorResponse(400, "ATTACHMENT_INVALID", "File lampiran wajib diisi.");
  }
  if (fileEntry.size === 0) {
    return errorResponse(400, "ATTACHMENT_INVALID", "Lampiran kosong.");
  }
  if (fileEntry.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return errorResponse(
      400,
      "ATTACHMENT_INVALID",
      `Lampiran melewati batas ${String(MAX_CHAT_ATTACHMENT_BYTES)} byte.`,
    );
  }

  try {
    const attachment = await ingestAttachment(
      {
        sessionId: sessionResult.data,
        target,
        fileName: fileEntry.name,
        mimeType: fileEntry.type,
        bytes: new Uint8Array(await fileEntry.arrayBuffer()),
      },
      {
        artifactUrl: process.env.ECORIONE_ARTIFACT_URL ?? "http://127.0.0.1:17025",
        hubUrl: process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024",
        internalToken: process.env.ECORIONE_INTERNAL_TOKEN || undefined,
      },
    );
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    if (error instanceof AttachmentInputError) {
      return errorResponse(error.statusCode, error.code, error.message);
    }
    if (error instanceof AttachmentUpstreamError) {
      return errorResponse(error.statusCode, error.code, error.message);
    }
    return errorResponse(500, "ATTACHMENT_FAILED", "Lampiran gagal diproses.");
  }
}
