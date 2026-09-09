import {
  HistoryAppendRequestSchema,
  HistoryCreateSessionRequestSchema,
  ScopeSchema,
  SensitivitySchema,
  SessionIdSchema,
  maySendToHosted,
  sensitivityRank,
  type HistoryGrant,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  HttpError,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import {
  HistoryAccessDeniedError,
  HistoryEventConflictError,
  HistoryIntegrityError,
  type HistoryLedger,
  HistoryPayloadError,
  HistorySequenceConflictError,
  HistorySessionConflictError,
  HistorySessionNotFoundError,
} from "./history-ledger.js";

const BoolQuery = z
  .enum(["0", "1"])
  .optional()
  .transform((value) => value === "1");
const HistoryGrantQuerySchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  hostedEligible: BoolQuery,
});
const HistoryRangeQuerySchema = HistoryGrantQuerySchema.extend({
  afterSeq: z.coerce.number().int().min(-1).default(-1),
  throughSeq: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

function mapHistoryError(error: unknown): unknown {
  if (
    error instanceof HistorySessionNotFoundError ||
    error instanceof HistoryAccessDeniedError
  ) {
    return new NotFoundError("History session/range tidak tersedia.");
  }
  if (
    error instanceof HistorySessionConflictError ||
    error instanceof HistorySequenceConflictError ||
    error instanceof HistoryEventConflictError
  ) {
    return new ConflictError(error.message);
  }
  if (error instanceof HistoryPayloadError) return new BadRequestError(error.message);
  if (error instanceof HistoryIntegrityError) {
    return new HttpError(500, "HISTORY_INTEGRITY_ERROR", error.message);
  }
  return error;
}

export function registerHistoryRoutes(app: FastifyInstance, ledger: HistoryLedger): void {
  app.post("/v1/history/sessions", async (req, reply) => {
    const body = parseOrBadRequest(HistoryCreateSessionRequestSchema, req.body);
    try {
      const existing = ledger.getSession(body.sessionId);
      const session = ledger.createSession({
        id: body.sessionId,
        createdAt: body.createdAt ?? nowIso(),
        scope: body.scope,
        sensitivity: body.sensitivity,
        syncClass: body.syncClass,
      });
      return reply.code(existing === null ? 201 : 200).send(session);
    } catch (error) {
      throw mapHistoryError(error);
    }
  });

  app.get("/v1/history/sessions", async (req) => {
    const query = parseOrBadRequest(HistoryGrantQuerySchema, req.query);
    const sessions = ledger.listSessions(query.scope).filter((session) => {
      if (sensitivityRank(session.sensitivity) > sensitivityRank(query.maxSensitivity))
        return false;
      if (query.hostedEligible && !maySendToHosted(session.syncClass)) return false;
      return true;
    });
    return { sessions };
  });

  app.get<{ Params: { id: string } }>("/v1/history/sessions/:id", async (req) => {
    const sessionId = parseOrBadRequest(SessionIdSchema, req.params.id);
    const query = parseOrBadRequest(HistoryGrantQuerySchema, req.query);
    try {
      const session = ledger.getSession(sessionId);
      if (session === null) throw new HistorySessionNotFoundError(sessionId);
      const grant: HistoryGrant = {
        scope: query.scope,
        maxSensitivity: query.maxSensitivity,
        hostedEligible: query.hostedEligible,
      };
      ledger.readRange({ sessionId, afterSeq: -1, throughSeq: -1, limit: 1, grant });
      return session;
    } catch (error) {
      throw mapHistoryError(error);
    }
  });

  app.post<{ Params: { id: string } }>(
    "/v1/history/sessions/:id/events",
    async (req, reply) => {
      const sessionId = parseOrBadRequest(SessionIdSchema, req.params.id);
      const body = parseOrBadRequest(HistoryAppendRequestSchema, req.body);
      try {
        const result = ledger.append(sessionId, body.expectedSeq, body.event);
        return reply.code(result.deduplicated ? 200 : 201).send(result);
      } catch (error) {
        throw mapHistoryError(error);
      }
    },
  );

  app.get<{ Params: { id: string } }>("/v1/history/sessions/:id/events", async (req) => {
    const sessionId = parseOrBadRequest(SessionIdSchema, req.params.id);
    const query = parseOrBadRequest(HistoryRangeQuerySchema, req.query);
    try {
      return ledger.readRange({
        sessionId,
        afterSeq: query.afterSeq,
        throughSeq: query.throughSeq,
        limit: query.limit,
        grant: {
          scope: query.scope,
          maxSensitivity: query.maxSensitivity,
          hostedEligible: query.hostedEligible,
        },
      });
    } catch (error) {
      throw mapHistoryError(error);
    }
  });
}
