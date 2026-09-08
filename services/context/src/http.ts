/**
 * Route HTTP Context — `docs/api-fase1.md` §Context. Membungkus `ContextRepository` +
 * `ContextRetriever` yang sudah ada (Fase 0); tidak menulis ulang logikanya.
 */

import {
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

/** Memetakan `ContextError` ke status HTTP yang tepat — bukan 500 generik untuk semuanya. */
function toHttpError(err: unknown): unknown {
  if (err instanceof FactNotFoundError) return new NotFoundError(err.message);
  if (err instanceof FactAlreadyInvalidatedError) return new ConflictError(err.message);
  if (err instanceof QuarantineRequiredError) return new ConflictError(err.message);
  if (err instanceof QuarantineStateError) return new ConflictError(err.message);
  if (err instanceof ScopeEscalationError) return new BadRequestError(err.message);
  if (err instanceof CoreMemoryWriteForbiddenError) return new ForbiddenError(err.message);
  if (err instanceof ContextError) return new BadRequestError(err.message);
  return err;
}

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

const ForgetFactBodySchema = z.object({
  now: z.string().datetime({ offset: false }),
});

const RetrieveBodySchema = z.object({
  query: z.string().min(1),
  scopes: z.array(ScopeSchema).min(1),
  k: z.number().int().min(1).max(20).optional(),
  maxSensitivity: SensitivitySchema.optional(),
  now: z.string().datetime({ offset: false }),
});

const CoreMemoryBlockBodySchema = z.object({
  description: z.string().min(1).max(512),
  value: z.string(),
  readOnly: z.boolean().optional(),
  now: z.string().datetime({ offset: false }),
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
});

const ConsolidateBodySchema = z.object({
  now: z.string().datetime({ offset: false }),
  limit: z.number().int().min(1).max(200).optional(),
});

export interface BuildContextServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  /** Diperlukan hanya kalau `POST /v1/consolidate/run` akan dipanggil. */
  readonly extractLocal?: ((prompt: string) => Promise<string>) | undefined;
}

export function buildContextServer(
  repo: ContextRepository,
  vectors: VectorIndex | undefined,
  options: BuildContextServerOptions = {},
): FastifyInstance {
  const app = createServer({ name: "context", token: options.token, logger: options.logger });
  const retriever = new ContextRetriever(repo, vectors);

  // --- L0: episode ---------------------------------------------------------

  app.post("/v1/episodes", async (req, reply) => {
    const body = parseOrBadRequest(AppendEpisodeBodySchema, req.body);
    try {
      const episode = repo.appendEpisode({ ...body, id: makeId("episode") });
      return await reply.code(201).send(episode);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.get("/v1/episodes", async (req) => {
    const query = parseOrBadRequest(ListEpisodesQuerySchema, req.query);
    const episodes = repo.listEpisodes({
      scopes: query.scope === undefined ? undefined : [query.scope],
      limit: query.limit,
    });
    const filtered =
      query.sessionId === undefined
        ? episodes
        : episodes.filter((e) => e.provenance.sessionId === query.sessionId);
    return { episodes: filtered.slice().reverse() };
  });

  // --- L1: fakta -------------------------------------------------------------

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
    const query = parseOrBadRequest(ListFactsQuerySchema, req.query);
    return { facts: repo.listFacts(query) };
  });

  app.post<{ Params: { id: string } }>("/v1/facts/:id/forget", async (req) => {
    const body = parseOrBadRequest(ForgetFactBodySchema, req.body);
    try {
      return repo.forgetFact(req.params.id as MemoryFactId, body.now);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  // --- L2: memori inti ---------------------------------------------------

  app.get("/v1/core-memory", async () => repo.getCoreMemory());

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
        },
        { trust: "USER" },
      );
    } catch (err) {
      throw toHttpError(err);
    }
  });

  // --- Retrieval -----------------------------------------------------------

  app.post("/v1/retrieve", async (req) => {
    const body = parseOrBadRequest(RetrieveBodySchema, req.body);
    return retriever.retrieve(body);
  });

  // --- L3: artifact ----------------------------------------------------------

  app.get("/v1/artifacts", async (req) => {
    const query = parseOrBadRequest(ListArtifactsQuerySchema, req.query);
    return { pointers: repo.listArtifactPointers([query.scope], query.maxSensitivity) };
  });

  // --- Konsolidasi -----------------------------------------------------------

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
