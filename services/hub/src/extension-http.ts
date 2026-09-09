import {
  ExtensionHealthReportRequestSchema,
  ExtensionIdSchema,
  ExtensionInstallRequestSchema,
  ExtensionManifestSchema,
  ExtensionRemoveRequestSchema,
  ExtensionRollbackRequestSchema,
  ExtensionUpdateRequestSchema,
  WorkspaceIdSchema,
  type ActionRequest,
  type ExtensionId,
  type OperationId,
  type Timestamp,
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
import { evaluatePolicy } from "./policy-engine.js";
import type { HubRepository } from "./repository.js";
import {
  ExtensionAlreadyInstalledError,
  ExtensionIdempotencyConflictError,
  ExtensionIdMismatchError,
  ExtensionNoChangeError,
  ExtensionNotFoundError,
  ExtensionRevisionNotFoundError,
  ExtensionSecurityBlockedError,
  type ExtensionMutationResult,
  type ExtensionRegistry,
} from "./extension-registry.js";

const WorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema });
const ExtensionParamsSchema = z.object({ id: ExtensionIdSchema });
const ValidateSchema = z.object({ manifest: ExtensionManifestSchema }).strict();

type ExtensionMutationBody =
  | z.infer<typeof ExtensionInstallRequestSchema>
  | z.infer<typeof ExtensionUpdateRequestSchema>
  | z.infer<typeof ExtensionRollbackRequestSchema>
  | z.infer<typeof ExtensionRemoveRequestSchema>
  | z.infer<typeof ExtensionHealthReportRequestSchema>;

export class ExtensionPolicyDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionPolicyDeniedError";
  }
}

export class ExtensionApprovalRequiredError extends Error {
  constructor(
    readonly operationId: OperationId,
    readonly prompt: string,
  ) {
    super(`Extension mutation membutuhkan approval: ${operationId}. ${prompt}`);
    this.name = "ExtensionApprovalRequiredError";
  }
}

function toHttpError(error: unknown): unknown {
  if (
    error instanceof ExtensionNotFoundError ||
    error instanceof ExtensionRevisionNotFoundError
  ) {
    return new NotFoundError(error.message);
  }
  if (error instanceof ExtensionIdMismatchError) return new BadRequestError(error.message);
  if (
    error instanceof ExtensionAlreadyInstalledError ||
    error instanceof ExtensionNoChangeError ||
    error instanceof ExtensionIdempotencyConflictError
  ) {
    return new ConflictError(error.message);
  }
  if (error instanceof ExtensionSecurityBlockedError) {
    return new HttpError(403, "EXTENSION_SECURITY_BLOCKED", error.message, {
      manifestSha256: error.report.manifestSha256,
      findings: [...error.report.findings],
    });
  }
  if (error instanceof ExtensionPolicyDeniedError) {
    return new HttpError(403, "EXTENSION_POLICY_DENIED", error.message);
  }
  if (error instanceof ExtensionApprovalRequiredError) {
    return new HttpError(409, "EXTENSION_APPROVAL_REQUIRED", error.message, {
      operationId: error.operationId,
      prompt: error.prompt,
    });
  }
  return error;
}

function mutationActionRequest(
  action: "install" | "update" | "rollback" | "remove" | "health",
  extensionId: ExtensionId,
  body: ExtensionMutationBody,
  args: Record<string, unknown>,
): ActionRequest {
  return {
    operationId: body.operationId,
    module: "Hub",
    tool: `extension.${action}`,
    actionClass: "REVERSIBLE_WRITE",
    args: { workspaceId: body.workspaceId, extensionId, ...args },
    scope: body.scope,
    sensitivity: body.sensitivity,
    autonomy: body.autonomy,
    idempotencyKey: body.idempotencyKey,
  };
}

function authorize(repo: HubRepository, request: ActionRequest, now: Timestamp): void {
  const existing = repo.getApprovalByIdempotencyKey(request.idempotencyKey!);
  if (existing !== null) {
    if (existing.status === "APPROVE") return;
    if (existing.status === "PENDING") {
      throw new ExtensionApprovalRequiredError(existing.operationId, existing.prompt);
    }
    throw new ExtensionPolicyDeniedError(
      `Approval extension sebelumnya berstatus ${existing.status}; mutation ditolak.`,
    );
  }

  repo.recordAuditEvent({
    type: "ACTION_REQUESTED",
    operationId: request.operationId,
    module: "Hub",
    detail: { tool: request.tool, actionClass: request.actionClass, args: request.args },
    now,
  });
  const evaluation = evaluatePolicy(request);
  repo.recordAuditEvent({
    type: "POLICY_EVALUATED",
    operationId: request.operationId,
    module: "Hub",
    detail: { outcome: evaluation.verdict.outcome },
    ruleId: evaluation.rule.id,
    now,
  });
  if (evaluation.verdict.outcome === "ALLOW") return;
  if (evaluation.verdict.outcome === "REQUIRE_APPROVAL") {
    const approval = repo.ensureApproval({
      operationId: request.operationId,
      actionRequest: request,
      prompt: evaluation.verdict.prompt,
      now,
    });
    repo.recordAuditEvent({
      type: "APPROVAL_REQUESTED",
      operationId: request.operationId,
      module: "Hub",
      detail: { prompt: approval.prompt },
      ruleId: evaluation.rule.id,
      now,
    });
    throw new ExtensionApprovalRequiredError(request.operationId, approval.prompt);
  }
  throw new ExtensionPolicyDeniedError(evaluation.verdict.reason);
}

