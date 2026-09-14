import { readJson } from "./client-response";

export type ChatAttachmentTarget = "local" | "hosted";
export type ChatAttachmentState = "staged" | "uploading" | "ready" | "error";

export interface ChatAttachment {
  readonly id: string;
  readonly kind: "file" | "note";
  readonly label: string;
  readonly state: ChatAttachmentState;
  readonly file?: File | undefined;
  readonly noteText?: string | undefined;
  readonly artifactId?: string | undefined;
  readonly contextEpisodeId?: string | undefined;
  readonly error?: string | undefined;
}

interface AttachmentApiResponse {
  readonly attachment?: {
    readonly artifactId?: unknown;
    readonly contextEpisodeId?: unknown;
    readonly state?: unknown;
  };
}

export interface UploadedChatAttachment {
  readonly artifactId: string;
  readonly contextEpisodeId: string;
}

export const MAX_COMPOSER_ATTACHMENTS = 20;

function isUploadedAttachment(value: AttachmentApiResponse): value is {
  attachment: {
    artifactId: string;
    contextEpisodeId: string;
    state: "READY";
  };
} {
  return (
    typeof value.attachment?.artifactId === "string" &&
    value.attachment.artifactId.startsWith("art_") &&
    typeof value.attachment.contextEpisodeId === "string" &&
    value.attachment.contextEpisodeId.startsWith("epi_") &&
    value.attachment.state === "READY"
  );
}

export async function uploadChatAttachment(
  input: {
    readonly sessionId: string;
    readonly target: ChatAttachmentTarget;
    readonly file: File;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<UploadedChatAttachment> {
  const form = new FormData();
  form.set("sessionId", input.sessionId);
  form.set("target", input.target);
  form.set("file", input.file, input.file.name);

  const response = await fetchImpl("/api/attachments", {
    method: "POST",
    body: form,
  });
  const payload = await readJson<AttachmentApiResponse>(
    response,
    "Lampiran gagal diproses. Coba lagi atau periksa status layanan.",
  );
  if (!isUploadedAttachment(payload)) {
    throw new Error("Respons lampiran tidak valid.");
  }
  return {
    artifactId: payload.attachment.artifactId,
    contextEpisodeId: payload.attachment.contextEpisodeId,
  };
}

export async function uploadPendingChatAttachments(
  attachments: readonly ChatAttachment[],
  input: {
    readonly sessionId: string;
    readonly target: ChatAttachmentTarget;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<ChatAttachment[]> {
  return await Promise.all(
    attachments.map(async (attachment): Promise<ChatAttachment> => {
      if (attachment.kind !== "file" || attachment.contextEpisodeId !== undefined) {
        return attachment;
      }
      if (attachment.file === undefined) {
        return {
          ...attachment,
          state: "error",
          error: "File lampiran tidak tersedia.",
        };
      }
      try {
        const uploaded = await uploadChatAttachment(
          { sessionId: input.sessionId, target: input.target, file: attachment.file },
          fetchImpl,
        );
        return {
          ...attachment,
          state: "ready",
          artifactId: uploaded.artifactId,
          contextEpisodeId: uploaded.contextEpisodeId,
          error: undefined,
        };
      } catch (error) {
        return {
          ...attachment,
          state: "error",
          error: error instanceof Error ? error.message : "Lampiran gagal diproses.",
        };
      }
    }),
  );
}

export function attachmentCanBeRemoved(attachment: ChatAttachment): boolean {
  if (attachment.kind === "note") return true;
  return attachment.contextEpisodeId === undefined && attachment.state !== "uploading";
}

export function attachmentNeedsUpload(attachment: ChatAttachment): boolean {
  return (
    attachment.kind === "file" &&
    attachment.contextEpisodeId === undefined &&
    attachment.state !== "error"
  );
}

export function attachmentsReadyForSend(attachments: readonly ChatAttachment[]): boolean {
  return attachments.every(
    (attachment) => attachment.state === "staged" || attachment.state === "ready",
  );
}

export function buildAttachmentAwareMessage(
  draft: string,
  attachments: readonly ChatAttachment[],
): string {
  const trimmed = draft.trim();
  const notes = attachments
    .filter((attachment) => attachment.kind === "note")
    .map((attachment) => attachment.noteText?.trim() ?? "")
    .filter((note) => note.length > 0);
  const blocks = [trimmed, ...notes].filter((block) => block.length > 0);
  if (blocks.length > 0) return blocks.join("\n\n");
  return attachments.some((attachment) => attachment.kind === "file")
    ? "Analisis lampiran yang saya kirim."
    : "";
}

export function attachmentChipLabel(attachment: ChatAttachment): string {
  if (attachment.state === "uploading") return `${attachment.label} · mengunggah…`;
  if (attachment.state === "error") return `${attachment.label} · gagal`;
  return attachment.label;
}
