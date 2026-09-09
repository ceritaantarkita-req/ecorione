import { createHash } from "node:crypto";
import {
  ConnectMultimodalProcessResponseSchema,
  ConnectSpeechResponseSchema,
  MultimodalAttachmentSchema,
  MultimodalDerivationSchema,
  MultimodalIngestRequestSchema,
  MultimodalIngestResponseSchema,
  MultimodalProcessExistingRequestSchema,
  SpeechSynthesisRequestSchema,
  SpeechSynthesisResponseSchema,
  defaultTaskForMediaKind,
  makeId,
  maxSensitivity,
  maySendToHosted,
  mediaKindFromMimeType,
  type ActionRequest,
  type ArtifactPointer,
  type AttachmentId,
  type CapabilityId,
  type ConnectMultimodalProcessResponse,
  type ConnectSpeechResponse,
  type MultimodalAttachment,
  type MultimodalDerivation,
  type MultimodalIngestRequest,
  type MultimodalIngestResponse,
  type MultimodalProcessExistingRequest,
  type MultimodalTarget,
  type OperationId,
  type PermissionId,
  type SpeechSynthesisRequest,
  type SpeechSynthesisResponse,
  type Timestamp,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  HttpError,
  RemoteServiceError,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { nowIso } from "./clock.js";
import type { CapabilityRegistry } from "./capability-registry.js";
import type { HistoryLedger } from "./history-ledger.js";
import { evaluatePolicy } from "./policy-engine.js";
import type { HubRepository } from "./repository.js";

const LOCAL_CAPABILITY = "multimodal.process.local" as CapabilityId;
const HOSTED_CAPABILITY = "multimodal.process.hosted" as CapabilityId;
const LOCAL_PERMISSIONS = [
  "artifact.read" as PermissionId,
  "multimodal.invoke" as PermissionId,
  "execution.local" as PermissionId,
] as const;
const HOSTED_PERMISSIONS = [
  "artifact.read" as PermissionId,
  "multimodal.invoke" as PermissionId,
  "network.connect" as PermissionId,
  "provider.spend" as PermissionId,
] as const;

type ProcessCheckpoint = {
  readonly kind: "process-complete";
  readonly response: MultimodalIngestResponse;
};
type SpeechCheckpoint =
  | { readonly kind: "speech-complete"; readonly response: SpeechSynthesisResponse }
  | { readonly kind: "speech-uncertain"; readonly message: string; readonly operationId: OperationId };

export interface MultimodalHubOptions {
  readonly artifactUrl: string;
  readonly contextUrl: string;
  readonly connectUrl: string;
  readonly internalToken?: string | undefined;
  readonly now?: (() => Timestamp) | undefined;
  readonly operationId?: (() => OperationId) | undefined;
}

interface MultimodalHubDeps {
  readonly repo: HubRepository;
  readonly history: HistoryLedger;
  readonly authority: CapabilityRegistry;
}

function stableSuffix(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);
}
function attachmentId(input: {
  workspaceId: string;
  artifact: ArtifactPointer;
}): AttachmentId {
  return `att_${stableSuffix([
    input.workspaceId,
    input.artifact.id,
    input.artifact.scope,
    input.artifact.sensitivity,
    input.artifact.syncClass ?? "LOCAL_ONLY",
  ])}` as AttachmentId;
}
function derivationId(attachment: AttachmentId, operationId: OperationId, task: string): string {
  return `mmd_${stableSuffix([attachment, operationId, task])}`;
}
function historyEventId(operationId: OperationId, kind: string): string {
  return `evt_${stableSuffix([operationId, kind]).slice(0, 24)}`;
}

function connectErrorType(error: RemoteServiceError): string | null {
  if (typeof error.body !== "object" || error.body === null) return null;
  const wrapped = (error.body as { error?: unknown }).error;
  if (typeof wrapped !== "object" || wrapped === null) return null;
  const type = (wrapped as { type?: unknown }).type;
  return typeof type === "string" ? type : null;
}

