import { createHash } from "node:crypto";
import {
  ArtifactPointerSchema,
  MultimodalAdapterResultSchema,
  MultimodalAnalyzeRequestSchema,
  MultimodalAnalyzeResponseSchema,
  MultimodalSynthesizeRequestSchema,
  MultimodalSynthesizeResponseSchema,
  OperationIdSchema,
  assertId,
  makeId,
  maySendToHosted,
  type ArtifactPointer,
  type CapabilityId,
  type Episode,
  type MultimodalAdapterResult,
  type MultimodalAnalyzeRequest,
  type MultimodalAnalyzeResponse,
  type MultimodalSynthesizeResponse,
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
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  RemoteServiceError,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import type { CapabilityRegistry } from "./capability-registry.js";
import type { HistoryLedger } from "./history-ledger.js";
import type { HubRepository } from "./repository.js";
import {
  MultimodalRunConflictError,
  MultimodalRunNotFoundError,
  type MultimodalRunStore,
} from "./multimodal-runs.js";

export interface MultimodalRouteOptions {
  readonly contextUrl: string;
  readonly connectUrl: string;
  readonly artifactUrl: string;
  readonly internalToken?: string | undefined;
  readonly now: () => Timestamp;
}

interface ArtifactUploadResponse {
  readonly pointer: ArtifactPointer;
  readonly deduplicated: boolean;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function upstreamHttpError(service: string, error: unknown): never {
  if (error instanceof RemoteServiceError) {
    if (error.statusCode === 404) throw new NotFoundError(error.message);
    if (error.statusCode === 403) throw new ForbiddenError(error.message);
    if (error.statusCode >= 400 && error.statusCode < 500) {
      throw new HttpError(
        error.statusCode,
        "UPSTREAM_REJECTED",
        `${service}: ${error.message}`,
      );
    }
  }
  throw new BadGatewayError(`${service} tidak tersedia.`);
}

async function serviceJson<T>(
  service: string,
  url: string,
  token: string | undefined,
  init: { readonly method?: "GET" | "POST"; readonly body?: unknown } = {},
): Promise<T> {
  try {
    return await httpJson<T>(url, { token, ...init });
  } catch (error) {
    upstreamHttpError(service, error);
  }
}

async function artifactBytes(
  options: MultimodalRouteOptions,
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
      { headers },
    );
  } catch {
    throw new BadGatewayError("Artifact tidak tersedia.");
  }
  if (!response.ok) {
    if (response.status === 404)
      throw new NotFoundError(`Artifact content tidak ditemukan: ${pointer.id}.`);
    if (response.status === 403)
      throw new ForbiddenError("Artifact content ditolak owner boundary.");
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

function assertMime(task: MultimodalAnalyzeRequest["task"], mimeType: string): void {
  const mediaImage = mimeType.startsWith("image/");
  const document =
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.oasis.opendocument.text" ||
    mimeType.startsWith("text/");
  if ((task === "ocr" || task === "vision") && (mediaImage || document)) return;
  if (task === "transcribe" && (mimeType.startsWith("audio/") || mimeType.startsWith("video/")))
    return;
  throw new BadRequestError(`MIME ${mimeType} tidak didukung untuk task ${task}.`);
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

function stripAudio(
  result: MultimodalAdapterResult,
): Omit<MultimodalAdapterResult, "audioBase64" | "audioMimeType"> {
  const { audioBase64: _audioBase64, audioMimeType: _audioMimeType, ...semantic } = result;
  return semantic;
}

function eventType(
  task: MultimodalAnalyzeRequest["task"],
): "artifact.extracted" | "artifact.transcribed" {
  return task === "transcribe" ? "artifact.transcribed" : "artifact.extracted";
}

function retryResult<T>(
  status: { state: string },
  priorResult: unknown | null,
  parse: (value: unknown) => T,
): T | null {
  if (status.state === "READY" && priorResult !== null) return parse(priorResult);
  if (status.state === "PROCESSING" || status.state === "FAILED") {
    throw new ConflictError(
      status.state === "PROCESSING"
        ? "Multimodal operation masih/sempat PROCESSING; gunakan status endpoint sebelum membuat operation baru."
        : "Multimodal operation sebelumnya FAILED; gunakan operationId baru agar efek samping tidak diduplikasi.",
    );
  }
  return null;
}

function beginRun(
  runs: MultimodalRunStore,
  input: Parameters<MultimodalRunStore["begin"]>[0],
): ReturnType<MultimodalRunStore["begin"]> {
  try {
    return runs.begin(input);
  } catch (error) {
    if (error instanceof MultimodalRunConflictError) throw new ConflictError(error.message);
    throw error;
  }
}

export function registerMultimodalRoutes(
  app: FastifyInstance,
  deps: {
    readonly repo: HubRepository;
    readonly history: HistoryLedger;
    readonly authority: CapabilityRegistry;
    readonly runs: MultimodalRunStore;
  },
  options: MultimodalRouteOptions,
): void {
  app.post("/v1/multimodal/analyze", async (request) => {
    const body = parseOrBadRequest(MultimodalAnalyzeRequestSchema, request.body);
    const now = options.now();
    const begun = beginRun(deps.runs, {
      operationId: body.operationId,
      fingerprint: fingerprint(body),
      sessionId: body.sessionId,
      task: body.task,
      sourceArtifactId: body.artifactId,
      now,
    });
    const prior = retryResult(begun.status, begun.priorResult, (value) =>
      MultimodalAnalyzeResponseSchema.parse(value),
    );
    if (prior !== null) return prior;
    deps.runs.markProcessing(body.operationId, now);
    try {
      const scope = encodeURIComponent(body.scope);
      const max = encodeURIComponent(body.maxSensitivity);
      const pointer = ArtifactPointerSchema.parse(
        await serviceJson<ArtifactPointer>(
          "Context",
          `${options.contextUrl}/v1/artifacts/${body.artifactId}/authorize?scope=${scope}&maxSensitivity=${max}&hostedEligible=0`,
          options.internalToken,
        ),
      );
      assertMime(body.task, pointer.mimeType);
      const syncClass = pointer.syncClass ?? "LOCAL_ONLY";
      const workspaceId = body.workspaceId ?? assertId("workspace", "ws_personal");
      authorizeInference({
        authority: deps.authority,
        repo: deps.repo,
        workspaceId,
        operationId: body.operationId,
        routes: requestedRoutes(body.route),
        scope: pointer.scope,
        sensitivity: pointer.sensitivity,
        syncClass,
        now,
      });
      deps.history.ensureSession({
        id: body.sessionId,
        createdAt: now,
        scope: pointer.scope,
        sensitivity: pointer.sensitivity,
        syncClass,
      });
      const contentBase64 = await artifactBytes(options, pointer);
      const inferred = MultimodalAdapterResultSchema.parse(
        await serviceJson<MultimodalAdapterResult>(
          "Connect",
          `${options.connectUrl}/v1/multimodal/infer`,
          options.internalToken,
          {
            method: "POST",
            body: {
              operationId: body.operationId,
              task: body.task,
              route: body.route,
              syncClass,
              mimeType: pointer.mimeType,
              contentBase64,
            },
          },
        ),
      );
      if (inferred.audioBase64 !== undefined || inferred.audioMimeType !== undefined) {
        throw new BadGatewayError(
          "Adapter analisis media mengembalikan audio yang tidak diminta.",
        );
      }
      const episode = await serviceJson<Episode>(
        "Context",
        `${options.contextUrl}/v1/episodes`,
        options.internalToken,
        {
          method: "POST",
          body: {
            ts: now,
            rawText: inferred.text,
            provenance: {
              sourceApp: "hub:multimodal",
              sessionId: body.sessionId,
              toolCallId: body.operationId,
              sourceUri: `artifact:${body.artifactId}`,
            },
            scope: pointer.scope,
            sensitivity: pointer.sensitivity,
            syncClass,
            trust: inferred.routeUsed === "hosted" ? "HOSTED_AGENT" : "LOCAL_AGENT",
          },
        },
      );
      const semanticResult = stripAudio(inferred);
      await serviceJson(
        "Context",
        `${options.contextUrl}/v1/multimodal/derivations`,
        options.internalToken,
        {
          method: "POST",
          body: {
            operationId: body.operationId,
            sourceArtifactId: body.artifactId,
            episodeId: episode.id,
            task: body.task,
            result: semanticResult,
            scope: pointer.scope,
            sensitivity: pointer.sensitivity,
            syncClass,
            trust: inferred.routeUsed === "hosted" ? "HOSTED_AGENT" : "LOCAL_AGENT",
            createdAt: now,
          },
        },
      );
      const historyEvent = deps.history.appendNext(body.sessionId, {
        id: makeId("event"),
        recordedAt: now,
        eventType: eventType(body.task),
        actor: "connect:multimodal",
        operationId: body.operationId,
        parentEventId: null,
        payload: {
          sourceArtifactId: body.artifactId,
          contextEpisodeId: episode.id,
          task: body.task,
          routeUsed: inferred.routeUsed,
          adapter: inferred.adapter,
          provider: inferred.provider,
          model: inferred.model,
          language: inferred.language,
          segmentCount: inferred.segments.length,
        },
      }).event;
      const response: MultimodalAnalyzeResponse = MultimodalAnalyzeResponseSchema.parse({
        operationId: body.operationId,
        sessionId: body.sessionId,
        sourceArtifactId: body.artifactId,
        task: body.task,
        state: "READY",
        result: semanticResult,
        contextEpisodeId: episode.id,
        historyEventId: historyEvent.id,
      });
      deps.runs.complete({
        operationId: body.operationId,
        routeUsed: inferred.routeUsed,
        result: response,
        now,
      });
      return response;
    } catch (error) {
      deps.runs.fail(
        body.operationId,
        error instanceof Error ? error.message : String(error),
        now,
      );
      throw error;
    }
  });

  app.post("/v1/multimodal/synthesize", async (request) => {
    const body = parseOrBadRequest(MultimodalSynthesizeRequestSchema, request.body);
    const now = options.now();
    const begun = beginRun(deps.runs, {
      operationId: body.operationId,
      fingerprint: fingerprint(body),
      sessionId: body.sessionId,
      task: "synthesize",
      sourceArtifactId: null,
      now,
    });
    const prior = retryResult(begun.status, begun.priorResult, (value) =>
      MultimodalSynthesizeResponseSchema.parse(value),
    );
    if (prior !== null) return prior;
    deps.runs.markProcessing(body.operationId, now);
    try {
      const workspaceId = body.workspaceId ?? assertId("workspace", "ws_personal");
      authorizeInference({
        authority: deps.authority,
        repo: deps.repo,
        workspaceId,
        operationId: body.operationId,
        routes: requestedRoutes(body.route),
        scope: body.scope,
        sensitivity: body.sensitivity,
        syncClass: body.syncClass,
        now,
      });
      deps.history.ensureSession({
        id: body.sessionId,
        createdAt: now,
        scope: body.scope,
        sensitivity: body.sensitivity,
        syncClass: body.syncClass,
      });
      const inferred = MultimodalAdapterResultSchema.parse(
        await serviceJson<MultimodalAdapterResult>(
          "Connect",
          `${options.connectUrl}/v1/multimodal/infer`,
          options.internalToken,
          {
            method: "POST",
            body: {
              operationId: body.operationId,
              task: "synthesize",
              route: body.route,
              syncClass: body.syncClass,
              text: body.text,
              language: body.language,
              voice: body.voice,
            },
          },
        ),
      );
      if (inferred.audioBase64 === undefined || inferred.audioMimeType === undefined) {
        throw new BadGatewayError(
          "Adapter TTS tidak mengembalikan audioBase64 + audioMimeType.",
        );
      }
      if (!inferred.audioMimeType.startsWith("audio/")) {
        throw new BadGatewayError(
          `Adapter TTS mengembalikan MIME non-audio: ${inferred.audioMimeType}.`,
        );
      }
      const upload = await serviceJson<ArtifactUploadResponse>(
        "Artifact",
        `${options.artifactUrl}/v1/artifacts`,
        options.internalToken,
        {
          method: "POST",
          body: {
            contentBase64: inferred.audioBase64,
            mimeType: inferred.audioMimeType,
            description: body.description,
            scope: body.scope,
            sensitivity: body.sensitivity,
            syncClass: body.syncClass,
          },
        },
      );
      const outputArtifact = ArtifactPointerSchema.parse(upload.pointer);
      const semanticResult = stripAudio(inferred);
      const historyEvent = deps.history.appendNext(body.sessionId, {
        id: makeId("event"),
        recordedAt: now,
        eventType: "artifact.synthesized",
        actor: "connect:multimodal",
        operationId: body.operationId,
        parentEventId: null,
        payload: {
          outputArtifactId: outputArtifact.id,
          routeUsed: inferred.routeUsed,
          adapter: inferred.adapter,
          provider: inferred.provider,
          model: inferred.model,
          language: inferred.language,
          voice: body.voice ?? null,
        },
      }).event;
      const response: MultimodalSynthesizeResponse = MultimodalSynthesizeResponseSchema.parse({
        operationId: body.operationId,
        sessionId: body.sessionId,
        state: "READY",
        result: semanticResult,
        outputArtifact,
        historyEventId: historyEvent.id,
      });
      deps.runs.complete({
        operationId: body.operationId,
        routeUsed: inferred.routeUsed,
        outputArtifactId: outputArtifact.id,
        result: response,
        now,
      });
      return response;
    } catch (error) {
      deps.runs.fail(
        body.operationId,
        error instanceof Error ? error.message : String(error),
        now,
      );
      throw error;
    }
  });

  app.get<{ Params: { operationId: string } }>(
    "/v1/multimodal/:operationId",
    async (request) => {
      const operationId = parseOrBadRequest(OperationIdSchema, request.params.operationId);
      try {
        return deps.runs.get(operationId);
      } catch (error) {
        if (error instanceof MultimodalRunNotFoundError) throw new NotFoundError(error.message);
        if (error instanceof MultimodalRunConflictError) throw new ConflictError(error.message);
        throw error;
      }
    },
  );
}
