/** HTTP boundary for Context. */
import {
  assertId,
  InvalidIdError,
  makeId,
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
import { runConsolidation, type ConsolidateDeps } from "./consolidate.js";
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
  scope: ScopeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  hostedEligible: BoolQuery,
});
const ProposeFactBodySchema = z.object({
  proposedText: z.string().min(1).max(4096),
  proposedAt: z.string().datetime({ offset: false }),
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
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
});
const ForgetFactBodySchema = z.object({ now: z.string().datetime({ offset: false }) });
const RetrieveBodySchema = z.object({
  query: z.string().min(1),
  scopes: z.array(ScopeSchema).min(1),
  k: z.number().int().min(1).max(20).default(8),
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  now: z.string().datetime({ offset: false }),
  hostedEligibleOnly: z.boolean().default(false),
});
const CoreMemoryQuerySchema = z.object({
  scope: ScopeSchema.optional(),
  maxSensitivity: SensitivitySchema.optional(),
  hostedEligible: BoolQuery,
});
const CoreMemoryBlockBodySchema = z.object({
  description: z.string().min(1).max(512),
  value: z.string(),
  readOnly: z.boolean().optional(),
  now: z.string().datetime({ offset: false }),
  scope: ScopeSchema.optional(),
  sensitivity: SensitivitySchema.optional(),
  syncClass: SyncClassSchema.optional(),
});
const ListFactsQuerySchema = z.object({
  scopes: z
    .string()
    .optional()
    .transform((s) => (s === undefined ? undefined : s.split(","))),
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
  limit: z.number().int().min(1).max(200).default(20),
});

export interface BuildContextServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly extractLocal?: ((prompt: string) => Promise<string>) | undefined;
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

  app.post("/v1/episodes", async (req, reply) => {
    const body = parseOrBadRequest(AppendEpisodeBodySchema, req.body);
    try {
      return await reply.code(201).send(repo.appendEpisode({ ...body, id: makeId("episode") }));
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
        sessionId: q.sessionId,
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
      return repo.forgetFact(req.params.id as MemoryFactId, body.now);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.get("/v1/core-memory", async (req) => {
    const q = parseOrBadRequest(CoreMemoryQuerySchema, req.query);
    return repo.getCoreMemory({
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
    const deps: ConsolidateDeps = { repo, extractLocal: options.extractLocal };
    return runConsolidation(deps, body);
  });
  return app;
}