function eligibleLocalFallback(error: unknown): boolean {
  return error instanceof RemoteServiceError && error.statusCode >= 500;
}

function validateTask(kind: ReturnType<typeof mediaKindFromMimeType>, task: string): void {
  if (kind === null) throw new BadRequestError("MIME type belum didukung oleh Batch 5.");
  const valid =
    (task === "vision" && kind === "image") ||
    (task === "ocr" && (kind === "image" || kind === "document")) ||
    (task === "transcribe" && (kind === "audio" || kind === "video"));
  if (!valid) throw new BadRequestError(`Task ${task} tidak cocok untuk media kind ${kind}.`);
}

function actionRequest(
  operationId: OperationId,
  input: Pick<MultimodalIngestRequest, "scope" | "sensitivity" | "autonomy" | "idempotencyKey">,
  tool: string,
  actionClass: "READ" | "REVERSIBLE_WRITE",
): ActionRequest {
  return {
    operationId,
    module: "Hub",
    tool,
    actionClass,
    args: {},
    scope: input.scope,
    sensitivity: input.sensitivity,
    autonomy: input.autonomy,
    idempotencyKey: actionClass === "READ" ? null : input.idempotencyKey,
  };
}

function evaluateAndAudit(
  deps: MultimodalHubDeps,
  request: ActionRequest,
  now: Timestamp,
): void {
  deps.repo.recordAuditEvent({
    type: "ACTION_REQUESTED",
    operationId: request.operationId,
    module: "Hub",
    detail: { tool: request.tool, actionClass: request.actionClass },
    now,
  });
  const { verdict, rule } = evaluatePolicy(request);
  deps.repo.recordAuditEvent({
    type: "POLICY_EVALUATED",
    operationId: request.operationId,
    module: "Hub",
    detail: { outcome: verdict.outcome, reason: verdict.reason },
    ruleId: rule.id,
    now,
  });
  if (verdict.outcome === "DENY") throw new HttpError(403, "POLICY_DENIED", verdict.reason);
  if (verdict.outcome === "REQUIRE_APPROVAL") {
    throw new HttpError(409, "APPROVAL_REQUIRED", verdict.reason);
  }
}

function authorizeTarget(
  deps: MultimodalHubDeps,
  input: {
    operationId: OperationId;
    workspaceId: MultimodalIngestRequest["workspaceId"];
    target: MultimodalTarget;
    scope: MultimodalIngestRequest["scope"];
    sensitivity: MultimodalIngestRequest["sensitivity"];
    autonomy: MultimodalIngestRequest["autonomy"];
  },
  now: Timestamp,
): void {
  const hosted = input.target === "hosted";
  const capabilityId = hosted ? HOSTED_CAPABILITY : LOCAL_CAPABILITY;
  const permissionIds = hosted ? HOSTED_PERMISSIONS : LOCAL_PERMISSIONS;
  const subject = { kind: "tool" as const, id: `multimodal:${input.target}` };
  const result = deps.authority.authorize({
    operationId: input.operationId,
    workspaceId: input.workspaceId,
    subject,
    capabilityId,
    permissionIds: [...permissionIds],
    scope: input.scope,
    sensitivity: input.sensitivity,
    autonomy: input.autonomy,
  });
  deps.repo.recordAuditEvent({
    type: result.outcome === "ALLOW" ? "CAPABILITY_AUTHORIZED" : "CAPABILITY_DENIED",
    operationId: input.operationId,
    module: "Hub",
    detail: {
      workspaceId: input.workspaceId,
      subject,
      capabilityId,
      permissionIds,
      scope: input.scope,
      sensitivity: input.sensitivity,
      outcome: result.outcome,
    },
    now,
  });
  if (result.outcome === "DENY") {
    throw new HttpError(403, "CAPABILITY_DENIED", result.reason);
  }
}

