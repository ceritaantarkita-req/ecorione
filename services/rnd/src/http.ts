/**
 * Route HTTP RnD — `docs/api-fase1.md` §RnD.
 */

import { createServer, NotFoundError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { TraceStore } from "./store.js";
import type { RndDatabase } from "./db.js";

const SpanAttributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

const RecordTraceBodySchema = z.object({
  name: z.string().min(1),
  attributes: z.record(z.string(), SpanAttributeValueSchema),
  operationId: z.string().min(1).nullable().optional(),
  traceId: z.string().min(1).nullable().optional(),
  recordedAt: z.string().datetime({ offset: false }),
});

const ListTracesQuerySchema = z.object({
  operationId: z.string().min(1).optional(),
  traceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const SummaryQuerySchema = z.object({
  operationId: z.string().min(1),
});

export interface BuildRndServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean;
}

export function buildRndServer(
  db: RndDatabase,
  options: BuildRndServerOptions = {},
): FastifyInstance {
  const store = new TraceStore(db);
  const app = createServer({ name: "rnd", token: options.token, logger: options.logger });

  app.post("/v1/traces", async (req, reply) => {
    const body = parseOrBadRequest(RecordTraceBodySchema, req.body);
    const record = store.record(body);
    return reply.code(201).send({ id: record.id });
  });

  app.get("/v1/traces", async (req) => {
    const query = parseOrBadRequest(ListTracesQuerySchema, req.query);
    return { traces: store.list(query) };
  });

  app.get("/v1/traces/summary", async (req) => {
    const query = parseOrBadRequest(SummaryQuerySchema, req.query);
    return store.summary(query.operationId);
  });

  app.get<{ Params: { id: string } }>("/v1/traces/:id", async (req) => {
    const record = store.get(req.params.id);
    if (record === null) throw new NotFoundError(`Trace tidak ditemukan: ${req.params.id}`);
    return record;
  });

  return app;
}
