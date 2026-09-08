/** Fase 2 MCP memory boundary. Every inbound tool crosses Hub policy + audit before Context. */
import { createHash } from "node:crypto";
import {
  EpisodeSchema,
  MemoryFactSchema,
  McpMemoryGetSchema,
  McpMemoryOpenSchema,
  McpMemoryProposeSchema,
  McpMemoryRecentSchema,
  McpMemorySearchSchema,
  idempotencyPayload,
  makeId,
  sensitivityRank,
  type ActionClass,
  type ActionRequest,
  type McpAccessContext,
  type OperationId,
  type Scope,
  type Sensitivity,
  type Timestamp,
} from "@ecorione/shared-schema";
import {
  ForbiddenError,
  HttpError,
  NotFoundError,
  RemoteServiceError,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { evaluatePolicy } from "./policy-engine.js";
import type { HubRepository } from "./repository.js";
import { nowIso } from "./clock.js";

export interface McpRouteOptions {
  readonly contextUrl: string;
  readonly internalToken?: string | undefined;
}

function effectiveSensitivity(requested: Sensitivity | undefined, access: McpAccessContext): Sensitivity {
  const value = requested ?? access.maxSensitivity;
  if (sensitivityRank(value) > sensitivityRank(access.maxSensitivity)) {
    throw new ForbiddenError(`Sensitivity ${value} melewati grant ${access.maxSensitivity}.`);
  }
  return value;
}

function assertScopes(scopes: readonly Scope[], access: McpAccessContext): void {
  const allowed = new Set(access.allowedScopes);
  for (const scope of scopes) {
    if (!allowed.has(scope)) throw new ForbiddenError(`Scope MCP tidak diizinkan untuk principal ini: ${scope}.`);
  }
}

function hostedEligible(syncClass: string): boolean {
  return syncClass === "CLOUD_ALLOWED" || syncClass === "PUBLIC";
}

function assertMemoryVisible(
  item: { readonly scope: Scope; readonly sensitivity: Sensitivity; readonly syncClass: string },
  access: McpAccessContext,
): void {
  assertScopes([item.scope], access);
  if (sensitivityRank(item.sensitivity) > sensitivityRank(access.maxSensitivity)) {
    throw new ForbiddenError("Item memori melewati sensitivity grant MCP.");
  }
  if (access.delivery === "hosted" && !hostedEligible(item.syncClass)) {
    throw new ForbiddenError("Item memori tidak boleh dikirim plaintext ke model hosted.");
  }
}

function idempotencyKey(access: McpAccessContext, tool: string, args: Record<string, unknown>): string {
  const payload = idempotencyPayload({ module: "Hub", tool, args });
  return createHash("sha256")
    .update(`${access.principalId}\n${access.requestId}\n${payload}`)
    .digest("hex");
}

function evaluateMcpAction(
  repo: HubRepository,
  access: McpAccessContext,
  tool: string,
  actionClass: ActionClass,
  args: Record<string, unknown>,
  scope: Scope,
  sensitivity: Sensitivity,
  now: Timestamp,
): { readonly operationId: OperationId; readonly idempotencyKey: string | null } {
  const operationId = makeId("operation");
  const key = actionClass === "READ" ? null : idempotencyKey(access, tool, args);
  const action: ActionRequest = {
    operationId,
    module: "Hub",
    tool,
    actionClass,
    args,
    scope,
    sensitivity,
    autonomy: "L1",
    idempotencyKey: key,
  };

  repo.recordAuditEvent({
    type: "MCP_TOOL_CALLED",
    operationId,
    module: "Hub",
    detail: {
      tool,
      principalId: access.principalId,
      sourceApp: access.sourceApp,
      delivery: access.delivery,
      requestId: access.requestId,
    },
    now,
  });
  repo.recordAuditEvent({
    type: "ACTION_REQUESTED",
    operationId,
    module: "Hub",
    detail: { tool, actionClass, idempotencyKey: key },
    now,
  });
  const evaluation = evaluatePolicy(action);
  repo.recordAuditEvent({
    type: "POLICY_EVALUATED",
    operationId,
    module: "Hub",
    detail: { outcome: evaluation.verdict.outcome, reason: evaluation.verdict.reason },
    ruleId: evaluation.rule.id,
    now,
  });
  if (evaluation.verdict.outcome !== "ALLOW") {
    throw new ForbiddenError(`MCP tool ditolak policy: ${evaluation.verdict.reason}`);
  }
  return { operationId, idempotencyKey: key };
}

async function contextJson<T>(options: McpRouteOptions, path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  try {
    return await httpJson<T>(`${options.contextUrl}${path}`, { token: options.internalToken, ...init });
  } catch (error) {
    if (error instanceof RemoteServiceError && error.statusCode === 404) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
}

export function registerMcpRoutes(app: FastifyInstance, repo: HubRepository, options: McpRouteOptions): void {
  app.post("/v1/mcp/memory/search", async (req) => {
    const body = parseOrBadRequest(McpMemorySearchSchema, req.body);
    assertScopes(body.scopes, body.access);
    const maxSensitivity = effectiveSensitivity(body.maxSensitivity, body.access);
    const now = nowIso();
    evaluateMcpAction(repo, body.access, "mcp.memory_search", "READ", { query: body.query, scopes: body.scopes, k: body.k }, body.scopes[0]!, maxSensitivity, now);
    return contextJson(options, "/v1/retrieve", {
      method: "POST",
      body: {
        query: body.query,
        scopes: body.scopes,
        k: body.k,
        maxSensitivity,
        hostedEligibleOnly: body.access.delivery === "hosted",
        now,
      },
    });
  });

  app.post("/v1/mcp/memory/get", async (req) => {
    const body = parseOrBadRequest(McpMemoryGetSchema, req.body);
    const now = nowIso();
    evaluateMcpAction(repo, body.access, "mcp.memory_get", "READ", { id: body.id }, body.access.allowedScopes[0]!, body.access.maxSensitivity, now);
    const path = body.id.startsWith("mem_") ? `/v1/facts/${encodeURIComponent(body.id)}` : `/v1/episodes/${encodeURIComponent(body.id)}`;
    const raw = await contextJson<unknown>(options, path);
    const item = body.id.startsWith("mem_") ? MemoryFactSchema.parse(raw) : EpisodeSchema.parse(raw);
    assertMemoryVisible(item, body.access);
    return item;
  });

  app.post("/v1/mcp/memory/propose", async (req) => {
    const body = parseOrBadRequest(McpMemoryProposeSchema, req.body);
    assertScopes([body.scope], body.access);
    const now = nowIso();
    const audit = evaluateMcpAction(repo, body.access, "mcp.memory_propose", "REVERSIBLE_WRITE", { text: body.text, scope: body.scope }, body.scope, body.access.maxSensitivity, now);
    const key = audit.idempotencyKey!;
    const prior = repo.getIdempotentResult<{ id: string }>(key);
    if (prior !== null) {
      repo.recordAuditEvent({
        type: "ACTION_SKIPPED_IDEMPOTENT",
        operationId: audit.operationId,
        module: "Hub",
        detail: { idempotencyKey: key, priorOperationId: prior.operationId },
        now,
      });
      return prior.result;
    }
    const result = await contextJson<{ id: string }>(options, "/v1/facts/propose", {
      method: "POST",
      body: {
        proposedText: body.text,
        proposedAt: now,
        provenance: { sourceApp: body.access.sourceApp, toolCallId: body.access.requestId },
        trust: "HOSTED_AGENT",
        scope: body.scope,
      },
    });
    repo.saveIdempotentResult(key, audit.operationId, "mcp.memory_propose", result, now);
    repo.recordAuditEvent({
      type: "MEMORY_PROPOSED",
      operationId: audit.operationId,
      module: "Hub",
      detail: { factId: result.id, scope: body.scope, principalId: body.access.principalId },
      now,
    });
    return result;
  });

  app.post("/v1/mcp/memory/recent", async (req) => {
    const body = parseOrBadRequest(McpMemoryRecentSchema, req.body);
    assertScopes(body.scopes, body.access);
    const now = nowIso();
    evaluateMcpAction(repo, body.access, "mcp.memory_recent", "READ", { scopes: body.scopes, limit: body.limit }, body.scopes[0]!, body.access.maxSensitivity, now);
    const groups = await Promise.all(body.scopes.map((scope) => contextJson<{ episodes: unknown[] }>(
      options,
      `/v1/episodes?scope=${encodeURIComponent(scope)}&limit=${String(body.limit)}&hostedEligible=${body.access.delivery === "hosted" ? "1" : "0"}`,
    )));
    const episodes = groups.flatMap((group) => group.episodes.map((item) => EpisodeSchema.parse(item)));
    episodes.sort((a, b) => b.ts.localeCompare(a.ts) || b.id.localeCompare(a.id));
    return { episodes: episodes.slice(0, body.limit) };
  });

  app.post("/v1/mcp/memory/open", async (req) => {
    const body = parseOrBadRequest(McpMemoryOpenSchema, req.body);
    assertScopes([body.artifactPointer.scope], body.access);
    effectiveSensitivity(body.artifactPointer.sensitivity, body.access);
    const now = nowIso();
    evaluateMcpAction(repo, body.access, "mcp.memory_open", "READ", { artifactId: body.artifactPointer.id }, body.artifactPointer.scope, body.artifactPointer.sensitivity, now);
    throw new HttpError(501, "NOT_IMPLEMENTED", "Artifact belum tersedia; memory_open aktif setelah Fase 3 Artifact.");
  });
}
