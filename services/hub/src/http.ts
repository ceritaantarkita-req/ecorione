/** Hub HTTP routes: chat, policy, idempotent side effects, approvals, MCP, audit. */
import { createHash } from "node:crypto";
import {
  ActionRequestSchema,
  ApprovalDecisionSchema,
  assertId,
  ChatRequestSchema,
  ForgetFactRequestSchema,
  idempotencyPayload,
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
import { nowIso } from "./clock.js";
import { registerExchangeRoutes } from "./exchange-http.js";
import { registerHistoryRoutes } from "./history-http.js";
import { HistoryLedger } from "./history-ledger.js";
import type { HubDatabase } from "./db.js";
import { registerMcpRoutes } from "./mcp.js";
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

function toHttpError(err: unknown): unknown {
  if (err instanceof UpstreamError) return new BadGatewayError(err.message);
  if (err instanceof PolicyEngineBugError) return err;
  if (err instanceof ApprovalNotFoundError) return new NotFoundError(err.message);
  if (err instanceof ApprovalAlreadyDecidedError) return new ConflictError(err.message);
  if (err instanceof RespondNotAllowedError || err instanceof InvalidIdError)
    return new BadRequestError(err.message);
  return err;
}
function forwardOrUpstreamError(service: string, err: unknown): unknown {
  if (err instanceof RemoteServiceError && err.statusCode >= 400 && err.statusCode < 500) {
    const body = err.body;
    const errorField =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error: unknown }).error
        : undefined;
    if (typeof errorField === "object" && errorField !== null) {
      const e = errorField as { type?: unknown; message?: unknown; detail?: unknown };
      return new HttpError(
        err.statusCode,
        typeof e.type === "string" ? e.type : "BAD_REQUEST",
        typeof e.message === "string" ? e.message : err.message,
        typeof e.detail === "object" && e.detail !== null
          ? (e.detail as Record<string, unknown>)
          : undefined,
      );
    }
  }
  return toHttpError(new UpstreamError(service, err));
}
function makeIdempotencyKey(req: Pick<ActionRequest, "module" | "tool" | "args">): string {
  return createHash("sha256").update(idempotencyPayload(req)).digest("hex");
}
const DecideBodySchema = z.object({
  decision: ApprovalDecisionSchema,
  note: z.string().max(1024).optional(),
});
const ApprovalLookupQuerySchema = z.object({ idempotencyKey: z.string().min(1).max(512) });
const AuditQuerySchema = z.object({ operationId: z.string().min(1).optional() });
export interface BuildHubServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly contextUrl: string;
  readonly connectUrl: string;
  readonly rndUrl: string;
  readonly artifactUrl?: string | undefined;
  readonly internalToken?: string | undefined;
}

export function buildHubServer(
  db: HubDatabase,
  options: BuildHubServerOptions,
): FastifyInstance {
  const app = createServer({ name: "hub", token: options.token, logger: options.logger });
  const repo = new HubRepository(db);
  const history = new HistoryLedger(db);
  const deps: OrchestrateDeps = {
    repo,
    contextUrl: options.contextUrl,
    connectUrl: options.connectUrl,
    rndUrl: options.rndUrl,
    internalToken: options.internalToken,
  };

  app.post("/v1/chat", async (req) => {
    const body = parseOrBadRequest(ChatRequestSchema, req.body);
    try {
      return await chat(deps, body, nowIso());
    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.post("/v1/memory/forget", async (req) => {
    const body = parseOrBadRequest(ForgetFactRequestSchema, req.body);
    const now = nowIso();
    const operationId = makeId("operation");
    const actionBase = {
      module: "Hub" as const,
      tool: "memory.forget",
      args: { factId: body.factId, reason: body.reason },
    };
    const idempotencyKey = makeIdempotencyKey(actionBase);
    const actionRequest: ActionRequest = {
      operationId,
      ...actionBase,
      actionClass: "REVERSIBLE_WRITE",
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
      idempotencyKey,
    };
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId,
      module: "Hub",
      detail: { tool: actionRequest.tool, idempotencyKey },
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
    if (verdict.outcome !== "ALLOW")
      throw new BadGatewayError(
        `memory.forget tidak diizinkan policy engine: ${verdict.reason}`,
      );

    const prior = repo.getIdempotentResult<MemoryFact>(idempotencyKey);
    if (prior !== null) {
      repo.recordAuditEvent({
        type: "ACTION_SKIPPED_IDEMPOTENT",
        operationId,
        module: "Hub",
        detail: { idempotencyKey, priorOperationId: prior.operationId },
        now,
      });
      return prior.result;
    }
    let fact: MemoryFact;
    try {
      fact = await httpJson<MemoryFact>(
        `${options.contextUrl}/v1/facts/${body.factId}/forget`,
        { method: "POST", token: options.internalToken, body: { now } },
      );
    } catch (err) {
      throw forwardOrUpstreamError("Context", err);
    }
    repo.saveIdempotentResult(idempotencyKey, operationId, actionRequest.tool, fact, now);
    repo.recordAuditEvent({
      type: "MEMORY_INVALIDATED",
      operationId,
      module: "Hub",
      detail: { factId: body.factId, reason: body.reason, idempotencyKey },
      now,
    });
    return fact;
  });

  app.post("/v1/actions/evaluate", async (req) => {
    const body = parseOrBadRequest(ActionRequestSchema, req.body);
    const now = nowIso();
    repo.recordAuditEvent({
      type: "ACTION_REQUESTED",
      operationId: body.operationId,
      module: body.module,
      detail: { tool: body.tool, actionClass: body.actionClass },
      now,
    });
    const evaluation = evaluatePolicy(body);
    repo.recordAuditEvent({
      type: "POLICY_EVALUATED",
      operationId: body.operationId,
      module: body.module,
      detail: { outcome: evaluation.verdict.outcome },
      ruleId: evaluation.rule.id,
      now,
    });
    if (evaluation.verdict.outcome === "REQUIRE_APPROVAL") {
      repo.ensureApproval({
        operationId: body.operationId,
        actionRequest: body,
        prompt: evaluation.verdict.prompt,
        now,
      });
      repo.recordAuditEvent({
        type: "APPROVAL_REQUESTED",
        operationId: body.operationId,
        module: body.module,
        detail: { prompt: evaluation.verdict.prompt },
        ruleId: evaluation.rule.id,
        now,
      });
    }
    return evaluation.verdict;
  });

  app.get("/v1/approvals/by-idempotency-key", async (req) => {
    const query = parseOrBadRequest(ApprovalLookupQuerySchema, req.query);
    const approval = repo.getApprovalByIdempotencyKey(query.idempotencyKey);
    if (approval === null) throw new NotFoundError("Approval durable tidak ditemukan.");
    return approval;
  });

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

  registerHistoryRoutes(app, history);
  registerExchangeRoutes(app, history, {
    contextUrl: options.contextUrl,
    artifactUrl: options.artifactUrl ?? "http://127.0.0.1:17025",
    internalToken: options.internalToken,
  });

  registerMcpRoutes(app, repo, {
    contextUrl: options.contextUrl,
    artifactUrl: options.artifactUrl ?? "http://127.0.0.1:17025",
    internalToken: options.internalToken,
  });

  app.get("/v1/audit", async (req) => {
    const q = parseOrBadRequest(AuditQuerySchema, req.query);
    return { events: repo.listAuditEvents({ operationId: q.operationId }) };
  });
  return app;
}
