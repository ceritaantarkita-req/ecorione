/**
 * Lapisan akses data Hub — audit log append-only + durable state approval gate
 * (`docs/api-fase1.md` §Hub, `prd.md` §22).
 */

import {
  makeId,
  type ActionRequest,
  type ApprovalDecision,
  type AuditEvent,
  type AuditEventType,
  type EventId,
  type ModuleName,
  type OperationId,
  type Timestamp,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface RecordAuditEventInput {
  readonly type: AuditEventType;
  readonly operationId: OperationId | null;
  readonly module: ModuleName;
  readonly detail: Record<string, unknown>;
  readonly ruleId?: string | null | undefined;
  readonly now: Timestamp;
}

interface AuditEventRow {
  id: string;
  ts: string;
  type: string;
  operation_id: string | null;
  module: string;
  detail: string;
  rule_id: string | null;
}

function rowToAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id as EventId,
    ts: row.ts,
    type: row.type as AuditEventType,
    operationId: row.operation_id as OperationId | null,
    module: row.module as ModuleName,
    detail: JSON.parse(row.detail) as Record<string, unknown>,
    ruleId: row.rule_id,
  };
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export const APPROVAL_STATUSES = ["PENDING", "APPROVE", "EDIT", "REJECT", "RESPOND"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface CreateApprovalInput {
  readonly operationId: OperationId;
  readonly actionRequest: ActionRequest;
  readonly prompt: string;
  readonly now: Timestamp;
}

export interface Approval {
  readonly operationId: OperationId;
  readonly actionRequest: ActionRequest;
  readonly status: ApprovalStatus;
  readonly prompt: string;
  readonly note: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: Timestamp | null;
  readonly createdAt: Timestamp;
}

interface ApprovalRow {
  operation_id: string;
  action_request: string;
  status: string;
  prompt: string;
  note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

function rowToApproval(row: ApprovalRow): Approval {
  return {
    operationId: row.operation_id as OperationId,
    actionRequest: JSON.parse(row.action_request) as ActionRequest,
    status: row.status as ApprovalStatus,
    prompt: row.prompt,
    note: row.note,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at as Timestamp | null,
    createdAt: row.created_at as Timestamp,
  };
}

export class ApprovalNotFoundError extends Error {
  constructor(operationId: string) {
    super(`Approval tidak ditemukan: ${operationId}.`);
    this.name = "ApprovalNotFoundError";
  }
}

export class ApprovalAlreadyDecidedError extends Error {
  constructor(operationId: string, status: string) {
    super(`Approval ${operationId} sudah diputuskan sebelumnya (status: ${status}).`);
    this.name = "ApprovalAlreadyDecidedError";
  }
}

/**
 * `RESPOND` **tidak boleh** dipakai untuk aksi bergerbang yang punya efek samping — itu
 * memberi sinyal sukses palsu ke model (gotcha terdokumentasi di `shared-schema/policy.ts`).
 * Fase 1 hanya membuat approval untuk aksi yang memang punya efek samping (`ALWAYS_GATED`),
 * jadi gerbang ini berlaku di titik keputusan, bukan cuma didokumentasikan.
 */
export class RespondNotAllowedError extends Error {
  constructor() {
    super(
      'Decision "RESPOND" tidak boleh dipakai untuk approval aksi bergerbang efek-samping ' +
        "— itu memberi sinyal sukses palsu. Pakai REJECT untuk menolak.",
    );
    this.name = "RespondNotAllowedError";
  }
}

export class HubRepository {
  readonly #db: HubDatabase;

  constructor(db: HubDatabase) {
    this.#db = db;
  }

  // --- Audit log -----------------------------------------------------------

  recordAuditEvent(input: RecordAuditEventInput): AuditEvent {
    const id = makeId("event");
    this.#db.raw
      .prepare(
        `INSERT INTO audit_events (id, ts, type, operation_id, module, detail, rule_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.now,
        input.type,
        input.operationId,
        input.module,
        JSON.stringify(input.detail),
        input.ruleId ?? null,
      );

    return {
      id,
      ts: input.now,
      type: input.type,
      operationId: input.operationId,
      module: input.module,
      detail: input.detail,
      ruleId: input.ruleId ?? null,
    };
  }

  listAuditEvents(filter: { readonly operationId?: string | undefined } = {}): AuditEvent[] {
    if (filter.operationId !== undefined) {
      const rows = this.#db.raw
        .prepare("SELECT * FROM audit_events WHERE operation_id = ? ORDER BY ts ASC, rowid ASC")
        .all(filter.operationId) as AuditEventRow[];
      return rows.map(rowToAuditEvent);
    }
    const rows = this.#db.raw
      .prepare("SELECT * FROM audit_events ORDER BY ts ASC, rowid ASC")
      .all() as AuditEventRow[];
    return rows.map(rowToAuditEvent);
  }

  // --- Approvals -------------------------------------------------------------

  createApproval(input: CreateApprovalInput): Approval {
    this.#db.raw
      .prepare(
        `INSERT INTO approvals (operation_id, action_request, status, prompt, note, decided_by, decided_at, created_at)
         VALUES (?, ?, 'PENDING', ?, NULL, NULL, NULL, ?)`,
      )
      .run(input.operationId, JSON.stringify(input.actionRequest), input.prompt, input.now);

    return {
      operationId: input.operationId,
      actionRequest: input.actionRequest,
      status: "PENDING",
      prompt: input.prompt,
      note: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: input.now,
    };
  }

  getApproval(operationId: string): Approval | null {
    const row = this.#db.raw
      .prepare("SELECT * FROM approvals WHERE operation_id = ?")
      .get(operationId) as ApprovalRow | undefined;
    return row === undefined ? null : rowToApproval(row);
  }

  /**
   * `decidedBy` di Fase 1 selalu string tetap (mis. `"user"`) — tidak ada model aktor
   * multi-pengguna di Fase 1, dicatat apa adanya bukan disamarkan.
   */
  decideApproval(
    operationId: string,
    decision: ApprovalDecision,
    decidedBy: string,
    note: string | null,
    now: Timestamp,
  ): Approval {
    const existing = this.getApproval(operationId);
    if (existing === null) throw new ApprovalNotFoundError(operationId);
    if (existing.status !== "PENDING") {
      throw new ApprovalAlreadyDecidedError(operationId, existing.status);
    }
    if (decision === "RESPOND") throw new RespondNotAllowedError();

    this.#db.raw
      .prepare(
        `UPDATE approvals SET status = ?, note = ?, decided_by = ?, decided_at = ?
         WHERE operation_id = ?`,
      )
      .run(decision, note, decidedBy, now, operationId);

    return {
      ...existing,
      status: decision,
      note,
      decidedBy,
      decidedAt: now,
    };
  }
}