function auditResult(
  repo: HubRepository,
  request: ActionRequest,
  action: string,
  result: ExtensionMutationResult,
  now: Timestamp,
): void {
  repo.recordAuditEvent({
    type: result.deduplicated ? "ACTION_SKIPPED_IDEMPOTENT" : "ACTION_EXECUTED",
    operationId: request.operationId,
    module: "Hub",
    detail: {
      tool: request.tool,
      action,
      extensionId: result.extension.extensionId,
      workspaceId: result.extension.workspaceId,
      revisionId: result.revision?.revisionId ?? null,
      deduplicated: result.deduplicated,
    },
    now,
  });
}

function enforceSecurityAdmission(report: ReturnType<ExtensionRegistry["validate"]>): void {
  if (!report.allowed) {
    throw toHttpError(new ExtensionSecurityBlockedError(report));
  }
}

function auditFailure(
  repo: HubRepository,
  request: ActionRequest,
  error: unknown,
  now: Timestamp,
): void {
  repo.recordAuditEvent({
    type: "ACTION_FAILED",
    operationId: request.operationId,
    module: "Hub",
    detail: {
      tool: request.tool,
      error: error instanceof Error ? error.message : String(error),
    },
    now,
  });
}

export function registerExtensionRoutes(
  app: FastifyInstance,
  registry: ExtensionRegistry,
  repo: HubRepository,
): void {
  app.post("/v1/extensions/validate", async (req) => {
    const body = parseOrBadRequest(ValidateSchema, req.body);
    return registry.validate(body.manifest);
  });

  app.get("/v1/extensions", async (req) => {
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    return { extensions: registry.list(query.workspaceId) };
  });

  app.get<{ Params: { id: string } }>("/v1/extensions/:id", async (req) => {
    const params = parseOrBadRequest(ExtensionParamsSchema, req.params);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const extension = registry.get(query.workspaceId, params.id);
    if (extension === null) throw new NotFoundError(`Extension tidak ditemukan: ${params.id}.`);
    return extension;
  });

  app.get<{ Params: { id: string } }>("/v1/extensions/:id/revisions", async (req) => {
    const params = parseOrBadRequest(ExtensionParamsSchema, req.params);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const extension = registry.get(query.workspaceId, params.id);
    if (extension === null) throw new NotFoundError(`Extension tidak ditemukan: ${params.id}.`);
    return { revisions: registry.listRevisions(query.workspaceId, params.id) };
  });

  app.post("/v1/extensions/install", async (req, reply) => {
    const body = parseOrBadRequest(ExtensionInstallRequestSchema, req.body);
    const now = nowIso();
    const report = registry.validate(body.manifest);
    enforceSecurityAdmission(report);
    const action = mutationActionRequest("install", body.manifest.id, body, {
      manifestSha256: report.manifestSha256,
      version: body.manifest.version,
    });
    try {
      authorize(repo, action, now);
      const result = registry.install(body, now);
      auditResult(repo, action, "INSTALL", result, now);
      return reply.code(result.deduplicated ? 200 : 201).send(result);
    } catch (error) {
      auditFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/extensions/:id/update", async (req) => {
    const params = parseOrBadRequest(ExtensionParamsSchema, req.params);
    const body = parseOrBadRequest(ExtensionUpdateRequestSchema, req.body);
    const now = nowIso();
    const report = registry.validate(body.manifest);
    enforceSecurityAdmission(report);
    const action = mutationActionRequest("update", params.id, body, {
      manifestSha256: report.manifestSha256,
      version: body.manifest.version,
    });
    try {
      authorize(repo, action, now);
      const result = registry.update(params.id, body, now);
      auditResult(repo, action, "UPDATE", result, now);
      return result;
    } catch (error) {
      auditFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/extensions/:id/rollback", async (req) => {
    const params = parseOrBadRequest(ExtensionParamsSchema, req.params);
    const body = parseOrBadRequest(ExtensionRollbackRequestSchema, req.body);
    const now = nowIso();
    const action = mutationActionRequest("rollback", params.id, body, {
      targetRevisionId: body.targetRevisionId,
    });
    try {
      authorize(repo, action, now);
      const result = registry.rollback(params.id, body, now);
      auditResult(repo, action, "ROLLBACK", result, now);
      return result;
    } catch (error) {
      auditFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/extensions/:id/remove", async (req) => {
    const params = parseOrBadRequest(ExtensionParamsSchema, req.params);
    const body = parseOrBadRequest(ExtensionRemoveRequestSchema, req.body);
    const now = nowIso();
    const action = mutationActionRequest("remove", params.id, body, { reason: body.reason });
    try {
      authorize(repo, action, now);
      const result = registry.remove(params.id, body, now);
      auditResult(repo, action, "REMOVE", result, now);
      return result;
    } catch (error) {
      auditFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/extensions/:id/health", async (req) => {
    const params = parseOrBadRequest(ExtensionParamsSchema, req.params);
    const body = parseOrBadRequest(ExtensionHealthReportRequestSchema, req.body);
    const now = nowIso();
    const action = mutationActionRequest("health", params.id, body, {
      status: body.status,
      detail: body.detail,
    });
    try {
      authorize(repo, action, now);
      const result = registry.reportHealth(params.id, body, now);
      auditResult(repo, action, "HEALTH", result, now);
      return result;
    } catch (error) {
      auditFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });
}
