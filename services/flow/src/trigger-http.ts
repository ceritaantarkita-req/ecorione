import { createHash } from "node:crypto";
import {
  NormalizedTriggerEventSchema,
  ProjectIdSchema,
  ProjectSchema,
  TriggerCreateRequestSchema,
  TriggerFireRequestSchema,
  TriggerFireResponseSchema,
  TriggerIdSchema,
  TriggerStateChangeRequestSchema,
  TriggerUpdateRequestSchema,
  WebhookIngressDeliverySchema,
  WorkspaceIdSchema,
  autonomyExceeds,
  makeId,
  type ActionRequest,
  type CompiledFlowGraphPlan,
  type PolicyVerdict,
  type NormalizedTriggerEvent,
  type Project,
  type Timestamp,
  type TriggerDefinition,
  type TriggerFireResponse,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  HttpError,
  NotFoundError,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import { FlowGraphNotFoundError, type FlowGraphRepository } from "./graph-repository.js";
import type {
  FlowGraphTemporalClient,
  FlowServerTemporalClient,
  TriggerScheduleTemporalClient,
} from "./temporal-client.js";
import {
  TriggerEventDedupeConflictError,
  TriggerKindConflictError,
  TriggerNotFoundError,
  TriggerProjectConflictError,
  TriggerRevisionConflictError,
  TriggerWebhookHookConflictError,
  TriggerWorkspaceConflictError,
  type TriggerRepository,
} from "./trigger-repository.js";

export interface TriggerHttpOptions {
  readonly hubUrl: string;
  readonly token?: string | undefined;
}

const TriggerParamsSchema = z.object({ id: TriggerIdSchema });
const TriggerListQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
});
const TriggerScheduleQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema,
  projectId: ProjectIdSchema,
});
const WebhookParamsSchema = z.object({
  hookId: z
    .string()
    .min(16)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
});

export class TriggerDisabledError extends Error {
  constructor() {
    super("Trigger sedang disabled.");
    this.name = "TriggerDisabledError";
  }
}
export class TriggerWrongKindError extends Error {
  constructor(expected: "manual" | "time" | "event" | "webhook") {
    super(`Trigger harus berjenis ${expected} untuk operasi ini.`);
    this.name = "TriggerWrongKindError";
  }
}
export class TriggerFlowMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TriggerFlowMismatchError";
  }
}
export class TriggerAutonomyError extends Error {
  constructor(trigger: string, ceiling: string) {
    super(`Trigger autonomy ${trigger} melebihi Project ceiling ${ceiling}.`);
    this.name = "TriggerAutonomyError";
  }
}

function triggerError(error: unknown): unknown {
  if (error instanceof TriggerNotFoundError || error instanceof FlowGraphNotFoundError)
    return new NotFoundError(error.message);
  if (
    error instanceof TriggerRevisionConflictError ||
    error instanceof TriggerEventDedupeConflictError ||
    error instanceof TriggerWebhookHookConflictError ||
    error instanceof TriggerWorkspaceConflictError ||
    error instanceof TriggerProjectConflictError ||
    error instanceof TriggerKindConflictError
  )
    return new ConflictError(error.message);
  if (
    error instanceof TriggerDisabledError ||
    error instanceof TriggerWrongKindError ||
    error instanceof TriggerFlowMismatchError ||
    error instanceof TriggerAutonomyError
  )
    return new BadRequestError(error.message);
  return error;
}

