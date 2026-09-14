import {
  ArtifactPointerSchema,
  MultimodalAnalyzeResponseSchema,
  makeId,
  type OperationId,
  type SessionId,
} from "@ecorione/shared-schema";

export const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type AttachmentTarget = "local" | "hosted";
export type AttachmentAnalyzeTask = "ocr" | "vision" | "transcribe";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
]);

const EXTENSION_MIME_TYPES: Readonly<Record<string, string>> = {
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "text/plain",
  ".md": "text/markdown",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

export class AttachmentInputError extends Error {
  readonly statusCode = 400;
  readonly code = "ATTACHMENT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "AttachmentInputError";
  }
}

export class AttachmentUpstreamError extends Error {
  readonly statusCode = 502;
  readonly code = "ATTACHMENT_UPSTREAM_UNAVAILABLE";

  constructor(service: "Artifact" | "Hub", message?: string) {
    super(
      message === undefined
        ? `${service} tidak tersedia untuk lampiran.`
        : `${service}: ${message}`,
    );
    this.name = "AttachmentUpstreamError";
  }
}

export interface AttachmentIngestInput {
  readonly sessionId: SessionId;
  readonly target: AttachmentTarget;
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface AttachmentIngestDeps {
  readonly artifactUrl: string;
  readonly hubUrl: string;
  readonly internalToken?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly operationId?: (() => OperationId) | undefined;
}

export interface IngestedAttachment {
  readonly artifactId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly task: AttachmentAnalyzeTask;
  readonly contextEpisodeId: string;
  readonly historyEventId: string;
  readonly routeUsed: AttachmentTarget;
  readonly state: "READY";
}

export function resolveAttachmentMimeType(
  fileName: string,
  declaredMimeType: string,
): string {
  const declared = declaredMimeType.trim().toLowerCase();
  if (declared !== "" && declared !== "application/octet-stream") return declared;
  const normalizedName = fileName.trim().toLowerCase();
  const extension = Object.keys(EXTENSION_MIME_TYPES).find((candidate) =>
    normalizedName.endsWith(candidate),
  );
  return extension === undefined ? declared : (EXTENSION_MIME_TYPES[extension] ?? declared);
}

export function attachmentTaskForMimeType(mimeType: string): AttachmentAnalyzeTask | null {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) return "vision";
  if (normalized.startsWith("audio/") || normalized.startsWith("video/")) return "transcribe";
  if (normalized.startsWith("text/") || DOCUMENT_MIME_TYPES.has(normalized)) return "ocr";
  return null;
}

function authHeaders(token: string | undefined): Record<string, string> {
  return token === undefined || token === "" ? {} : { authorization: `Bearer ${token}` };
}

function safeUpstreamMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null || !("message" in error)) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() !== "" ? message : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function ingestAttachment(
  input: AttachmentIngestInput,
  deps: AttachmentIngestDeps,
): Promise<IngestedAttachment> {
  if (input.bytes.byteLength === 0) throw new AttachmentInputError("Lampiran kosong.");
  if (input.bytes.byteLength > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new AttachmentInputError(
      `Lampiran melewati batas ${String(MAX_CHAT_ATTACHMENT_BYTES)} byte.`,
    );
  }

  const name = input.fileName.trim() || "attachment";
  const mimeType = resolveAttachmentMimeType(name, input.mimeType);
  const task = attachmentTaskForMimeType(mimeType);
  if (task === null) {
    throw new AttachmentInputError(`Tipe file ${mimeType || "tidak dikenal"} belum didukung.`);
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const syncClass = input.target === "hosted" ? "CLOUD_ALLOWED" : "LOCAL_ONLY";
  let uploadResponse: Response;
  try {
    uploadResponse = await fetchImpl(`${deps.artifactUrl}/v1/artifacts`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders(deps.internalToken) },
      body: JSON.stringify({
        contentBase64: Buffer.from(input.bytes).toString("base64"),
        mimeType,
        description: `Chat attachment: ${name}`.slice(0, 200),
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass,
      }),
    });
  } catch {
    throw new AttachmentUpstreamError("Artifact");
  }
  const uploadBody = await readJson(uploadResponse);
  if (!uploadResponse.ok) {
    throw new AttachmentUpstreamError("Artifact", safeUpstreamMessage(uploadBody));
  }
  const pointerResult = ArtifactPointerSchema.safeParse(
    typeof uploadBody === "object" && uploadBody !== null && "pointer" in uploadBody
      ? (uploadBody as { pointer: unknown }).pointer
      : undefined,
  );
  if (!pointerResult.success) {
    throw new AttachmentUpstreamError("Artifact", "respons pointer tidak valid.");
  }

  const operationId = deps.operationId?.() ?? makeId("operation");
  let analyzeResponse: Response;
  try {
    analyzeResponse = await fetchImpl(`${deps.hubUrl}/v1/multimodal/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders(deps.internalToken) },
      body: JSON.stringify({
        operationId,
        sessionId: input.sessionId,
        artifactId: pointerResult.data.id,
        scope: "personal",
        maxSensitivity: "INTERNAL",
        task,
        route: { preferred: input.target, allowHostedFallback: false },
      }),
    });
  } catch {
    throw new AttachmentUpstreamError("Hub");
  }
  const analyzeBody = await readJson(analyzeResponse);
  if (!analyzeResponse.ok) {
    throw new AttachmentUpstreamError("Hub", safeUpstreamMessage(analyzeBody));
  }
  const analyzed = MultimodalAnalyzeResponseSchema.safeParse(analyzeBody);
  if (!analyzed.success) {
    throw new AttachmentUpstreamError("Hub", "respons analisis tidak valid.");
  }

  return {
    artifactId: pointerResult.data.id,
    name,
    mimeType: pointerResult.data.mimeType,
    sizeBytes: pointerResult.data.sizeBytes,
    task,
    contextEpisodeId: analyzed.data.contextEpisodeId,
    historyEventId: analyzed.data.historyEventId,
    routeUsed: analyzed.data.result.routeUsed,
    state: "READY",
  };
}
