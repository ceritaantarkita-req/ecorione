/**
 * Route HTTP Hub — `docs/api-fase1.md` §Hub.
 */

import {
  ActionRequestSchema,
  ApprovalDecisionSchema,
  assertId,
  ChatRequestSchema,
  ForgetFactRequestSchema,
  InvalidIdError,
  makeId,
  type ActionRequest,
  type MemoryFact,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  createServer,
  HttpError,
  httpJson,
  NotFoundError,
  parseOrBadRequest,
  RemoteServiceError,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { HubDatabase } from "./db.js";
import { nowIso } from "./clock.js";
import {
  chat,
  PolicyEngineBugError,
  UpstreamError,
  type OrchestrateDeps,
} from "./orchestrate.js";
import { evaluatePolicy } from "./policy-engine.js";
import {
  ApprovalAlreadyDecidedError,
  ApprovalNotFoundError,
  HubRepository,
  RespondNotAllowedError,
} from "./repository.js";

/** Memetakan error domain ke status HTTP yang tepat — bukan 500 generik untuk semuanya. */
function toHttpError(err: unknown): unknown {
  if (err instanceof UpstreamError) return new BadGatewayError(err.message);
  if (err instanceof PolicyEngineBugError) return err; // 500 eksplisit, lihat komentar kelasnya.
  if (err instanceof ApprovalNotFoundError) return new NotFoundError(err.message);
  if (err instanceof ApprovalAlreadyDecidedError) return new ConflictError(err.message);
  if (err instanceof RespondNotAllowedError) return new BadRequestError(err.message);
  if (err instanceof InvalidIdError) return new BadRequestError(err.message);
  return err;
}

/**
 * Memetakan kegagalan `httpJson` ke Context saat memanggilnya atas nama input pengguna
 * langsung (mis. `factId` dari `memory.forget`) — beda dari panggilan Context di jalur
 * chat (`orchestrate.ts`), yang seluruh bentuk requestnya dirakit Hub sendiri sehingga
 * 4xx dari sana memang berarti ada yang salah di sisi Hub.
 *
 * Kalau Context menjawab jelas dengan 4xx (mis. 404 fakta tidak ada, 409 sudah
 * di-invalidate — `docs/api-fase1.md` §Context), itu **bukan** "Context tidak bisa
 * dihubungi": itu jawaban domain yang sah untuk input yang pengguna kirim sendiri, dan
 * harus diteruskan apa adanya, bukan disamarkan jadi 502 UPSTREAM_UNAVAILABLE — pengguna
 * yang mengklik "lupakan" pada fakta yang sudah dilupakan di tab lain berhak melihat
 * "sudah dilupakan", bukan "layanan tidak bisa dihubungi". Kegagalan jaringan sungguhan
 * (Context mati, timeout, 5xx) tetap 502, lewat `UpstreamError` seperti biasa.
 */
function forwardOrUpstreamError(service: string, err: unknown): unknown {
  if (err instanceof RemoteServiceError && err.statusCode >= 400 && err.statusCode < 500) {
    const body = err.body;
    const errorField =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error: unknown }).error
        : undefined;
    if (typeof errorField === "object" && errorField !== null) {
      const e = errorField as { type?: unknown; message?: unknown; detail?: unknown };
      const type = typeof e.type === "string" ? e.type : "BAD_REQUEST";
      const message = typeof e.message === "string" ? e.message : err.message;
      const detail =
        typeof e.detail === "object" && e.detail !== null
          ? (e.detail as Record<string, unknown>)
          : undefined;
      return new HttpError(err.statusCode, type, message, detail);
    }
  }
  return toHttpError(new UpstreamError(service, err));
}

const DecideBodySchema = z.object({
  decision: ApprovalDecisionSchema,
  note: z.string().max(1024).optional(),
});

const AuditQuerySchema = z.object({
  operationId: z.string().min(1).optional(),
});

