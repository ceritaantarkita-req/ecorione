/** HTTP boundary for Context. */
import {
  assertId,
  InvalidIdError,
  makeId,
  MemoryFactIdSchema,
  ProjectIdSchema,
  type ProjectId,
  ScopeSchema,
  SensitivitySchema,
  SyncClassSchema,
  TrustSchema,
  type MemoryFactId,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  createServer,
  ForbiddenError,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  runConsolidation,
  type ConsolidateDeps,
  type ConsolidateOptions,
  type ConsolidationFailureCode,
} from "./consolidate.js";
import { nowIso } from "./clock.js";
import { registerMaintenanceRoutes } from "./maintenance-http.js";
import { ContextMaintenanceEngine } from "./maintenance.js";
import {
  ContextError,
  CoreMemoryWriteForbiddenError,
  FactAlreadyInvalidatedError,
  FactNotFoundError,
  QuarantineRequiredError,
  QuarantineStateError,
  ScopeEscalationError,
  type ContextRepository,
} from "./repository.js";
import { ContextRetriever } from "./retrieval.js";
import type { VectorIndex } from "./vector.js";

function toHttpError(err: unknown): unknown {
  if (err instanceof FactNotFoundError) return new NotFoundError(err.message);
  if (
    err instanceof FactAlreadyInvalidatedError ||
    err instanceof QuarantineRequiredError ||
    err instanceof QuarantineStateError
  ) {
    return new ConflictError(err.message);
  }
  if (
    err instanceof ScopeEscalationError ||
    err instanceof ContextError ||
    err instanceof InvalidIdError
  ) {
    return new BadRequestError(err.message);
  }
  if (err instanceof CoreMemoryWriteForbiddenError) return new ForbiddenError(err.message);
  return err;
}

const BoolQuery = z
  .enum(["0", "1"])
  .optional()
  .transform((v) => v === "1");
const AppendEpisodeBodySchema = z.object({
  ts: z.string().datetime({ offset: false }),
  rawText: z.string(),
  projectId: ProjectIdSchema.nullable().optional(),
  provenance: z.object({
    sourceApp: z.string().min(1).max(64),
    sessionId: z.string().optional(),
    toolCallId: z.string().optional(),
    sourceUri: z.string().optional(),
  }),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  trust: TrustSchema,
});
const ListEpisodesQuerySchema = z.object({
  sessionId: z.string().optional(),
  projectId: ProjectIdSchema.nullable().optional(),
  scope: ScopeSchema.optional(),
  maxSensitivity: SensitivitySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  hostedEligible: BoolQuery,
});
const ProposeFactBodySchema = z.object({
  proposedText: z.string().min(1).max(4096),
  proposedAt: z.string().datetime({ offset: false }),
  projectId: ProjectIdSchema.nullable().optional(),
  provenance: z.object({
    sourceApp: z.string().min(1).max(64),
    sessionId: z.string().optional(),
    toolCallId: z.string().optional(),
    sourceUri: z.string().optional(),
  }),
  trust: TrustSchema,
  scope: ScopeSchema,
});
const PromoteFactBodySchema = z.object({
  now: z.string().datetime({ offset: false }),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  text: z.string().min(1),
  confidence: z.number().min(0).max(1),
  salience: z.number().min(0).max(1),
  sourceEpisodeIds: z.array(z.string()).min(1),
  tValid: z.string().datetime({ offset: false }),
  projectId: ProjectIdSchema.nullable().optional(),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
});
const ForgetFactBodySchema = z.object({
  now: z.string().datetime({ offset: false }),
  projectId: ProjectIdSchema.nullable().optional(),
});
const RetrieveBodySchema = z.object({
  query: z.string().min(1),
  scopes: z.array(ScopeSchema).min(1),
  projectId: ProjectIdSchema.nullable().optional(),
  k: z.number().int().min(1).max(20).default(8),
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  now: z.string().datetime({ offset: false }),
  hostedEligibleOnly: z.boolean().default(false),
  candidateSourceUris: z.array(z.string().url().max(2048)).max(32).optional(),
  candidateFactIds: z.array(MemoryFactIdSchema).max(32).optional(),
});
const CoreMemoryQuerySchema = z.object({
  projectId: ProjectIdSchema.nullable().optional(),
  scope: ScopeSchema.optional(),
  maxSensitivity: SensitivitySchema.optional(),
  hostedEligible: BoolQuery,
});
const CoreMemoryBlockBodySchema = z.object({
  description: z.string().min(1).max(512),
  value: z.string(),
  readOnly: z.boolean().optional(),
  now: z.string().datetime({ offset: false }),
  projectId: ProjectIdSchema.nullable().optional(),
  scope: ScopeSchema.optional(),
  sensitivity: SensitivitySchema.optional(),
  syncClass: SyncClassSchema.optional(),
});
const ListFactsQuerySchema = z.object({
  scopes: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.split(","))),
  projectId: ProjectIdSchema.nullable().optional(),
  maxSensitivity: SensitivitySchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
const ListArtifactsQuerySchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  hostedEligible: BoolQuery,
});
const ConsolidateBodySchema = z.object({
  now: z.string().datetime({ offset: false }),
  projectId: ProjectIdSchema.optional(),
  limit: z.number().int().min(1).max(200).default(20),
});

export interface BuildContextServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly extractLocal?: ((prompt: string) => Promise<string>) | undefined;
  /** Opt-in for production: queue local L1 extraction once an assistant episode is persisted. */
  readonly autoConsolidate?: boolean | undefined;
}

export function buildContextServer(
  repo: ContextRepository,
  vectors: VectorIndex | undefined,
  options: BuildContextServerOptions = {},
): FastifyInstance {
  const app = createServer({ name: "context", token: options.token, logger: options.logger });
  const retriever = new ContextRetriever(repo, vectors);
  const maintenance = new ContextMaintenanceEngine(repo, {
    extractLocal: options.extractLocal,
  });
  registerMaintenanceRoutes(app, maintenance);

  // Only the local extractor may derive durable L1 facts. Serialize scheduled and
  // operator-triggered jobs to avoid processing the same episodes concurrently.
  let consolidationTail: Promise<void> = Promise.resolve();
  const runSerialized = (opts: ConsolidateOptions) => {
    if (options.extractLocal === undefined) {
      throw new BadRequestError("Context local extractor belum dikonfigurasi.");
    }
    const deps: ConsolidateDeps = { repo, extractLocal: options.extractLocal };
    const task = consolidationTail.then(() => runConsolidation(deps, opts));
    consolidationTail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  };
  const pendingProjects = new Set<ProjectId>();
  const processingProjects = new Set<ProjectId>();
  const lastOutcome = new Map<ProjectId, "failed" | "complete">();
  const lastFailureCodes = new Map<ProjectId, readonly ConsolidationFailureCode[]>();
  let autoRunning = false;
  function scheduleAutoConsolidation(projectId: ProjectId): void {
    if (options.autoConsolidate !== true || options.extractLocal === undefined) return;
    pendingProjects.add(projectId);
    if (autoRunning) return;
    autoRunning = true;
    void Promise.resolve().then(async () => {
      try {
        while (pendingProjects.size > 0) {
          const next = pendingProjects.values().next().value;
          if (next === undefined) break;
          pendingProjects.delete(next);
          processingProjects.add(next);
          try {
            const result = await runSerialized({ now: nowIso(), projectId: next, limit: 20 });
            const failureCodes = [...new Set(result.errors)];
            lastOutcome.set(next, failureCodes.length > 0 ? "failed" : "complete");
            lastFailureCodes.set(next, failureCodes);
            if (failureCodes.length > 0) {
              app.log.warn(
                { projectId: next, errorCount: result.errors.length, failureCodes },
                "Auto memory consolidation incomplete",
              );
            }
          } catch {
            lastOutcome.set(next, "failed");
            lastFailureCodes.set(next, ["UNEXPECTED_FAILURE"]);
            // Chat succeeds after the episode is durably written; local-model outages
            // must not turn a completed chat into a retryable 502. Unprocessed
            // episodes stay in the database for the next attempt/operator run.
            // Upstream errors may contain snippets of model output or episode text.
            // Log only the error class, never the exception payload.
            app.log.warn(
              { projectId: next, failureCodes: ["UNEXPECTED_FAILURE"] },
              "Auto memory consolidation deferred",
            );
          } finally {
            processingProjects.delete(next);
          }
        }
      } finally {
        autoRunning = false;
      }
    });
  }

  // Owner authorization belongs to the Hub/Next boundary. This internal-only
  // endpoint exposes counts and ephemeral worker state, never fact or episode text.
  app.get("/v1/memory/status", async (req) => {
    const q = parseOrBadRequest(z.object({ projectId: ProjectIdSchema }), req.query);
    return {
      projectId: q.projectId,
      ...repo.projectMemoryCounts(q.projectId),
      processing: processingProjects.has(q.projectId),
      queued: pendingProjects.has(q.projectId),
      lastAttempt: lastOutcome.get(q.projectId) ?? "unknown",
      lastFailureCodes: lastFailureCodes.get(q.projectId) ?? [],
    };
  });

  app.post("/v1/episodes", async (req, reply) => {
    const body = parseOrBadRequest(AppendEpisodeBodySchema, req.body);
    try {
      const episode = repo.appendEpisode({ ...body, id: makeId("episode") });
      if (
        episode.projectId !== null &&
        (episode.trust === "LOCAL_AGENT" || episode.trust === "HOSTED_AGENT")
      ) {
        scheduleAutoConsolidation(episode.projectId);
      }
      return await reply.code(201).send(episode);
    } catch (err) {
      throw toHttpError(err);
    }
  });
  app.get<{ Params: { id: string } }>("/v1/episodes/:id", async (req) => {
    try {
      const episode = repo.getEpisode(assertId("episode", req.params.id));
      if (episode === null)
        throw new NotFoundError(`Episode tidak ditemukan: ${req.params.id}`);
      return episode;
    } catch (err) {
      throw toHttpError(err);
    }
  });
  app.get("/v1/episodes", async (req) => {
    const q = parseOrBadRequest(ListEpisodesQuerySchema, req.query);
    return {
      episodes: repo.listEpisodes({
        scopes: q.scope === undefined ? undefined : [q.scope],
        maxSensitivity: q.maxSensitivity,
        sessionId: q.sessionId,
        projectId: q.projectId ?? null,
        hostedEligibleOnly: q.hostedEligible,
        order: "desc",
        limit: q.limit,
      }),
    };
  });

  app.post("/v1/facts/propose", async (req, reply) => {
    const body = parseOrBadRequest(ProposeFactBodySchema, req.body);
    const id = makeId("memoryFact");
    try {
      repo.proposeFact({ ...body, id });
      return await reply.code(201).send({ id });
    } catch (err) {
      throw toHttpError(err);
    }
  });
  app.get<{ Params: { id: string } }>("/v1/facts/:id", async (req) => {
    try {
      const fact = repo.getFact(assertId("memoryFact", req.params.id));
      if (fact === null) throw new NotFoundError(`Fakta tidak ditemukan: ${req.params.id}`);
      return fact;
    } catch (err) {
      throw toHttpError(err);
    }
  });
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/v1/facts/:id/promote",
    async (req, reply) => {
      const body = parseOrBadRequest(PromoteFactBodySchema, req.body);
      const id = req.params.id as MemoryFactId;
      try {
        const fact = repo.promoteFromQuarantine(
          id,
          {
            id,
            subject: body.subject,
            predicate: body.predicate,
            object: body.object,
            text: body.text,
            confidence: body.confidence,
            salience: body.salience,
            sourceEpisodeIds: body.sourceEpisodeIds,
            tValid: body.tValid,
            projectId: body.projectId ?? null,
            createdAt: body.now,
            scope: body.scope,
            sensitivity: body.sensitivity,
            syncClass: body.syncClass,
            trust: "LOCAL_AGENT",
            provenance: { sourceApp: "context:promote" },
          },
          body.now,
        );
        return await reply.send(fact);
      } catch (err) {
        throw toHttpError(err);
      }
    },
  );
  app.get("/v1/facts", async (req) => {
    const q = parseOrBadRequest(ListFactsQuerySchema, req.query);
    return { facts: repo.listFacts(q) };
  });
  app.post<{ Params: { id: string } }>("/v1/facts/:id/forget", async (req) => {
    const body = parseOrBadRequest(ForgetFactBodySchema, req.body);
    try {
      return repo.forgetFact(req.params.id as MemoryFactId, body.now, body.projectId ?? null);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.get("/v1/core-memory", async (req) => {
    const q = parseOrBadRequest(CoreMemoryQuerySchema, req.query);
    return repo.getCoreMemory({
      projectId: q.projectId ?? null,
      scopes: q.scope === undefined ? undefined : [q.scope],
      maxSensitivity: q.maxSensitivity,
      hostedEligibleOnly: q.hostedEligible,
    });
  });
  app.put<{ Params: { label: string } }>("/v1/core-memory/:label", async (req) => {
    const body = parseOrBadRequest(CoreMemoryBlockBodySchema, req.body);
    try {
      return repo.setCoreMemoryBlock(
        {
          label: req.params.label,
          description: body.description,
          value: body.value,
          readOnly: body.readOnly ?? false,
          updatedAt: body.now,
          projectId: body.projectId ?? null,
          scope: body.scope ?? "personal",
          sensitivity: body.sensitivity ?? "INTERNAL",
          syncClass: body.syncClass ?? "LOCAL_ONLY",
        },
        { trust: "USER" },
      );
    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.post("/v1/retrieve", async (req) =>
    retriever.retrieve(parseOrBadRequest(RetrieveBodySchema, req.body)),
  );
  app.get("/v1/artifacts", async (req) => {
    const q = parseOrBadRequest(ListArtifactsQuerySchema, req.query);
    return {
      pointers: repo.listArtifactPointers([q.scope], q.maxSensitivity, q.hostedEligible),
    };
  });
  app.post("/v1/consolidate/run", async (req) => {
    const body = parseOrBadRequest(ConsolidateBodySchema, req.body);
    if (options.extractLocal === undefined) {
      throw new BadRequestError(
        "Service ini dijalankan tanpa client Connect (extractLocal) — konsolidasi tidak bisa jalan.",
      );
    }
    return runSerialized(body);
  });
  return app;
}
