import {
  AuthoritySubjectKindSchema,
  CapabilityAuthorizationRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityRevokeRequestSchema,
  WorkspaceIdSchema,
  type ActionRequest,
  type OperationId,
  type Timestamp,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  HttpError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import {
  CapabilityIdempotencyConflictError,
  CapabilityRegistry,
  CapabilityUnknownError,
} from "./capability-registry.js";
import { evaluatePolicy } from "./policy-engine.js";
import type { HubRepository } from "./repository.js";

const GrantQuerySchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    subjectKind: AuthoritySubjectKindSchema.optional(),
    subjectId: z.string().min(1).max(192).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.subjectKind === undefined) !== (value.subjectId === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "subjectKind dan subjectId harus diberikan bersama.",
      });
    }
  });

export class AuthorityApprovalRequiredError extends Error {
  constructor(
    readonly operationId: OperationId,
    readonly prompt: string,
  ) {
    super(`Perubahan authority membutuhkan approval: ${operationId}. ${prompt}`);
    this.name = "AuthorityApprovalRequiredError";
  }
}
export class AuthorityPolicyDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorityPolicyDeniedError";
  }
}

function toHttpError(error: unknown): unknown {
  if (error instanceof CapabilityUnknownError) return new BadRequestError(error.message);
  if (error instanceof CapabilityIdempotencyConflictError)
    return new ConflictError(error.message);
  if (error instanceof AuthorityApprovalRequiredError) {
    return new HttpError(409, "AUTHORITY_APPROVAL_REQUIRED", error.message, {
      operationId: error.operationId,
      prompt: error.prompt,
    });
  }
  if (error instanceof AuthorityPolicyDeniedError) {
    return new HttpError(403, "AUTHORITY_POLICY_DENIED", error.message);
  }
  return error;
}

function mutationActionRequest(
  action: "grant" | "revoke",
  body:
    | z.infer<typeof CapabilityGrantRequestSchema>
    | z.infer<typeof CapabilityRevokeRequestSchema>,
): ActionRequest {
  return {
    operationId: body.operationId,
    module: "Hub",
    tool: `authority.${action}`,
    actionClass: "POLICY_ADMIN",
    args: {
      workspaceId: body.workspaceId,
      subject: body.subject,
      capabilityId: body.capabilityId,
      permissionIds: body.permissionIds,
      scope: body.scope,
      maxSensitivity: body.maxSensitivity,
      reason: body.reason,
    },
    scope: body.scope,
    sensitivity: body.maxSensitivity,
    autonomy: body.autonomy,
    idempotencyKey: body.idempotencyKey,
  };
}

function authorizeMutation(repo: HubRepository, request: ActionRequest, now: Timestamp): void {
  const existing = repo.getApprovalByIdempotencyKey(request.idempotencyKey!);
  if (existing !== null) {
    if (existing.status === "APPROVE") return;
    if (existing.status === "PENDING") {
      throw new AuthorityApprovalRequiredError(existing.operationId, existing.prompt);
    }
    throw new AuthorityPolicyDeniedError(
      `Approval authority sebelumnya berstatus ${existing.status}; mutation ditolak.`,
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
    throw new AuthorityApprovalRequiredError(request.operationId, approval.prompt);
  }
  throw new AuthorityPolicyDeniedError(evaluation.verdict.reason);
}

function auditMutationFailure(
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

export function registerCapabilityRoutes(
  app: FastifyInstance,
  registry: CapabilityRegistry,
  repo: HubRepository,
): void {
  app.get("/v1/capabilities", async () => ({ capabilities: registry.listDefinitions() }));

  app.get("/v1/authority/grants", async (req) => {
    const query = parseOrBadRequest(GrantQuerySchema, req.query);
    const subject =
      query.subjectKind === undefined || query.subjectId === undefined
        ? undefined
        : { kind: query.subjectKind, id: query.subjectId };
    return { grants: registry.listGrants({ workspaceId: query.workspaceId, subject }) };
  });

  app.post("/v1/authority/authorize", async (req) => {
    const body = parseOrBadRequest(CapabilityAuthorizationRequestSchema, req.body);
    const result = registry.authorize(body);
    const now = nowIso();
    repo.recordAuditEvent({
      type: result.outcome === "ALLOW" ? "CAPABILITY_AUTHORIZED" : "CAPABILITY_DENIED",
      operationId: body.operationId,
      module: "Hub",
      detail: {
        workspaceId: body.workspaceId,
        subject: body.subject,
        capabilityId: body.capabilityId,
        permissionIds: body.permissionIds,
        scope: body.scope,
        sensitivity: body.sensitivity,
        outcome: result.outcome,
      },
      now,
    });
    return result;
  });

  app.post("/v1/authority/grants", async (req, reply) => {
    const body = parseOrBadRequest(CapabilityGrantRequestSchema, req.body);
    const now = nowIso();
    const action = mutationActionRequest("grant", body);
    try {
      authorizeMutation(repo, action, now);
      const result = registry.grant(body, now);
      repo.recordAuditEvent({
        type: "CAPABILITY_GRANTED",
        operationId: body.operationId,
        module: "Hub",
        detail: {
          workspaceId: body.workspaceId,
          subject: body.subject,
          capabilityId: body.capabilityId,
          permissionIds: body.permissionIds,
          scope: body.scope,
          maxSensitivity: body.maxSensitivity,
          deduplicated: result.deduplicated,
        },
        now,
      });
      return reply.code(result.deduplicated ? 200 : 201).send(result);
    } catch (error) {
      auditMutationFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });

  app.post("/v1/authority/revoke", async (req) => {
    const body = parseOrBadRequest(CapabilityRevokeRequestSchema, req.body);
    const now = nowIso();
    const action = mutationActionRequest("revoke", body);
    try {
      authorizeMutation(repo, action, now);
      const result = registry.revoke(body, now);
      repo.recordAuditEvent({
        type: "CAPABILITY_REVOKED",
        operationId: body.operationId,
        module: "Hub",
        detail: {
          workspaceId: body.workspaceId,
          subject: body.subject,
          capabilityId: body.capabilityId,
          permissionIds: body.permissionIds,
          scope: body.scope,
          revoked: result.revoked,
          deduplicated: result.deduplicated,
        },
        now,
      });
      return result;
    } catch (error) {
      auditMutationFailure(repo, action, error, now);
      throw toHttpError(error);
    }
  });
}
