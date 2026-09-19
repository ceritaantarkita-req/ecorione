import {
  TriggerDefinitionSchema,
  TriggerFireResponseSchema,
  makeId,
  type ProjectId,
  type Timestamp,
  type TriggerCreateRequest,
  type TriggerDefinition,
  type TriggerFireResponse,
  type TriggerId,
  type TriggerUpdateRequest,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { FlowDatabase } from "./db.js";

interface TriggerRow {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  kind: "manual" | "time" | "event" | "webhook";
  graph_id: string;
  graph_version: number;
  version_policy: "PINNED";
  requested_autonomy: "L0" | "L1" | "L2" | "L3";
  enabled: number;
  configuration_json: string;
  temporal_schedule_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}
interface ManualFireRow {
  trigger_id: string;
  request_id: string;
  workflow_id: string;
  operation_id: string;
  graph_id: string;
  graph_version: number;
  created_at: string;
}

interface EventDeliveryRow {
  trigger_id: string;
  dedupe_key: string;
  event_id: string;
  event_digest: string;
  state: "PENDING" | "STARTED";
  workflow_id: string;
  operation_id: string;
  graph_id: string;
  graph_version: number;
  created_at: string;
}

export interface EventDeliveryReservation {
  readonly response: TriggerFireResponse;
  readonly state: "PENDING" | "STARTED";
  readonly deduplicated: boolean;
}

export class TriggerNotFoundError extends Error {
  constructor(id: string) {
    super(`Trigger tidak ditemukan: ${id}.`);
    this.name = "TriggerNotFoundError";
  }
}
export class TriggerRevisionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`Revision Trigger stale: expected ${String(expected)}, current ${String(actual)}.`);
    this.name = "TriggerRevisionConflictError";
  }
}
export class TriggerWorkspaceConflictError extends Error {
  constructor() {
    super("workspaceId Trigger tidak boleh berubah.");
    this.name = "TriggerWorkspaceConflictError";
  }
}
export class TriggerProjectConflictError extends Error {
  constructor() {
    super("projectId Trigger tidak boleh berubah.");
    this.name = "TriggerProjectConflictError";
  }
}
export class TriggerKindConflictError extends Error {
  constructor() {
    super("kind Trigger tidak boleh berubah.");
    this.name = "TriggerKindConflictError";
  }
}

export class TriggerEventDedupeConflictError extends Error {
  constructor() {
    super("dedupeKey Trigger sudah dipakai oleh event yang berbeda.");
    this.name = "TriggerEventDedupeConflictError";
  }
}

export class TriggerWebhookHookConflictError extends Error {
  constructor(hookId: string) {
    super(`hookId webhook sudah dipakai Trigger lain: ${hookId}.`);
    this.name = "TriggerWebhookHookConflictError";
  }
}

function scheduleId(triggerId: string): string {
  return `ecorione-trigger-${triggerId}`;
}

