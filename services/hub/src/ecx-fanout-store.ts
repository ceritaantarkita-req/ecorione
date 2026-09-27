import {
  EcxFanoutRoundTripResponseSchema,
  EcxFanoutStatusSchema,
  type EcxAgentId,
  type EcxFanoutAggregateEvidence,
  type EcxFanoutRoundTripResponse,
  type EcxFanoutStatus,
  type EcxRuntimeTarget,
  type EventId,
  type OperationId,
  type SessionId,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface FanoutRow {
  readonly fanout_id: string;
  readonly operation_id: string;
  readonly continuation_operation_id: string;
  readonly workspace_id: string;
  readonly sender: string;
  readonly recipients_json: string;
  readonly parent_target: "local" | "hosted";
  readonly history_session_id: string | null;
  readonly fingerprint: string;
  readonly state: "STARTED" | "SUCCEEDED" | "FAILED" | "UNCERTAIN";
  readonly error: string | null;
  readonly result_json: string | null;
  readonly started_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

export class EcxFanoutConflictError extends Error {
  constructor(fanoutId: EventId) {
    super(`ECX fan-out ${fanoutId} sudah dipakai untuk request berbeda.`);
    this.name = "EcxFanoutConflictError";
  }
}

export class EcxFanoutNotFoundError extends Error {
  constructor(fanoutId: string) {
    super(`ECX fan-out tidak ditemukan: ${fanoutId}.`);
    this.name = "EcxFanoutNotFoundError";
  }
}

function parsedResult(row: FanoutRow): EcxFanoutRoundTripResponse | null {
  if (row.result_json === null) return null;
  return EcxFanoutRoundTripResponseSchema.parse(JSON.parse(row.result_json) as unknown);
}

function aggregateEvidence(row: FanoutRow): EcxFanoutAggregateEvidence | null {
  return parsedResult(row)?.aggregateEvidence ?? null;
}

function statusFromRow(row: FanoutRow): EcxFanoutStatus {
  return EcxFanoutStatusSchema.parse({
    fanoutId: row.fanout_id,
    operationId: row.operation_id,
    continuationOperationId: row.continuation_operation_id,
    workspaceId: row.workspace_id,
    sender: row.sender,
    recipients: JSON.parse(row.recipients_json) as unknown,
    parentTarget: row.parent_target,
    historySessionId: row.history_session_id,
    state: row.state,
    error: row.error,
    resultAvailable: row.result_json !== null,
    aggregateEvidence: aggregateEvidence(row),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}

export class EcxFanoutStore {
  constructor(private readonly db: HubDatabase) {}

  begin(input: {
    fanoutId: EventId;
    operationId: OperationId;
    continuationOperationId: OperationId;
    workspaceId: WorkspaceId;
    sender: EcxAgentId;
    recipients: readonly EcxAgentId[];
    parentTarget: EcxRuntimeTarget;
    historySessionId: SessionId | null;
    fingerprint: string;
    now: Timestamp;
  }): {
    status: EcxFanoutStatus;
    priorResult: EcxFanoutRoundTripResponse | null;
    created: boolean;
  } {
    const existing = this.row(input.fanoutId);
    if (existing !== null) {
      this.assertSame(existing, input);
      return {
        status: statusFromRow(existing),
        priorResult: parsedResult(existing),
        created: false,
      };
    }

    this.db.raw
      .prepare(
        `INSERT INTO ecx_fanout_receipts(
          fanout_id,operation_id,continuation_operation_id,workspace_id,sender,recipients_json,
          parent_target,history_session_id,fingerprint,state,error,result_json,
          started_at,updated_at,completed_at
        ) VALUES(?,?,?,?,?,?,?,?,?,'STARTED',NULL,NULL,?,?,NULL)`,
      )
      .run(
        input.fanoutId,
        input.operationId,
        input.continuationOperationId,
        input.workspaceId,
        input.sender,
        JSON.stringify(input.recipients),
        input.parentTarget,
        input.historySessionId,
        input.fingerprint,
        input.now,
        input.now,
      );

    return { status: this.get(input.fanoutId), priorResult: null, created: true };
  }

  claimContinuation(fanoutId: EventId, now: Timestamp): boolean {
    const result = this.db.raw
      .prepare(
        `UPDATE ecx_fanout_receipts
         SET state='UNCERTAIN',error='Fan-out parent continuation dispatch outcome pending.',updated_at=?
         WHERE fanout_id=? AND state='STARTED'`,
      )
      .run(now, fanoutId);
    return result.changes === 1;
  }

  succeed(
    fanoutId: EventId,
    response: EcxFanoutRoundTripResponse,
    now: Timestamp,
  ): EcxFanoutStatus {
    this.require(fanoutId);
    this.db.raw
      .prepare(
        `UPDATE ecx_fanout_receipts
         SET state='SUCCEEDED',error=NULL,result_json=?,updated_at=?,completed_at=?
         WHERE fanout_id=?`,
      )
      .run(JSON.stringify(response), now, now, fanoutId);
    return this.get(fanoutId);
  }

  fail(fanoutId: EventId, error: string, now: Timestamp): EcxFanoutStatus {
    this.require(fanoutId);
    this.db.raw
      .prepare(
        `UPDATE ecx_fanout_receipts
         SET state='FAILED',error=?,updated_at=?,completed_at=?
         WHERE fanout_id=? AND state<>'SUCCEEDED'`,
      )
      .run(error.slice(0, 1024), now, now, fanoutId);
    return this.get(fanoutId);
  }

  noteUncertain(fanoutId: EventId, error: string, now: Timestamp): EcxFanoutStatus {
    this.require(fanoutId);
    this.db.raw
      .prepare(
        `UPDATE ecx_fanout_receipts
         SET state='UNCERTAIN',error=?,updated_at=?
         WHERE fanout_id=? AND state<>'SUCCEEDED'`,
      )
      .run(error.slice(0, 1024), now, fanoutId);
    return this.get(fanoutId);
  }

  get(fanoutId: EventId, workspaceId?: WorkspaceId): EcxFanoutStatus {
    const row = this.require(fanoutId);
    if (workspaceId !== undefined && row.workspace_id !== workspaceId) {
      throw new EcxFanoutNotFoundError(fanoutId);
    }
    return statusFromRow(row);
  }

  result(fanoutId: EventId): EcxFanoutRoundTripResponse | null {
    return parsedResult(this.require(fanoutId));
  }

  private assertSame(
    row: FanoutRow,
    input: {
      fanoutId: EventId;
      operationId: OperationId;
      continuationOperationId: OperationId;
      workspaceId: WorkspaceId;
      sender: EcxAgentId;
      recipients: readonly EcxAgentId[];
      parentTarget: EcxRuntimeTarget;
      historySessionId: SessionId | null;
      fingerprint: string;
    },
  ): void {
    if (
      row.fingerprint !== input.fingerprint ||
      row.operation_id !== input.operationId ||
      row.continuation_operation_id !== input.continuationOperationId ||
      row.workspace_id !== input.workspaceId ||
      row.sender !== input.sender ||
      row.recipients_json !== JSON.stringify(input.recipients) ||
      row.parent_target !== input.parentTarget ||
      row.history_session_id !== input.historySessionId
    ) {
      throw new EcxFanoutConflictError(input.fanoutId);
    }
  }

  private row(fanoutId: EventId): FanoutRow | null {
    return (
      (this.db.raw
        .prepare(
          `SELECT
            fanout_id,operation_id,continuation_operation_id,workspace_id,sender,recipients_json,
            parent_target,history_session_id,fingerprint,state,error,result_json,
            started_at,updated_at,completed_at
           FROM ecx_fanout_receipts WHERE fanout_id=?`,
        )
        .get(fanoutId) as FanoutRow | undefined) ?? null
    );
  }

  private require(fanoutId: EventId): FanoutRow {
    const row = this.row(fanoutId);
    if (row === null) throw new EcxFanoutNotFoundError(fanoutId);
    return row;
  }
}
