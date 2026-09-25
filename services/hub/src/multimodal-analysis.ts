import {
  maySendToHosted,
  type ArtifactPointer,
  type CapabilityId,
  type MultimodalAdapterResult,
  type MultimodalAnalyzeRequest,
  type MultimodalAnalyzeTask,
  type PermissionId,
  type Scope,
  type Sensitivity,
  type SyncClass,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@ecorione/shared-server";
import type { CapabilityRegistry } from "./capability-registry.js";
import type { HubRepository } from "./repository.js";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
]);

function isDocumentMime(mimeType: string): boolean {
  return mimeType.startsWith("text/") || DOCUMENT_MIME_TYPES.has(mimeType);
}

export function analyzeTaskForMimeType(mimeType: string): MultimodalAnalyzeTask {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) return "vision";
  if (normalized.startsWith("audio/") || normalized.startsWith("video/")) {
    return "transcribe";
  }
  if (isDocumentMime(normalized)) return "ocr";
  throw new BadRequestError(`MIME ${mimeType} belum didukung untuk Project extraction.`);
}

export function assertAnalyzeMime(
  task: MultimodalAnalyzeRequest["task"],
  mimeType: string,
): void {
  const normalized = mimeType.trim().toLowerCase();
  const mediaImage = normalized.startsWith("image/");
  const document = isDocumentMime(normalized);
  if ((task === "ocr" || task === "vision") && (mediaImage || document)) return;
  if (
    task === "transcribe" &&
    (normalized.startsWith("audio/") || normalized.startsWith("video/"))
  ) {
    return;
  }
  throw new BadRequestError(`MIME ${mimeType} tidak didukung untuk task ${task}.`);
}

export async function artifactContentBase64(
  options: {
    readonly artifactUrl: string;
    readonly internalToken?: string | undefined;
  },
  pointer: ArtifactPointer,
): Promise<string> {
  const query = new URLSearchParams({
    scope: pointer.scope,
    maxSensitivity: pointer.sensitivity,
    hostedEligible: "0",
  });
  const headers = new Headers();
  if (options.internalToken !== undefined) {
    headers.set("authorization", `Bearer ${options.internalToken}`);
  }
  let response: Response;
  try {
    response = await fetch(
      `${options.artifactUrl}/v1/artifacts/${pointer.id}/content?${query.toString()}`,
      { headers, redirect: "error" },
    );
  } catch {
    throw new BadGatewayError("Artifact tidak tersedia.");
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError(`Artifact content tidak ditemukan: ${pointer.id}.`);
    }
    if (response.status === 403) {
      throw new ForbiddenError("Artifact content ditolak owner boundary.");
    }
    throw new BadGatewayError(
      `Artifact content gagal dibaca (HTTP ${String(response.status)}).`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== pointer.sizeBytes) {
    throw new BadGatewayError(`Artifact ${pointer.id} berubah ukuran setelah authorization.`);
  }
  return bytes.toString("base64");
}

export function requestedRoutes(
  route: MultimodalAnalyzeRequest["route"],
): readonly ("local" | "hosted")[] {
  if (route.preferred === "hosted") return ["hosted"];
  return route.allowHostedFallback ? ["local", "hosted"] : ["local"];
}

export function authorizeInference(input: {
  authority: CapabilityRegistry;
  repo: HubRepository;
  workspaceId: WorkspaceId;
  operationId: MultimodalAnalyzeRequest["operationId"];
  routes: readonly ("local" | "hosted")[];
  scope: Scope;
  sensitivity: Sensitivity;
  syncClass: SyncClass;
  now: Timestamp;
}): void {
  for (const route of input.routes) {
    if (route === "hosted" && !maySendToHosted(input.syncClass)) {
      throw new ForbiddenError(
        `syncClass ${input.syncClass} tidak mengizinkan plaintext hosted inference.`,
      );
    }
    const capabilityId = (
      route === "hosted" ? "model.invoke.hosted" : "model.invoke.local"
    ) as CapabilityId;
    const permissionIds = (
      route === "hosted"
        ? ["model.invoke", "network.connect", "provider.spend"]
        : ["model.invoke", "execution.local"]
    ) as PermissionId[];
    const result = input.authority.authorize({
      operationId: input.operationId,
      workspaceId: input.workspaceId,
      subject: { kind: "model", id: route },
      capabilityId,
      permissionIds,
      scope: input.scope,
      sensitivity: input.sensitivity,
      autonomy: "L1",
    });
    input.repo.recordAuditEvent({
      type: result.outcome === "ALLOW" ? "CAPABILITY_AUTHORIZED" : "CAPABILITY_DENIED",
      operationId: input.operationId,
      module: "Hub",
      detail: {
        route,
        capabilityId,
        permissionIds,
        scope: input.scope,
        sensitivity: input.sensitivity,
      },
      now: input.now,
    });
    if (result.outcome === "DENY") throw new ForbiddenError(result.reason);
  }
}

export function semanticMultimodalResult(
  result: MultimodalAdapterResult,
): Omit<MultimodalAdapterResult, "audioBase64" | "audioMimeType"> {
  const { audioBase64: _audioBase64, audioMimeType: _audioMimeType, ...semantic } = result;
  return semantic;
}
