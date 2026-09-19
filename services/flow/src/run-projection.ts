import {
  AuditEventSchema,
  OperationIdSchema,
  ProjectIdSchema,
  RunListItemSchema,
  RunProjectionSchema,
  WorkspaceIdSchema,
  type AuditEvent,
  type OperationId,
  type RunApprovalView,
  type RunListItem,
  type RunProjection,
  type RunStatus,
} from "@ecorione/shared-schema";
import { httpJson } from "@ecorione/shared-server";
import type { FlowServerTemporalClient } from "./temporal-client.js";
import type { TriggerRepository } from "./trigger-repository.js";

interface TraceRecord {
  readonly id: string;
  readonly name: string;
  readonly attributes: Record<string, string | number | boolean | string[]>;
  readonly operationId: string | null;
  readonly traceId: string | null;
  readonly recordedAt: string;
}

interface TraceSummary {
  readonly callCount: number;
  readonly totalActualUsd: number;
  readonly totalNaiveUsd: number;
  readonly totalSavedUsd: number;
}

export interface RunProjectionOptions {
  readonly hubUrl: string;
  readonly rndUrl: string;
  readonly token?: string | undefined;
}

export interface RunProjectionDependencies {
  readonly triggers: TriggerRepository;
  readonly temporal: FlowServerTemporalClient;
  readonly options: RunProjectionOptions;
}

interface RunEvidence {
  readonly operationId: OperationId;
  readonly workspaceId: ReturnType<typeof WorkspaceIdSchema.parse>;
  readonly projectId: ReturnType<typeof ProjectIdSchema.parse>;
  readonly triggerId: string | null;
  readonly graphId: string;
  readonly graphVersion: number;
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly terminalStatus: RunStatus | null;
  readonly traces: readonly TraceRecord[];
}

function stringAttribute(
  attributes: TraceRecord["attributes"],
  key: string,
  required = true,
): string | null {
  const value = attributes[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (!required) return null;
  throw new Error(`Run trace tidak memiliki atribut string ${key}.`);
}

function numberAttribute(attributes: TraceRecord["attributes"], key: string): number {
  const value = attributes[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`Run trace tidak memiliki atribut integer ${key}.`);
  }
  return value;
}

function terminalStatus(name: string): RunStatus | null {
  if (name === "flow.graph.run.completed") return "COMPLETED";
  if (name === "flow.graph.run.failed") return "FAILED";
  return null;
}

function evidenceFromTraces(operationId: string, traces: readonly TraceRecord[]): RunEvidence | null {
  const lifecycle = traces
    .filter(
      (trace) =>
        trace.operationId === operationId &&
        (trace.name === "flow.graph.run.started" ||
          trace.name === "flow.graph.run.completed" ||
          trace.name === "flow.graph.run.failed"),
    )
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const started = lifecycle.find((trace) => trace.name === "flow.graph.run.started");
  if (started === undefined) return null;
  try {
    const latestTerminal = [...lifecycle]
      .reverse()
      .find((trace) => terminalStatus(trace.name) !== null);
    const workspaceId = stringAttribute(started.attributes, "workspaceId");
    const projectId = stringAttribute(started.attributes, "projectId");
    const graphId = stringAttribute(started.attributes, "graphId");
    const runId = stringAttribute(started.attributes, "runId");
    if (workspaceId === null || projectId === null || graphId === null || runId === null) {
      return null;
    }
    return {
      operationId: OperationIdSchema.parse(operationId),
      workspaceId: WorkspaceIdSchema.parse(workspaceId),
      projectId: ProjectIdSchema.parse(projectId),
      triggerId: stringAttribute(started.attributes, "triggerId", false),
      graphId,
      graphVersion: numberAttribute(started.attributes, "graphVersion"),
      runId,
      startedAt: started.recordedAt,
      finishedAt: latestTerminal?.recordedAt ?? null,
      terminalStatus: latestTerminal === undefined ? null : terminalStatus(latestTerminal.name),
      traces,
    };
  } catch {
    // Legacy/incomplete evidence is not silently reclassified into a Project Run.
    return null;
  }
}

function temporalStatus(status: string | undefined): RunStatus | null {
  switch (status) {
    case "RUNNING":
      return "RUNNING";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "TERMINATED":
      return "TERMINATED";
    case "TIMED_OUT":
      return "TIMED_OUT";
    default:
      return null;
  }
}

function approvalsFromAudit(events: readonly AuditEvent[]): RunApprovalView[] {
  const byOperation = new Map<string, RunApprovalView>();
  for (const event of events) {
    if (event.operationId === null) continue;
    const current = byOperation.get(event.operationId);
    if (event.type === "APPROVAL_REQUESTED") {
      const prompt = typeof event.detail.prompt === "string" ? event.detail.prompt : null;
      byOperation.set(event.operationId, {
        operationId: event.operationId,
        status: current?.status ?? "PENDING",
        prompt,
        note: current?.note ?? null,
        requestedAt: event.ts,
        decidedAt: current?.decidedAt ?? null,
      });
    } else if (event.type === "APPROVAL_DECIDED") {
      const decision =
        event.detail.decision === "APPROVE" ||
        event.detail.decision === "EDIT" ||
        event.detail.decision === "REJECT" ||
        event.detail.decision === "RESPOND"
          ? event.detail.decision
          : "UNKNOWN";
      const note = typeof event.detail.note === "string" ? event.detail.note : null;
      byOperation.set(event.operationId, {
        operationId: event.operationId,
        status: decision,
        prompt: current?.prompt ?? null,
        note,
        requestedAt: current?.requestedAt ?? null,
        decidedAt: event.ts,
      });
    }
  }
  return [...byOperation.values()].sort((left, right) =>
    (left.requestedAt ?? left.decidedAt ?? "").localeCompare(
      right.requestedAt ?? right.decidedAt ?? "",
    ),
  );
}