function fromRow(row: TriggerRow): TriggerDefinition {
  return TriggerDefinitionSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    kind: row.kind,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    versionPolicy: row.version_policy,
    requestedAutonomy: row.requested_autonomy,
    enabled: row.enabled === 1,
    configuration: JSON.parse(row.configuration_json) as unknown,
    temporalScheduleId: row.temporal_schedule_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function fireFromRow(
  row: ManualFireRow | EventDeliveryRow,
  deduplicated: boolean,
): TriggerFireResponse {
  return TriggerFireResponseSchema.parse({
    triggerId: row.trigger_id,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    workflowId: row.workflow_id,
    operationId: row.operation_id,
    deduplicated,
  });
}

export class TriggerRepository {
  constructor(readonly db: FlowDatabase) {}

  list(workspaceId?: WorkspaceId, projectId?: ProjectId): TriggerDefinition[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (workspaceId !== undefined) {
      clauses.push("workspace_id=?");
      params.push(workspaceId);
    }
    if (projectId !== undefined) {
      clauses.push("project_id=?");
      params.push(projectId);
    }
    const where = clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`;
    return (
      this.db.raw
        .prepare(`SELECT * FROM triggers ${where} ORDER BY updated_at DESC,id ASC`)
        .all(...params) as TriggerRow[]
    ).map(fromRow);
  }

  get(id: TriggerId): TriggerDefinition | null {
    const row = this.db.raw.prepare("SELECT * FROM triggers WHERE id=?").get(id) as
      TriggerRow | undefined;
    return row === undefined ? null : fromRow(row);
  }

  require(id: TriggerId): TriggerDefinition {
    const trigger = this.get(id);
    if (trigger === null) throw new TriggerNotFoundError(id);
    return trigger;
  }

  findWebhookByHookId(hookId: string): TriggerDefinition | null {
    const rows = this.db.raw
      .prepare("SELECT * FROM triggers WHERE kind='webhook' ORDER BY id ASC")
      .all() as TriggerRow[];
    for (const row of rows) {
      const trigger = fromRow(row);
      if (
        trigger.kind === "webhook" &&
        (trigger.configuration as { hookId?: string }).hookId === hookId
      ) {
        return trigger;
      }
    }
    return null;
  }

  create(input: TriggerCreateRequest, now: Timestamp): TriggerDefinition {
    const id = makeId("trigger");
    if (input.kind === "webhook") {
      const hookId = (input.configuration as { hookId: string }).hookId;
      if (this.findWebhookByHookId(hookId) !== null) {
        throw new TriggerWebhookHookConflictError(hookId);
      }
    }
    const temporalScheduleId = input.kind === "time" ? scheduleId(id) : null;
    this.db.raw
      .prepare(
        `INSERT INTO triggers (
          id,workspace_id,project_id,name,kind,graph_id,graph_version,version_policy,
          requested_autonomy,enabled,configuration_json,temporal_schedule_id,
          revision,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      )
      .run(
        id,
        input.workspaceId,
        input.projectId,
        input.name,
        input.kind,
        input.graphId,
        input.graphVersion,
        input.versionPolicy,
        input.requestedAutonomy,
        input.enabled ? 1 : 0,
        JSON.stringify(input.configuration),
        temporalScheduleId,
        now,
        now,
      );
    return this.require(id);
  }

  update(id: TriggerId, input: TriggerUpdateRequest, now: Timestamp): TriggerDefinition {
    const current = this.require(id);
    if (current.workspaceId !== input.workspaceId) throw new TriggerWorkspaceConflictError();
    if (current.projectId !== input.projectId) throw new TriggerProjectConflictError();
    if (current.kind !== input.kind) throw new TriggerKindConflictError();
    if (input.kind === "webhook") {
      const hookId = (input.configuration as { hookId: string }).hookId;
      const existing = this.findWebhookByHookId(hookId);
      if (existing !== null && existing.id !== id) {
        throw new TriggerWebhookHookConflictError(hookId);
      }
    }
    if (current.revision !== input.expectedRevision) {
      throw new TriggerRevisionConflictError(input.expectedRevision, current.revision);
    }
    const nextRevision = current.revision + 1;
    const result = this.db.raw
      .prepare(
        `UPDATE triggers
         SET name=?,graph_id=?,graph_version=?,version_policy=?,requested_autonomy=?,
             enabled=?,configuration_json=?,revision=?,updated_at=?
         WHERE id=? AND revision=?`,
      )
      .run(
        input.name,
        input.graphId,
        input.graphVersion,
        input.versionPolicy,
        input.requestedAutonomy,
        input.enabled ? 1 : 0,
        JSON.stringify(input.configuration),
        nextRevision,
        now,
        id,
        input.expectedRevision,
      );
    if (result.changes !== 1) {
      const latest = this.require(id);
      throw new TriggerRevisionConflictError(input.expectedRevision, latest.revision);
    }
    return this.require(id);
  }

  setEnabled(
    id: TriggerId,
    workspaceId: WorkspaceId,
    projectId: ProjectId,
    expectedRevision: number,
    enabled: boolean,
    now: Timestamp,
  ): TriggerDefinition {
    const current = this.require(id);
    if (current.workspaceId !== workspaceId) throw new TriggerWorkspaceConflictError();
    if (current.projectId !== projectId) throw new TriggerProjectConflictError();
    if (current.revision !== expectedRevision) {
      throw new TriggerRevisionConflictError(expectedRevision, current.revision);
    }
    const result = this.db.raw
      .prepare(
        "UPDATE triggers SET enabled=?,revision=?,updated_at=? WHERE id=? AND revision=?",
      )
      .run(enabled ? 1 : 0, current.revision + 1, now, id, expectedRevision);
    if (result.changes !== 1) {
      const latest = this.require(id);
      throw new TriggerRevisionConflictError(expectedRevision, latest.revision);
    }
    return this.require(id);
  }

  getManualFire(triggerId: TriggerId, requestId: string): TriggerFireResponse | null {
    const row = this.db.raw
      .prepare("SELECT * FROM trigger_manual_fires WHERE trigger_id=? AND request_id=?")
      .get(triggerId, requestId) as ManualFireRow | undefined;
    return row === undefined ? null : fireFromRow(row, true);
  }

  recordManualFire(
    triggerId: TriggerId,
    requestId: string,
    response: TriggerFireResponse,
    now: Timestamp,
  ): TriggerFireResponse {
    const inserted = this.db.raw
      .prepare(
        `INSERT OR IGNORE INTO trigger_manual_fires (
          trigger_id,request_id,workflow_id,operation_id,graph_id,graph_version,created_at
        ) VALUES (?,?,?,?,?,?,?)`,
      )
      .run(
        triggerId,
        requestId,
        response.workflowId,
        response.operationId,
        response.graphId,
        response.graphVersion,
        now,
      );
    const row = this.db.raw
      .prepare("SELECT * FROM trigger_manual_fires WHERE trigger_id=? AND request_id=?")
      .get(triggerId, requestId) as ManualFireRow | undefined;
    return row === undefined ? response : fireFromRow(row, inserted.changes === 0);
  }

  reserveEventDelivery(
    triggerId: TriggerId,
    dedupeKey: string,
    eventId: string,
    eventDigest: string,
    response: TriggerFireResponse,
    now: Timestamp,
  ): EventDeliveryReservation {
    const inserted = this.db.raw
      .prepare(
        `INSERT OR IGNORE INTO trigger_event_deliveries (
          trigger_id,dedupe_key,event_id,event_digest,state,workflow_id,operation_id,
          graph_id,graph_version,created_at
        ) VALUES (?,?,?,?,'PENDING',?,?,?,?,?)`,
      )
      .run(
        triggerId,
        dedupeKey,
        eventId,
        eventDigest,
        response.workflowId,
        response.operationId,
        response.graphId,
        response.graphVersion,
        now,
      );
    const row = this.db.raw
      .prepare("SELECT * FROM trigger_event_deliveries WHERE trigger_id=? AND dedupe_key=?")
      .get(triggerId, dedupeKey) as EventDeliveryRow | undefined;
    if (row === undefined) {
      throw new Error("Event delivery reservation gagal dibaca kembali.");
    }
    if (row.event_digest !== eventDigest || row.event_id !== eventId) {
      throw new TriggerEventDedupeConflictError();
    }
    const deduplicated = inserted.changes === 0;
    return {
      response: fireFromRow(row, deduplicated),
      state: row.state,
      deduplicated,
    };
  }

  markEventDeliveryStarted(triggerId: TriggerId, dedupeKey: string, eventDigest: string): void {
    const result = this.db.raw
      .prepare(
        `UPDATE trigger_event_deliveries
         SET state='STARTED'
         WHERE trigger_id=? AND dedupe_key=? AND event_digest=?`,
      )
      .run(triggerId, dedupeKey, eventDigest);
    if (result.changes !== 1) {
      const row = this.db.raw
        .prepare("SELECT * FROM trigger_event_deliveries WHERE trigger_id=? AND dedupe_key=?")
        .get(triggerId, dedupeKey) as EventDeliveryRow | undefined;
      if (row === undefined || row.event_digest !== eventDigest) {
        throw new TriggerEventDedupeConflictError();
      }
      if (row.state !== "STARTED") {
        throw new Error("Event delivery tidak dapat ditandai STARTED.");
      }
    }
  }
}
