import {
  EcxExecutionStatusSchema,
  type EcxAgentId,
  type EcxExecuteResponse,
  type EcxExecutionStatus,
  type EcxRuntimeTarget,
  type EventId,
  type OperationId,
  type SessionId,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface ExecutionRow {
  readonly packet_id: string;
  readonly operation_id: string;
  readonly workspace_id: string;
  readonly recipient: string;
  readonly target: "local" | "hosted";
  readonly history_session_id: string | null;
  readonly fingerprint: string;
  readonly state: "STARTED" | "SUCCEEDED" | "FAILED" | "UNCERTAIN";
  readonly hydrated_bytes: number;
  readonly selected_ref_indexes_json: string;
  readonly error: string | null;
  readonly result_json: string | null;
  readonly started_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

export class EcxExecutionConflictError extends Error {
  constructor(packetId: EventId) {
    super(`ECX packet ${packetId} sudah dipakai untuk execution request berbeda.`);
    this.name = "EcxExecutionConflictError";
  }
}

export class EcxExecutionNotFoundError extends Error {
  constructor(packetId: string) {
    super(`ECX execution tidak ditemukan: ${packetId}.`);
    this.name = "EcxExecutionNotFoundError";
  }
}

function statusFromRow(row: ExecutionRow): EcxExecutionStatus {
  return EcxExecutionStatusSchema.parse({
    packetId: row.packet_id,
    operationId: row.operation_id,
    workspaceId: row.workspace_id,
    recipient: row.recipient,
    target: row.target,
    historySessionId: row.history_session_id,
    state: row.state,
    hydratedBytes: row.hydrated_bytes,
    selectedRefIndexes: JSON.parse(row.selected_ref_indexes_json) as unknown,
    error: row.error,
    resultAvailable: row.result_json !== null,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}

export class EcxExecutionStore {
  constructor(private readonly db: HubDatabase) {}

  begin(input: {
    packetId: EventId;
    operationId: OperationId;
    workspaceId: WorkspaceId;
    recipient: EcxAgentId;
    target: EcxRuntimeTarget;
    historySessionId: SessionId | null;
    fingerprint: string;
    hydratedBytes: number;
    selectedRefIndexes: readonly number[];
    now: Timestamp;
  }): {
    status: EcxExecutionStatus;
    priorResult: EcxExecuteResponse | null;
    created: boolean;
  } {
    const existing = this.row(input.packetId);
    if (existing !== null) {
      if (
        existing.fingerprint !== input.fingerprint ||
        existing.operation_id !== input.operationId ||
        existing.workspace_id !== input.workspaceId
      ) {
        throw new EcxExecutionConflictError(input.packetId);
      }
      return {
        status: statusFromRow(existing),
        priorResult:
          existing.result_json === null
            ? null
            : (JSON.parse(existing.result_json) as EcxExecuteResponse),
        created: false,
      };
    }

    this.db.raw
      .prepare(
        `INSERT INTO ecx_execution_receipts(
          packet_id,operation_id,workspace_id,recipient,target,history_session_id,fingerprint,
          state,hydrated_bytes,selected_ref_indexes_json,error,result_json,
          started_at,updated_at,completed_at
        ) VALUES(?,?,?,?,?,?,?,'STARTED',?,?,NULL,NULL,?,?,NULL)`,
      )
      .run(
        input.packetId,
        input.operationId,
        input.workspaceId,
        input.recipient,
        input.target,
        input.historySessionId,
        input.fingerprint,
        input.hydratedBytes,
        JSON.stringify(input.selectedRefIndexes),
        input.now,
        input.now,
      );
    return { status: this.get(input.packetId), priorResult: null, created: true };
  }

  claimDispatch(packetId: EventId, now: Timestamp): boolean {
    const result = this.db.raw
      .prepare(
        `UPDATE ecx_execution_receipts
         SET state='UNCERTAIN',error='Provider dispatch outcome pending.',updated_at=?
         WHERE packet_id=? AND state='STARTED'`,
      )
      .run(now, packetId);
    return result.changes === 1;
  }

  succeed(
    packetId: EventId,
    response: EcxExecuteResponse,
    now: Timestamp,
  ): EcxExecutionStatus {
    this.require(packetId);
    this.db.raw
      .prepare(
        `UPDATE ecx_execution_receipts
         SET state='SUCCEEDED',error=NULL,result_json=?,updated_at=?,completed_at=?
         WHERE packet_id=?`,
      )
      .run(JSON.stringify(response), now, now, packetId);
    return this.get(packetId);
  }

  fail(packetId: EventId, error: string, now: Timestamp): EcxExecutionStatus {
    this.require(packetId);
    this.db.raw
      .prepare(
        `UPDATE ecx_execution_receipts
         SET state='FAILED',error=?,updated_at=?,completed_at=?
         WHERE packet_id=? AND state<>'SUCCEEDED'`,
      )
      .run(error.slice(0, 1024), now, now, packetId);
    return this.get(packetId);
  }

  noteUncertain(packetId: EventId, error: string, now: Timestamp): EcxExecutionStatus {
    this.require(packetId);
    this.db.raw
      .prepare(
        `UPDATE ecx_execution_receipts
         SET state='UNCERTAIN',error=?,updated_at=?
         WHERE packet_id=? AND state<>'SUCCEEDED'`,
      )
      .run(error.slice(0, 1024), now, packetId);
    return this.get(packetId);
  }

  get(packetId: EventId, workspaceId?: WorkspaceId): EcxExecutionStatus {
    const row = this.require(packetId);
    if (workspaceId !== undefined && row.workspace_id !== workspaceId) {
      throw new EcxExecutionNotFoundError(packetId);
    }
    return statusFromRow(row);
  }

  result(packetId: EventId): EcxExecuteResponse | null {
    const row = this.require(packetId);
    return row.result_json === null
      ? null
      : (JSON.parse(row.result_json) as EcxExecuteResponse);
  }

  private row(packetId: EventId): ExecutionRow | null {
    const row = this.db.raw
      .prepare("SELECT * FROM ecx_execution_receipts WHERE packet_id=?")
      .get(packetId) as ExecutionRow | undefined;
    return row ?? null;
  }

  private require(packetId: EventId): ExecutionRow {
    const row = this.row(packetId);
    if (row === null) throw new EcxExecutionNotFoundError(packetId);
    return row;
  }
}