export interface BuildHubServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly contextUrl: string;
  readonly connectUrl: string;
  readonly rndUrl: string;
  readonly internalToken?: string | undefined;
}

export function buildHubServer(
  db: HubDatabase,
  options: BuildHubServerOptions,
): FastifyInstance {
  const app = createServer({ name: "hub", token: options.token, logger: options.logger });
  const repo = new HubRepository(db);
  const deps: OrchestrateDeps = {
    repo,
    contextUrl: options.contextUrl,
    connectUrl: options.connectUrl,
    rndUrl: options.rndUrl,
    internalToken: options.internalToken,
  };

  // --- Chat: endpoint inti Fase 1 -------------------------------------------

  app.post("/v1/chat", async (req) => {
    const body = parseOrBadRequest(ChatRequestSchema, req.body);
    const now = nowIso();
    try {
      return await chat(deps, body, now);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  // --- Forget satu-klik ------------------------------------------------------

  app.post("/v1/memory/forget", async (req) => {
    const body = parseOrBadRequest(ForgetFactRequestSchema, req.body);
    const now = nowIso();
    const operationId = makeId("operation");

    const actionRequest: ActionRequest = {
      operationId,
      module: "Hub",
      tool: "memory.forget",
      actionClass: "REVERSIBLE_WRITE",
      args: { factId: body.factId, reason: body.reason },
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
      idempotencyKey: null,
    };
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId,
      module: "Hub",
      detail: { tool: actionRequest.tool },
      now,
    });
    const { verdict, rule } = evaluatePolicy(actionRequest);
    repo.recordAuditEvent({
      type: "POLICY_EVALUATED",
      operationId,
      module: "Hub",
      detail: { outcome: verdict.outcome },
      ruleId: rule.id,
      now,
    });

    // REVERSIBLE_WRITE tidak masuk ALWAYS_GATED — di Fase 1 selalu ALLOW (aturan 4), tapi
    // gerbangnya tetap dicek eksplisit, bukan diasumsikan (`docs/api-fase1.md` §Hub).
    if (verdict.outcome !== "ALLOW") {
      throw new BadGatewayError(
        `memory.forget tidak diizinkan policy engine: ${verdict.reason}`,
      );
    }

    let fact: MemoryFact;
    try {
      fact = await httpJson<MemoryFact>(
        `${options.contextUrl}/v1/facts/${body.factId}/forget`,
        {
          method: "POST",
          token: options.internalToken,
          body: { now },
        },
      );
    } catch (err) {
      throw forwardOrUpstreamError("Context", err);
    }

    repo.recordAuditEvent({
      type: "MEMORY_INVALIDATED",
      operationId,
      module: "Hub",
      detail: { factId: body.factId, reason: body.reason },
      now,
    });

    return fact;
  });

  // --- Primitif policy umum ---------------------------------------------------

  app.post("/v1/actions/evaluate", async (req) => {
    const body = parseOrBadRequest(ActionRequestSchema, req.body);
    return evaluatePolicy(body).verdict;
  });

  // --- Approval gate -----------------------------------------------------------

  app.post<{ Params: { operationId: string } }>(
    "/v1/approvals/:operationId/decide",
    async (req) => {
      const body = parseOrBadRequest(DecideBodySchema, req.body);
      const now = nowIso();
      try {
        const operationId = assertId("operation", req.params.operationId);
        const approval = repo.decideApproval(
          operationId,
          body.decision,
          "user",
          body.note ?? null,
          now,
        );
        repo.recordAuditEvent({
          type: "APPROVAL_DECIDED",
          operationId,
          module: "Hub",
          detail: { decision: body.decision, note: body.note ?? null },
          now,
        });
        return approval;
      } catch (err) {
        throw toHttpError(err);
      }
    },
  );

  // --- Audit ---------------------------------------------------------------

  app.get("/v1/audit", async (req) => {
    const query = parseOrBadRequest(AuditQuerySchema, req.query);
    return { events: repo.listAuditEvents({ operationId: query.operationId }) };
  });

  return app;
}