function stableKey(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

async function requireProject(
  options: TriggerHttpOptions,
  workspaceId: string,
  projectId: string,
): Promise<Project> {
  return ProjectSchema.parse(
    await httpJson(
      `${options.hubUrl}/v1/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { token: options.token },
    ),
  );
}

function pinnedPlan(
  graphs: FlowGraphRepository,
  workspaceId: string,
  projectId: string,
  graphId: Parameters<FlowGraphRepository["get"]>[0],
  graphVersion: number,
): CompiledFlowGraphPlan {
  const version = graphs.get(graphId, graphVersion);
  if (!version.validation.valid || version.validation.plan === null) {
    throw new TriggerFlowMismatchError("Pinned Flow version tidak valid/compileable.");
  }
  const plan = version.validation.plan;
  if (plan.graph.workspaceId !== workspaceId) {
    throw new TriggerFlowMismatchError("Trigger dan Flow berada di Workspace berbeda.");
  }
  if (plan.graph.projectId !== projectId) {
    throw new TriggerFlowMismatchError("Trigger dan Flow berada di Project berbeda.");
  }
  return plan;
}

async function evaluateTriggerPolicy(
  options: TriggerHttpOptions,
  input: {
    readonly tool: string;
    readonly actionClass: "REVERSIBLE_WRITE" | "EXECUTE";
    readonly triggerId?: string | undefined;
    readonly workspaceId: string;
    readonly projectId: string;
    readonly autonomy: "L0" | "L1" | "L2" | "L3";
    readonly plan: CompiledFlowGraphPlan;
    readonly keyParts: readonly unknown[];
  },
): Promise<void> {
  const operationId = makeId("operation");
  const request: ActionRequest = {
    operationId,
    module: "Flow",
    tool: input.tool,
    actionClass: input.actionClass,
    args: {
      triggerId: input.triggerId ?? null,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      graphId: input.plan.graph.id,
      graphVersion: input.plan.graphVersion,
    },
    scope: input.plan.graph.scope,
    sensitivity: input.plan.graph.sensitivity,
    autonomy: input.autonomy,
    idempotencyKey: stableKey(input.keyParts),
  };
  const verdict = await httpJson<PolicyVerdict>(`${options.hubUrl}/v1/actions/evaluate`, {
    method: "POST",
    token: options.token,
    body: request,
  });
  if (verdict.outcome === "DENY") {
    throw new HttpError(403, "TRIGGER_POLICY_DENIED", verdict.reason);
  }
  if (verdict.outcome === "REQUIRE_APPROVAL") {
    throw new HttpError(409, "TRIGGER_APPROVAL_REQUIRED", verdict.reason);
  }
}

async function validateAuthority(
  options: TriggerHttpOptions,
  trigger: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly requestedAutonomy: "L0" | "L1" | "L2" | "L3";
  },
): Promise<Project> {
  const project = await requireProject(options, trigger.workspaceId, trigger.projectId);
  if (autonomyExceeds(trigger.requestedAutonomy, project.autonomyCeiling)) {
    throw new TriggerAutonomyError(trigger.requestedAutonomy, project.autonomyCeiling);
  }
  return project;
}

function requireGraphTemporal(temporal: FlowServerTemporalClient): FlowGraphTemporalClient {
  if (temporal.startGraph === undefined) {
    throw new HttpError(
      503,
      "FLOW_GRAPH_RUNTIME_UNAVAILABLE",
      "Temporal graph runtime tidak dikonfigurasi.",
    );
  }
  return temporal as FlowGraphTemporalClient;
}

function requireScheduleTemporal(
  temporal: FlowServerTemporalClient,
): TriggerScheduleTemporalClient {
  if (
    temporal.reconcileTimeTrigger === undefined ||
    temporal.pauseTimeTrigger === undefined ||
    temporal.describeTimeTrigger === undefined
  ) {
    throw new HttpError(
      503,
      "TRIGGER_SCHEDULE_RUNTIME_UNAVAILABLE",
      "Temporal Schedule runtime tidak dikonfigurasi.",
    );
  }
  return temporal as TriggerScheduleTemporalClient;
}

function deterministicManualIds(
  triggerId: string,
  requestId: string,
): {
  workflowId: TriggerFireResponse["workflowId"];
  operationId: TriggerFireResponse["operationId"];
} {
  const digest = createHash("sha256")
    .update(`${triggerId}:${requestId}`)
    .digest("hex")
    .slice(0, 24);
  return {
    workflowId: `wf_trigger_${digest}` as TriggerFireResponse["workflowId"],
    operationId: `op_trigger_${digest}` as TriggerFireResponse["operationId"],
  };
}

function deterministicEventIds(
  triggerId: string,
  dedupeKey: string,
): {
  workflowId: TriggerFireResponse["workflowId"];
  operationId: TriggerFireResponse["operationId"];
} {
  const digest = createHash("sha256")
    .update(`event:${triggerId}:${dedupeKey}`)
    .digest("hex")
    .slice(0, 24);
  return {
    workflowId: `wf_trigger_${digest}` as TriggerFireResponse["workflowId"],
    operationId: `op_trigger_${digest}` as TriggerFireResponse["operationId"],
  };
}

function triggerAcceptsEvent(
  trigger: TriggerDefinition,
  event: NormalizedTriggerEvent,
): boolean {
  if (trigger.kind === "event") {
    const config = trigger.configuration as { source: string; eventKind: string };
    return config.source === event.source && config.eventKind === event.kind;
  }
  if (trigger.kind === "webhook") {
    const config = trigger.configuration as {
      adapter: "generic";
      hookId: string;
      source: string;
      eventKind: string;
    };
    return event.source === config.source && event.kind === config.eventKind;
  }
  return false;
}

async function startGraphIdempotently(
  temporal: FlowServerTemporalClient,
  input: Parameters<FlowGraphTemporalClient["startGraph"]>[0],
): Promise<void> {
  try {
    await requireGraphTemporal(temporal).startGraph(input);
  } catch (error) {
    try {
      await temporal.describe(input.runId);
      return;
    } catch {
      throw error;
    }
  }
}

async function reconcileTimeTrigger(
  temporal: FlowServerTemporalClient,
  trigger: TriggerDefinition,
  plan: CompiledFlowGraphPlan,
): Promise<void> {
  if (trigger.kind !== "time") return;
  await requireScheduleTemporal(temporal).reconcileTimeTrigger(trigger, plan);
}

export async function reconcilePersistedTimeTriggers(
  triggers: TriggerRepository,
  graphs: FlowGraphRepository,
  temporal: FlowServerTemporalClient,
): Promise<void> {
  for (const trigger of triggers.list()) {
    if (trigger.kind !== "time") continue;
    const plan = pinnedPlan(
      graphs,
      trigger.workspaceId,
      trigger.projectId,
      trigger.graphId,
      trigger.graphVersion,
    );
    await reconcileTimeTrigger(temporal, trigger, plan);
  }
}

export function registerTriggerRoutes(
  app: FastifyInstance,
  triggers: TriggerRepository,
  graphs: FlowGraphRepository,
  temporal: FlowServerTemporalClient,
  options: TriggerHttpOptions,
): void {
  app.get("/v1/triggers", async (req) => {
    const query = parseOrBadRequest(TriggerListQuerySchema, req.query);
    return { triggers: triggers.list(query.workspaceId, query.projectId) };
  });

  app.get<{ Params: { id: string } }>("/v1/triggers/:id", async (req) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    try {
      return triggers.require(id);
    } catch (error) {
      throw triggerError(error);
    }
  });

  app.get<{ Params: { id: string } }>("/v1/triggers/:id/schedule", async (req) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    const query = parseOrBadRequest(TriggerScheduleQuerySchema, req.query);
    try {
      const trigger = triggers.require(id);
      if (trigger.workspaceId !== query.workspaceId) throw new TriggerWorkspaceConflictError();
      if (trigger.projectId !== query.projectId) throw new TriggerProjectConflictError();
      if (trigger.kind !== "time") throw new TriggerWrongKindError("time");
      return await requireScheduleTemporal(temporal).describeTimeTrigger(trigger);
    } catch (error) {
      throw triggerError(error);
    }
  });

  app.post("/v1/triggers", async (req, reply) => {
    const body = parseOrBadRequest(TriggerCreateRequestSchema, req.body);
    try {
      await validateAuthority(options, body);
      const plan = pinnedPlan(
        graphs,
        body.workspaceId,
        body.projectId,
        body.graphId,
        body.graphVersion,
      );
      await evaluateTriggerPolicy(options, {
        tool: "flow.trigger.create",
        actionClass: "REVERSIBLE_WRITE",
        workspaceId: body.workspaceId,
        projectId: body.projectId,
        autonomy: body.requestedAutonomy,
        plan,
        keyParts: ["create", body],
      });
      const trigger = triggers.create(body, nowIso() as Timestamp);
      await reconcileTimeTrigger(temporal, trigger, plan);
      return reply.code(201).send(trigger);
    } catch (error) {
      throw triggerError(error);
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/triggers/:id", async (req) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    const body = parseOrBadRequest(TriggerUpdateRequestSchema, req.body);
    try {
      await validateAuthority(options, body);
      const plan = pinnedPlan(
        graphs,
        body.workspaceId,
        body.projectId,
        body.graphId,
        body.graphVersion,
      );
      await evaluateTriggerPolicy(options, {
        tool: "flow.trigger.update",
        actionClass: "REVERSIBLE_WRITE",
        triggerId: id,
        workspaceId: body.workspaceId,
        projectId: body.projectId,
        autonomy: body.requestedAutonomy,
        plan,
        keyParts: ["update", id, body.expectedRevision, body],
      });
      const trigger = triggers.update(id, body, nowIso() as Timestamp);
      await reconcileTimeTrigger(temporal, trigger, plan);
      return trigger;
    } catch (error) {
      throw triggerError(error);
    }
  });

  async function setEnabled(
    id: TriggerDefinition["id"],
    raw: unknown,
    enabled: boolean,
  ): Promise<TriggerDefinition> {
    const body = parseOrBadRequest(TriggerStateChangeRequestSchema, raw);
    const current = triggers.require(id);
    if (current.workspaceId !== body.workspaceId) throw new TriggerWorkspaceConflictError();
    if (current.projectId !== body.projectId) throw new TriggerProjectConflictError();
    await validateAuthority(options, current);
    const plan = pinnedPlan(
      graphs,
      current.workspaceId,
      current.projectId,
      current.graphId,
      current.graphVersion,
    );
    await evaluateTriggerPolicy(options, {
      tool: enabled ? "flow.trigger.enable" : "flow.trigger.disable",
      actionClass: "REVERSIBLE_WRITE",
      triggerId: id,
      workspaceId: current.workspaceId,
      projectId: current.projectId,
      autonomy: current.requestedAutonomy,
      plan,
      keyParts: [enabled ? "enable" : "disable", id, body.expectedRevision],
    });
    const trigger = triggers.setEnabled(
      id,
      body.workspaceId,
      body.projectId,
      body.expectedRevision,
      enabled,
      nowIso() as Timestamp,
    );
    await reconcileTimeTrigger(temporal, trigger, plan);
    return trigger;
  }

  app.post<{ Params: { id: string } }>("/v1/triggers/:id/enable", async (req) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    try {
      return await setEnabled(id, req.body, true);
    } catch (error) {
      throw triggerError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/triggers/:id/disable", async (req) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    try {
      return await setEnabled(id, req.body, false);
    } catch (error) {
      throw triggerError(error);
    }
  });

  async function dispatchNormalizedEvent(
    trigger: TriggerDefinition,
    event: NormalizedTriggerEvent,
  ): Promise<{ readonly response: TriggerFireResponse; readonly statusCode: 200 | 202 }> {
    if (trigger.workspaceId !== event.workspaceId) throw new TriggerWorkspaceConflictError();
    if (trigger.projectId !== event.projectId) throw new TriggerProjectConflictError();
    if (trigger.kind !== "event" && trigger.kind !== "webhook") {
      throw new TriggerWrongKindError("event");
    }
    if (!trigger.enabled) throw new TriggerDisabledError();
    if (!triggerAcceptsEvent(trigger, event)) {
      throw new TriggerFlowMismatchError("Event tidak cocok dengan selector Trigger.");
    }

    await validateAuthority(options, trigger);
    const plan = pinnedPlan(
      graphs,
      trigger.workspaceId,
      trigger.projectId,
      trigger.graphId,
      trigger.graphVersion,
    );
    const eventDigest = stableKey(["normalized-event-v1", event]);
    await evaluateTriggerPolicy(options, {
      tool: `flow.trigger.${trigger.kind}.dispatch`,
      actionClass: "EXECUTE",
      triggerId: trigger.id,
      workspaceId: trigger.workspaceId,
      projectId: trigger.projectId,
      autonomy: trigger.requestedAutonomy,
      plan,
      keyParts: [
        trigger.kind,
        trigger.id,
        event.dedupeKey,
        eventDigest,
        trigger.graphId,
        trigger.graphVersion,
      ],
    });

    const ids = deterministicEventIds(trigger.id, event.dedupeKey);
    const response = TriggerFireResponseSchema.parse({
      triggerId: trigger.id,
      graphId: trigger.graphId,
      graphVersion: trigger.graphVersion,
      workflowId: ids.workflowId,
      operationId: ids.operationId,
      deduplicated: false,
    });
    const reservation = triggers.reserveEventDelivery(
      trigger.id,
      event.dedupeKey,
      event.eventId,
      eventDigest,
      response,
      nowIso() as Timestamp,
    );
    if (reservation.state === "STARTED") {
      return {
        response: { ...reservation.response, deduplicated: true },
        statusCode: 200,
      };
    }

    await startGraphIdempotently(temporal, {
      runId: ids.workflowId,
      operationId: ids.operationId,
      plan,
      input: event.payload,
      triggerId: trigger.id,
      autonomy: trigger.requestedAutonomy,
      depth: 0,
    });
    triggers.markEventDeliveryStarted(trigger.id, event.dedupeKey, eventDigest);
    return {
      response: {
        ...reservation.response,
        deduplicated: reservation.deduplicated,
      },
      statusCode: reservation.deduplicated ? 200 : 202,
    };
  }

  app.post<{ Params: { id: string } }>("/v1/triggers/:id/event", async (req, reply) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    const event = parseOrBadRequest(NormalizedTriggerEventSchema, req.body);
    try {
      const result = await dispatchNormalizedEvent(triggers.require(id), event);
      return reply.code(result.statusCode).send(result.response);
    } catch (error) {
      throw triggerError(error);
    }
  });

  app.post<{ Params: { hookId: string } }>("/v1/webhooks/:hookId", async (req, reply) => {
    const { hookId } = parseOrBadRequest(WebhookParamsSchema, req.params);
    const body = parseOrBadRequest(WebhookIngressDeliverySchema, req.body);
    try {
      const trigger = triggers.findWebhookByHookId(hookId);
      if (trigger === null) throw new NotFoundError("Webhook Trigger tidak ditemukan.");
      const config = trigger.configuration as {
        adapter: "generic";
        hookId: string;
        source: string;
        eventKind: string;
      };
      const receivedAt = nowIso() as Timestamp;
      const eventIdDigest = createHash("sha256")
        .update(`${hookId}:${body.deliveryId}`)
        .digest("hex")
        .slice(0, 24);
      const event = NormalizedTriggerEventSchema.parse({
        eventId: `evt_webhook_${eventIdDigest}`,
        source: config.source,
        kind: config.eventKind,
        occurredAt: body.occurredAt ?? receivedAt,
        receivedAt,
        workspaceId: trigger.workspaceId,
        projectId: trigger.projectId,
        dedupeKey: `webhook:${hookId}:${body.deliveryId}`,
        payload: body.payload,
        metadata: { ...body.metadata, hookId },
      });
      const result = await dispatchNormalizedEvent(trigger, event);
      return reply.code(result.statusCode).send(result.response);
    } catch (error) {
      throw triggerError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/triggers/:id/fire", async (req, reply) => {
    const { id } = parseOrBadRequest(TriggerParamsSchema, req.params);
    const body = parseOrBadRequest(TriggerFireRequestSchema, req.body);
    try {
      const trigger = triggers.require(id);
      if (trigger.workspaceId !== body.workspaceId) throw new TriggerWorkspaceConflictError();
      if (trigger.projectId !== body.projectId) throw new TriggerProjectConflictError();
      if (trigger.kind !== "manual") throw new TriggerWrongKindError("manual");
      if (!trigger.enabled) throw new TriggerDisabledError();

      const existing = triggers.getManualFire(id, body.requestId);
      if (existing !== null) return reply.code(200).send(existing);

      await validateAuthority(options, trigger);
      const plan = pinnedPlan(
        graphs,
        trigger.workspaceId,
        trigger.projectId,
        trigger.graphId,
        trigger.graphVersion,
      );
      await evaluateTriggerPolicy(options, {
        tool: "flow.trigger.manual.dispatch",
        actionClass: "EXECUTE",
        triggerId: id,
        workspaceId: trigger.workspaceId,
        projectId: trigger.projectId,
        autonomy: trigger.requestedAutonomy,
        plan,
        keyParts: ["manual-fire", id, body.requestId, trigger.graphId, trigger.graphVersion],
      });

      const ids = deterministicManualIds(id, body.requestId);
      await requireGraphTemporal(temporal).startGraph({
        runId: ids.workflowId,
        operationId: ids.operationId,
        plan,
        input: body.input,
        triggerId: trigger.id,
        autonomy: trigger.requestedAutonomy,
        depth: 0,
      });
      const response = TriggerFireResponseSchema.parse({
        triggerId: id,
        graphId: trigger.graphId,
        graphVersion: trigger.graphVersion,
        workflowId: ids.workflowId,
        operationId: ids.operationId,
        deduplicated: false,
      });
      return reply
        .code(202)
        .send(triggers.recordManualFire(id, body.requestId, response, nowIso() as Timestamp));
    } catch (error) {
      throw triggerError(error);
    }
  });
}
