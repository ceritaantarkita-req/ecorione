import { createHash } from "node:crypto";
import {
  ECX_RETURNED_RESULT_MAX_BYTES,
  EcxRoundTripStatusSchema,
  type EcxAgentId,
  type EcxRoundTripResponse,
  type EcxRoundTripStatus,
  type EcxRuntimeTarget,
  type EventId,
  type OperationId,
  type SessionId,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface RoundTripRow {
  readonly packet_id: string;
  readonly operation_id: string;
  readonly continuation_operation_id: string;
  readonly workspace_id: string;
  readonly sender: string;
  readonly recipient: string;
  readonly response_mode: "delta" | "full";
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

export class EcxRoundTripConflictError extends Error {
  constructor(packetId: EventId) {
    super(`ECX round trip ${packetId} sudah dipakai untuk request berbeda.`);
    this.name = "EcxRoundTripConflictError";
  }
}

export class EcxRoundTripNotFoundError extends Error {
  constructor(packetId: string) {
    super(`ECX round trip tidak ditemukan: ${packetId}.`);
    this.name = "EcxRoundTripNotFoundError";
  }
}

function resultEvidenceFromRow(
  row: RoundTripRow,
): { replyBytes: number; replySha256: string } | null {
  if (row.result_json === null) return null;
  try {
    const parsed = JSON.parse(row.result_json) as {
      returnedResult?: { evidence?: { replyBytes?: unknown; replySha256?: unknown } };
      child?: { completion?: { reply?: unknown } };
    };
    const evidence = parsed.returnedResult?.evidence;
    if (
      typeof evidence?.replyBytes === "number" &&
      evidence.replyBytes >= 0 &&
      evidence.replyBytes <= ECX_RETURNED_RESULT_MAX_BYTES &&
      typeof evidence.replySha256 === "string" &&
      /^[a-f0-9]{64}$/.test(evidence.replySha256)
    ) {
      return {
        replyBytes: evidence.replyBytes,
        replySha256: evidence.replySha256,
      };
    }
    const reply = parsed.child?.completion?.reply;
    if (typeof reply !== "string") return null;
    const replyBytes = Buffer.byteLength(reply, "utf8");
    if (replyBytes > ECX_RETURNED_RESULT_MAX_BYTES) return null;
    return {
      replyBytes,
      replySha256: createHash("sha256").update(reply, "utf8").digest("hex"),
    };
  } catch {
    return null;
  }
}

function statusFromRow(row: RoundTripRow): EcxRoundTripStatus {
  return EcxRoundTripStatusSchema.parse({
    packetId: row.packet_id,
    operationId: row.operation_id,
    continuationOperationId: row.continuation_operation_id,
    workspaceId: row.workspace_id,
    sender: row.sender,
    recipient: row.recipient,
    responseMode: row.response_mode,
    parentTarget: row.parent_target,
    historySessionId: row.history_session_id,
    state: row.state,
    error: row.error,
    resultAvailable: row.result_json !== null,
    resultEvidence: resultEvidenceFromRow(row),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}

export class EcxRoundTripStore {
  constructor(private readonly db: HubDatabase) {}

  begin(input: {
    packetId: EventId;
    operationId: OperationId;
    continuationOperationId: OperationId;
    workspaceId: WorkspaceId;
    sender: EcxAgentId;
    recipient: EcxAgentId;
    responseMode: "delta" | "full";
    parentTarget: EcxRuntimeTarget;
    historySessionId: SessionId | null;
    fingerprint: string;
    now: Timestamp;
  }): {
    status: EcxRoundTripStatus;
    priorResult: EcxRoundTripResponse | null;
    created: boolean;
  } {
    const existing = this.row(input.packetId);
    if (existing !== null) {
      this.assertSame(existing, input);
      return {
        status: statusFromRow(existing),
        priorResult:
          existing.result_json === null
            ? null
            : (JSON.parse(existing.result_json) as EcxRoundTripResponse),
        created: false,
      };
    }

    this.db.raw
      .prepare(
        `INSERT INTO ecx_round_trip_receipts(
          packet_id,operation_id,continuation_operation_id,workspace_id,sender,recipient,
          response_mode,parent_target,history_session_id,fingerprint,state,error,result_json,
          started_at,updated_at,completed_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,'STARTED',NULL,NULL,?,?,NULL)`,
      )
      .run(
        input.packetId,
        input.operationId,
        input.continuationOperationId,
        input.workspaceId,
        input.sender,
        input.recipient,
        input.responseMode,
        input.parentTarget,
        input.historySessionId,
        input.fingerprint,
        input.now,
        input.now,
      );
    return { status: this.get(input.packetId), priorResult: null, created: true };
  }

  claimContinuation(packetId: EventId, now: Timestamp): boolean {
    const result = this.db.raw
      .prepare(
        `UPDATE ecx_round_trip_receipts
         SET state='UNCERTAIN',error='Parent continuation dispatch outcome pending.',updated_at=?
         WHERE packet_id=? AND state='STARTED'`,
      )
      .run(now, packetId);
    return result.changes === 1;
  }

  succeed(
    packetId: EventId,
    response: EcxRoundTripResponse,
    now: Timestamp,
  ): EcxRoundTripStatus {
    this.require(packetId);
    this.db.raw
      .prepare(
        `UPDATE ecx_round_trip_receipts
         SET state='SUCCEEDED',error=NULL,result_json=?,updated_at=?,completed_at=?
         WHERE packet_id=?`,
      )
      .run(JSON.stringify(response), now, now, packetId);
    return this.get(packetId);
  }

  fail(packetId: EventId, error: string, now: Timestamp): EcxRoundTripStatus {
    this.require(packetId);
    this.db.raw
      .prepare(
        `UPDATE ecx_round_trip_receipts
         SET state='FAILED',error=?,updated_at=?,completed_at=?
         WHERE packet_id=? AND state<>'SUCCEEDED'`,
      )
      .run(error.slice(0, 1024), now, now, packetId);
    return this.get(packetId);
  }

  noteUncertain(packetId: EventId, error: string, now: Timestamp): EcxRoundTripStatus {
    this.require(packetId);
    this.db.raw
      .prepare(
        `UPDATE ecx_round_trip_receipts
         SET state='UNCERTAIN',error=?,updated_at=?
         WHERE packet_id=? AND state<>'SUCCEEDED'`,
      )
      .run(error.slice(0, 1024), now, packetId);
    return this.get(packetId);
  }

  get(packetId: EventId, workspaceId?: WorkspaceId): EcxRoundTripStatus {
    const row = this.require(packetId);
    if (workspaceId !== undefined && row.workspace_id !== workspaceId) {
      throw new EcxRoundTripNotFoundError(packetId);
    }
    return statusFromRow(row);
  }

  result(packetId: EventId): EcxRoundTripResponse | null {
    const row = this.require(packetId);
    return row.result_json === null
      ? null
      : (JSON.parse(row.result_json) as EcxRoundTripResponse);
  }

  private assertSame(
    row: RoundTripRow,
    input: {
      packetId: EventId;
      operationId: OperationId;
      continuationOperationId: OperationId;
      workspaceId: WorkspaceId;
      sender: EcxAgentId;
      recipient: EcxAgentId;
      responseMode: "delta" | "full";
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
      row.recipient !== input.recipient ||
      row.response_mode !== input.responseMode ||
      row.parent_target !== input.parentTarget ||
      row.history_session_id !== input.historySessionId
    ) {
      throw new EcxRoundTripConflictError(input.packetId);
    }
  }

  private row(packetId: EventId): RoundTripRow | null {
    const row = this.db.raw
      .prepare("SELECT * FROM ecx_round_trip_receipts WHERE packet_id=?")
      .get(packetId) as RoundTripRow | undefined;
    return row ?? null;
  }

  private require(packetId: EventId): RoundTripRow {
    const row = this.row(packetId);
    if (row === null) throw new EcxRoundTripNotFoundError(packetId);
    return row;
  }
}