async function listTraces(options: RunProjectionOptions, limit = 1000): Promise<TraceRecord[]> {
  const result = await httpJson<{ traces: TraceRecord[] }>(
    `${options.rndUrl}/v1/traces?limit=${String(limit)}`,
    { token: options.token },
  );
  return result.traces;
}

async function tracesFor(
  options: RunProjectionOptions,
  operationId: OperationId,
): Promise<TraceRecord[]> {
  const result = await httpJson<{ traces: TraceRecord[] }>(
    `${options.rndUrl}/v1/traces?operationId=${encodeURIComponent(operationId)}&limit=1000`,
    { token: options.token },
  );
  return result.traces;
}

async function auditFor(
  options: RunProjectionOptions,
  operationId: OperationId,
): Promise<AuditEvent[]> {
  const result = await httpJson<{ events: unknown[] }>(
    `${options.hubUrl}/v1/audit?operationPrefix=${encodeURIComponent(operationId)}`,
    { token: options.token },
  );
  return result.events.map((event) => AuditEventSchema.parse(event));
}

export async function listRunProjections(
  deps: RunProjectionDependencies,
  filter: { workspaceId: string; projectId: string; limit: number },
): Promise<RunListItem[]> {
  const traces = await listTraces(deps.options, Math.max(200, filter.limit * 20));
  const operationIds = [
    ...new Set(
      traces
        .filter((trace) => trace.name === "flow.graph.run.started" && trace.operationId !== null)
        .map((trace) => trace.operationId as string),
    ),
  ];
  const evidence = operationIds
    .map((operationId) => evidenceFromTraces(operationId, traces))
    .filter((item): item is RunEvidence => item !== null)
    .filter(
      (item) => item.workspaceId === filter.workspaceId && item.projectId === filter.projectId,
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, filter.limit);

  return Promise.all(
    evidence.map(async (item) => {
      let currentStatus: RunStatus | null = null;
      let temporalAvailable = false;
      try {
        const described = await deps.temporal.describe(item.runId as never);
        temporalAvailable = true;
        currentStatus = temporalStatus(described.status);
      } catch {
        temporalAvailable = false;
      }
      const triggerAvailable =
        item.triggerId === null || deps.triggers.get(item.triggerId as never) !== null;
      return RunListItemSchema.parse({
        operationId: item.operationId,
        workspaceId: item.workspaceId,
        projectId: item.projectId,
        triggerId: item.triggerId,
        graphId: item.graphId,
        graphVersion: item.graphVersion,
        temporalWorkflowId: item.runId,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        status: currentStatus ?? item.terminalStatus ?? "UNKNOWN",
        cost: null,
        availability: {
          temporal: temporalAvailable,
          rnd: true,
          hubAudit: false,
          trigger: triggerAvailable,
        },
      });
    }),
  );
}

export async function getRunProjection(
  deps: RunProjectionDependencies,
  operationId: OperationId,
): Promise<RunProjection | null> {
  let traces: TraceRecord[];
  try {
    traces = await tracesFor(deps.options, operationId);
  } catch {
    return null;
  }
  const evidence = evidenceFromTraces(operationId, traces);
  if (evidence === null) return null;

  let temporalAvailable = false;
  let currentStatus: RunStatus | null = null;
  let output: unknown = null;
  const errors: string[] = [];
  try {
    const described = await deps.temporal.describe(evidence.runId as never);
    temporalAvailable = true;
    currentStatus = temporalStatus(described.status);
    if (deps.temporal.graphState !== undefined) {
      try {
        const state = await deps.temporal.graphState(evidence.runId as never);
        output = state.output;
        if (state.error !== null) errors.push(state.error);
        if (state.status === "RUNNING" && state.nodes.some((node) =>
          node.status === "WAITING_APPROVAL" || node.status === "WAITING_INPUT"
        )) {
          currentStatus = "WAITING";
        }
      } catch {
        // Temporal describe is still valid owner evidence when query state is unavailable.
      }
    }
  } catch {
    temporalAvailable = false;
  }

  const failedTrace = [...traces]
    .reverse()
    .find((trace) => trace.name === "flow.graph.run.failed");
  const traceError = failedTrace?.attributes.error;
  if (typeof traceError === "string" && !errors.includes(traceError)) errors.push(traceError);

  let actions: AuditEvent[] = [];
  let hubAuditAvailable = false;
  try {
    actions = await auditFor(deps.options, operationId);
    hubAuditAvailable = true;
  } catch {
    hubAuditAvailable = false;
  }

  let cost: TraceSummary | null = null;
  try {
    cost = await httpJson<TraceSummary>(
      `${deps.options.rndUrl}/v1/traces/summary?operationId=${encodeURIComponent(operationId)}`,
      { token: deps.options.token },
    );
  } catch {
    cost = null;
  }

  const triggerAvailable =
    evidence.triggerId === null || deps.triggers.get(evidence.triggerId as never) !== null;

  return RunProjectionSchema.parse({
    operationId,
    workspaceId: evidence.workspaceId,
    projectId: evidence.projectId,
    triggerId: evidence.triggerId,
    graphId: evidence.graphId,
    graphVersion: evidence.graphVersion,
    temporalWorkflowId: evidence.runId,
    startedAt: evidence.startedAt,
    finishedAt: evidence.finishedAt,
    status: currentStatus ?? evidence.terminalStatus ?? "UNKNOWN",
    cost,
    approvals: approvalsFromAudit(actions),
    actions,
    output,
    errors,
    availability: {
      temporal: temporalAvailable,
      rnd: true,
      hubAudit: hubAuditAvailable,
      trigger: triggerAvailable,
    },
  });
}