async function artifactUpload(
  options: MultimodalHubOptions,
  input: MultimodalIngestRequest,
): Promise<ArtifactPointer> {
  try {
    const result = await httpJson<{ pointer: ArtifactPointer }>(`${options.artifactUrl}/v1/artifacts`, {
      token: options.internalToken,
      body: {
        contentBase64: input.contentBase64,
        mimeType: input.mimeType,
        description: input.description,
        scope: input.scope,
        sensitivity: input.sensitivity,
        syncClass: input.syncClass,
      },
    });
    return result.pointer;
  } catch (error) {
    throw new BadGatewayError(
      `Artifact upload gagal: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function contextCreateAttachment(
  options: MultimodalHubOptions,
  attachment: AttachmentId,
  workspaceId: MultimodalIngestRequest["workspaceId"],
  artifact: ArtifactPointer,
  mediaKind: NonNullable<ReturnType<typeof mediaKindFromMimeType>>,
  now: Timestamp,
): Promise<MultimodalAttachment> {
  return MultimodalAttachmentSchema.parse(
    await httpJson(`${options.contextUrl}/v1/multimodal/attachments`, {
      token: options.internalToken,
      body: { id: attachment, workspaceId, artifact, mediaKind, now },
    }),
  );
}

async function contextAttachment(
  options: MultimodalHubOptions,
  id: AttachmentId,
  workspaceId: MultimodalIngestRequest["workspaceId"],
): Promise<MultimodalAttachment> {
  const url = new URL(`/v1/multimodal/attachments/${encodeURIComponent(id)}`, options.contextUrl);
  url.searchParams.set("workspaceId", workspaceId);
  return MultimodalAttachmentSchema.parse(
    await httpJson(url.toString(), { token: options.internalToken }),
  );
}

async function setContextState(
  options: MultimodalHubOptions,
  id: AttachmentId,
  workspaceId: MultimodalIngestRequest["workspaceId"],
  state: "processing" | "failed",
  now: Timestamp,
  error?: string,
): Promise<void> {
  await httpJson(`${options.contextUrl}/v1/multimodal/attachments/${id}/${state}`, {
    token: options.internalToken,
    body: { workspaceId, now, ...(error === undefined ? {} : { error }) },
  });
}

async function connectProcess(
  options: MultimodalHubOptions,
  input: {
    artifact: ArtifactPointer;
    task: MultimodalDerivation["task"];
    target: MultimodalTarget;
    scope: MultimodalIngestRequest["scope"];
    sensitivity: MultimodalIngestRequest["sensitivity"];
    operationId: OperationId;
    now: Timestamp;
  },
): Promise<ConnectMultimodalProcessResponse> {
  return ConnectMultimodalProcessResponseSchema.parse(
    await httpJson(`${options.connectUrl}/v1/multimodal/process`, {
      token: options.internalToken,
      body: input,
    }),
  );
}

async function runProcessTarget(
  deps: MultimodalHubDeps,
  options: MultimodalHubOptions,
  input: {
    artifact: ArtifactPointer;
    task: Exclude<MultimodalDerivation["task"], "tts">;
    route: MultimodalIngestRequest["route"];
    workspaceId: MultimodalIngestRequest["workspaceId"];
    scope: MultimodalIngestRequest["scope"];
    sensitivity: MultimodalIngestRequest["sensitivity"];
    autonomy: MultimodalIngestRequest["autonomy"];
    operationId: OperationId;
    now: Timestamp;
  },
): Promise<ConnectMultimodalProcessResponse> {
  const call = async (target: MultimodalTarget) => {
    if (target === "hosted" && !maySendToHosted(input.artifact.syncClass ?? "LOCAL_ONLY")) {
      throw new HttpError(
        403,
        "HOSTED_EGRESS_DENIED",
        "Attachment belum diberi syncClass CLOUD_ALLOWED/PUBLIC untuk hosted inference.",
      );
    }
    authorizeTarget(deps, { ...input, target }, input.now);
    return connectProcess(options, { ...input, target });
  };

  if (input.route === "hosted-only") return call("hosted");
  if (input.route === "local-only") return call("local");
  try {
    return await call("local");
  } catch (error) {
    if (!eligibleLocalFallback(error)) throw error;
    try {
      return await call("hosted");
    } catch (fallbackError) {
      if (fallbackError instanceof HttpError && fallbackError.statusCode === 403) {
        throw new HttpError(
          503,
          "LOCAL_MULTIMODAL_UNAVAILABLE",
          `Local multimodal gagal dan hosted fallback tidak diizinkan: ${fallbackError.message}`,
        );
      }
      throw fallbackError;
    }
  }
}

function ensureHistorySession(
  history: HistoryLedger,
  sessionId: NonNullable<MultimodalIngestRequest["sessionId"]>,
  input: Pick<MultimodalIngestRequest, "scope" | "sensitivity" | "syncClass">,
  now: Timestamp,
): void {
  const existing = history.getSession(sessionId);
  history.ensureSession({
    id: sessionId,
    createdAt: existing?.createdAt ?? now,
    scope: input.scope,
    sensitivity:
      existing === null ? input.sensitivity : maxSensitivity([existing.sensitivity, input.sensitivity]),
    syncClass: existing?.syncClass ?? input.syncClass,
  });
}

function appendProcessHistory(
  deps: MultimodalHubDeps,
  input: Pick<MultimodalIngestRequest, "sessionId" | "scope" | "sensitivity" | "syncClass">,
  response: MultimodalIngestResponse,
  now: Timestamp,
): void {
  if (input.sessionId === undefined) return;
  try {
    ensureHistorySession(deps.history, input.sessionId, input, now);
    deps.history.appendNext(input.sessionId, {
      id: historyEventId(response.operationId, "multimodal"),
      recordedAt: now,
      eventType: "multimodal.processed",
      actor: "hub",
      operationId: response.operationId,
      parentEventId: null,
      payload: {
        attachmentId: response.attachment.id,
        artifactId: response.attachment.artifact.id,
        derivationId: response.derivation.id,
        task: response.derivation.task,
        language: response.derivation.result.language,
        target: response.derivation.target,
        provider: response.derivation.provider,
        model: response.derivation.model,
      },
    });
  } catch (error) {
    deps.repo.recordAuditEvent({
      type: "HISTORY_WRITE_FAILED",
      operationId: response.operationId,
      module: "Hub",
      detail: { phase: "multimodal", error: error instanceof Error ? error.message : String(error) },
      now,
    });
  }
}

async function commitProcessCheckpoint(
  deps: MultimodalHubDeps,
  options: MultimodalHubOptions,
  input: Pick<MultimodalIngestRequest, "sessionId" | "scope" | "sensitivity" | "syncClass">,
  checkpoint: ProcessCheckpoint,
  now: Timestamp,
): Promise<MultimodalIngestResponse> {
  await httpJson(`${options.contextUrl}/v1/multimodal/derivations`, {
    token: options.internalToken,
    body: checkpoint.response.derivation,
  });
  appendProcessHistory(deps, input, checkpoint.response, now);
  const attachment = await contextAttachment(
    options,
    checkpoint.response.attachment.id,
    checkpoint.response.attachment.workspaceId,
  );
  return MultimodalIngestResponseSchema.parse({
    ...checkpoint.response,
    attachment,
  });
}

async function processAttachment(
  deps: MultimodalHubDeps,
  options: MultimodalHubOptions,
  input: {
    request: Pick<
      MultimodalIngestRequest,
      "workspaceId" | "sessionId" | "route" | "scope" | "sensitivity" | "syncClass" | "autonomy" | "idempotencyKey"
    >;
    attachment: MultimodalAttachment;
    task: Exclude<MultimodalDerivation["task"], "tts">;
    operationId: OperationId;
    now: Timestamp;
  },
): Promise<MultimodalIngestResponse> {
  await setContextState(
    options,
    input.attachment.id,
    input.request.workspaceId,
    "processing",
    input.now,
  );
  let processed: ConnectMultimodalProcessResponse;
  try {
    processed = await runProcessTarget(deps, options, {
      artifact: input.attachment.artifact,
      task: input.task,
      route: input.request.route,
      workspaceId: input.request.workspaceId,
      scope: input.request.scope,
      sensitivity: input.request.sensitivity,
      autonomy: input.request.autonomy,
      operationId: input.operationId,
      now: input.now,
    });
  } catch (error) {
    try {
      await setContextState(
        options,
        input.attachment.id,
        input.request.workspaceId,
        "failed",
        input.now,
        error instanceof Error ? error.message : String(error),
      );
    } catch {
      // Primary failure remains the inference failure.
    }
    deps.repo.recordAuditEvent({
      type: "ACTION_FAILED",
      operationId: input.operationId,
      module: "Hub",
      detail: { tool: "multimodal.process", error: error instanceof Error ? error.message : String(error) },
      now: input.now,
    });
    throw error;
  }

  const derivation = MultimodalDerivationSchema.parse({
    id: derivationId(input.attachment.id, input.operationId, input.task),
    attachmentId: input.attachment.id,
    artifactId: input.attachment.artifact.id,
    operationId: input.operationId,
    sessionId: input.request.sessionId ?? null,
    task: input.task,
    result: processed.result,
    target: processed.target,
    provider: processed.provider,
    model: processed.model,
    scope: input.request.scope,
    sensitivity: input.request.sensitivity,
    syncClass: input.request.syncClass,
    createdAt: input.now,
  });
  const predictedAttachment = MultimodalAttachmentSchema.parse({
    ...input.attachment,
    state: "READY",
    latestDerivationId: derivation.id,
    error: null,
    updatedAt: input.now,
  });
  const response = MultimodalIngestResponseSchema.parse({
    operationId: input.operationId,
    attachment: predictedAttachment,
    derivation,
    deduplicated: false,
  });
  const checkpoint: ProcessCheckpoint = { kind: "process-complete", response };
  try {
    deps.repo.saveIdempotentResult(
      input.request.idempotencyKey,
      input.operationId,
      "multimodal.process",
      checkpoint,
      input.now,
    );
  } catch (error) {
    deps.repo.recordAuditEvent({
      type: "ACTION_FAILED",
      operationId: input.operationId,
      module: "Hub",
      detail: {
        phase: "post-provider-idempotency-bookkeeping",
        providerSucceeded: true,
        error: error instanceof Error ? error.message : String(error),
      },
      now: input.now,
    });
  }
  const committed = await commitProcessCheckpoint(deps, options, input.request, checkpoint, input.now);
  deps.repo.recordAuditEvent({
    type: "ACTION_EXECUTED",
    operationId: input.operationId,
    module: "Hub",
    detail: {
      tool: "multimodal.process",
      attachmentId: committed.attachment.id,
      derivationId: committed.derivation.id,
      target: committed.derivation.target,
    },
    now: input.now,
  });
  return committed;
}

function priorProcess(
  deps: MultimodalHubDeps,
  key: string,
): { response: MultimodalIngestResponse } | null {
  const prior = deps.repo.getIdempotentResult<ProcessCheckpoint>(key);
  if (prior === null) return null;
  if (prior.tool !== "multimodal.process" || prior.result.kind !== "process-complete") {
    throw new ConflictError("Idempotency key sudah dipakai untuk operasi lain.");
  }
  return { response: MultimodalIngestResponseSchema.parse(prior.result.response) };
}

async function speechTarget(
  deps: MultimodalHubDeps,
  options: MultimodalHubOptions,
  input: SpeechSynthesisRequest,
  operationId: OperationId,
  now: Timestamp,
): Promise<ConnectSpeechResponse> {
  const call = async (target: MultimodalTarget) => {
    if (target === "hosted" && !maySendToHosted(input.syncClass)) {
      throw new HttpError(403, "HOSTED_EGRESS_DENIED", "TTS hosted memerlukan CLOUD_ALLOWED/PUBLIC.");
    }
    authorizeTarget(deps, { ...input, target, operationId }, now);
    return ConnectSpeechResponseSchema.parse(
      await httpJson(`${options.connectUrl}/v1/multimodal/speech`, {
        token: options.internalToken,
        body: {
          text: input.text,
          language: input.language,
          voice: input.voice,
          format: input.format,
          scope: input.scope,
          sensitivity: input.sensitivity,
          syncClass: input.syncClass,
          target,
          operationId,
          now,
        },
      }),
    );
  };
  if (input.route === "local-only") return call("local");
  if (input.route === "hosted-only") return call("hosted");
  try {
    return await call("local");
  } catch (error) {
    if (!eligibleLocalFallback(error)) throw error;
    return call("hosted");
  }
}

function appendSpeechHistory(
  deps: MultimodalHubDeps,
  input: SpeechSynthesisRequest,
  response: SpeechSynthesisResponse,
  now: Timestamp,
): void {
  if (input.sessionId === undefined) return;
  try {
    ensureHistorySession(deps.history, input.sessionId, input, now);
    deps.history.appendNext(input.sessionId, {
      id: historyEventId(response.operationId, "speech"),
      recordedAt: now,
      eventType: "speech.synthesized",
      actor: "hub",
      operationId: response.operationId,
      parentEventId: null,
      payload: {
        artifactId: response.artifact.id,
        target: response.target,
        provider: response.provider,
        model: response.model,
      },
    });
  } catch (error) {
    deps.repo.recordAuditEvent({
      type: "HISTORY_WRITE_FAILED",
      operationId: response.operationId,
      module: "Hub",
      detail: { phase: "speech", error: error instanceof Error ? error.message : String(error) },
      now,
    });
  }
}

export function registerMultimodalHubRoutes(
  app: FastifyInstance,
  deps: MultimodalHubDeps,
  options: MultimodalHubOptions,
): void {
  const clock = options.now ?? nowIso;
  const nextOperationId = options.operationId ?? (() => makeId("operation"));

  app.post("/v1/multimodal/ingest", async (req, reply) => {
    const input = parseOrBadRequest(MultimodalIngestRequestSchema, req.body);
    const prior = priorProcess(deps, input.idempotencyKey);
    if (prior !== null) {
      const committed = await commitProcessCheckpoint(
        deps,
        options,
        input,
        { kind: "process-complete", response: prior.response },
        clock(),
      );
      deps.repo.recordAuditEvent({
        type: "ACTION_SKIPPED_IDEMPOTENT",
        operationId: committed.operationId,
        module: "Hub",
        detail: { tool: "multimodal.process", idempotencyKey: input.idempotencyKey },
        now: clock(),
      });
      return reply.send({ ...committed, deduplicated: true });
    }

    const now = clock();
    const operationId = nextOperationId();
    evaluateAndAudit(deps, actionRequest(operationId, input, "multimodal.process", "READ"), now);
    const mediaKind = mediaKindFromMimeType(input.mimeType);
    if (mediaKind === null) throw new BadRequestError(`MIME type tidak didukung: ${input.mimeType}.`);
    const task = input.task ?? defaultTaskForMediaKind(mediaKind);
    validateTask(mediaKind, task);
    const artifact = await artifactUpload(options, input);
    const id = attachmentId({ workspaceId: input.workspaceId, artifact });
    const attachment = await contextCreateAttachment(
      options,
      id,
      input.workspaceId,
      artifact,
      mediaKind,
      now,
    );
    const response = await processAttachment(deps, options, {
      request: input,
      attachment,
      task,
      operationId,
      now,
    });
    return reply.code(201).send(response);
  });

  app.post<{ Params: { id: string } }>("/v1/multimodal/attachments/:id/process", async (req) => {
    const input = parseOrBadRequest(MultimodalProcessExistingRequestSchema, req.body);
    const id = req.params.id as AttachmentId;
    const prior = priorProcess(deps, input.idempotencyKey);
    if (prior !== null) {
      const priorAttachment = prior.response.attachment;
      if (priorAttachment.id !== id) throw new ConflictError("Idempotency key milik attachment lain.");
      return { ...prior.response, deduplicated: true };
    }
    const now = clock();
    const operationId = nextOperationId();
    const attachment = await contextAttachment(options, id, input.workspaceId);
    validateTask(attachment.mediaKind, input.task);
    const request = {
      ...input,
      syncClass: attachment.artifact.syncClass ?? "LOCAL_ONLY",
    };
    evaluateAndAudit(deps, actionRequest(operationId, request, "multimodal.process", "READ"), now);
    return processAttachment(deps, options, {
      request,
      attachment,
      task: input.task,
      operationId,
      now,
    });
  });

  app.post("/v1/multimodal/speech", async (req, reply) => {
    const input = parseOrBadRequest(SpeechSynthesisRequestSchema, req.body);
    const prior = deps.repo.getIdempotentResult<SpeechCheckpoint>(input.idempotencyKey);
    if (prior !== null) {
      if (prior.tool !== "multimodal.speech") throw new ConflictError("Idempotency key sudah dipakai.");
      if (prior.result.kind === "speech-uncertain") {
        throw new ConflictError(
          `Outcome TTS sebelumnya uncertain; automatic provider retry ditolak: ${prior.result.message}`,
        );
      }
      return reply.send({ ...SpeechSynthesisResponseSchema.parse(prior.result.response), deduplicated: true });
    }

    const now = clock();
    const operationId = nextOperationId();
    evaluateAndAudit(deps, actionRequest(operationId, input, "multimodal.speech", "REVERSIBLE_WRITE"), now);
    let output: ConnectSpeechResponse;
    try {
      output = await speechTarget(deps, options, input, operationId, now);
    } catch (error) {
      if (
        error instanceof RemoteServiceError &&
        connectErrorType(error) === "MULTIMODAL_COMMIT_UNCERTAIN"
      ) {
        const checkpoint: SpeechCheckpoint = {
          kind: "speech-uncertain",
          message: error.message,
          operationId,
        };
        try {
          deps.repo.saveIdempotentResult(
            input.idempotencyKey,
            operationId,
            "multimodal.speech",
            checkpoint,
            now,
          );
        } catch {
          // Primary uncertainty remains the Connect outcome.
        }
        throw new HttpError(503, "MULTIMODAL_COMMIT_UNCERTAIN", error.message);
      }
      throw error;
    }
    const response = SpeechSynthesisResponseSchema.parse({
      operationId,
      artifact: output.artifact,
      target: output.target,
      provider: output.provider,
      model: output.model,
      deduplicated: false,
    });
    const checkpoint: SpeechCheckpoint = { kind: "speech-complete", response };
    try {
      deps.repo.saveIdempotentResult(
        input.idempotencyKey,
        operationId,
        "multimodal.speech",
        checkpoint,
        now,
      );
    } catch (error) {
      deps.repo.recordAuditEvent({
        type: "ACTION_FAILED",
        operationId,
        module: "Hub",
        detail: {
          phase: "post-provider-idempotency-bookkeeping",
          providerSucceeded: true,
          error: error instanceof Error ? error.message : String(error),
        },
        now,
      });
    }
    appendSpeechHistory(deps, input, response, now);
    deps.repo.recordAuditEvent({
      type: "ACTION_EXECUTED",
      operationId,
      module: "Hub",
      detail: { tool: "multimodal.speech", artifactId: output.artifact.id, target: output.target },
      now,
    });
    return reply.code(201).send(response);
  });
}
