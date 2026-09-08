/** Hub repository: append-only audit, durable approval state, idempotency results. */
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

export interface RecordAuditEventInput {
  readonly type: AuditEventType; readonly operationId: OperationId | null; readonly module: ModuleName;
  readonly detail: Record<string, unknown>; readonly ruleId?: string | null | undefined; readonly now: Timestamp;
}
interface AuditEventRow { id: string; ts: string; type: string; operation_id: string | null; module: string; detail: string; rule_id: string | null; }
function rowToAuditEvent(row: AuditEventRow): AuditEvent {
  return { id: row.id as EventId, ts: row.ts, type: row.type as AuditEventType, operationId: row.operation_id as OperationId | null,
    module: row.module as ModuleName, detail: JSON.parse(row.detail) as Record<string, unknown>, ruleId: row.rule_id };
}

export const APPROVAL_STATUSES = ["PENDING", "APPROVE", "EDIT", "REJECT", "RESPOND"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export interface CreateApprovalInput { readonly operationId: OperationId; readonly actionRequest: ActionRequest; readonly prompt: string; readonly now: Timestamp; }
export interface Approval {
  readonly operationId: OperationId; readonly actionRequest: ActionRequest; readonly status: ApprovalStatus; readonly prompt: string;
  readonly note: string | null; readonly decidedBy: string | null; readonly decidedAt: Timestamp | null; readonly createdAt: Timestamp;
}
interface ApprovalRow { operation_id: string; action_request: string; status: string; prompt: string; note: string | null; decided_by: string | null; decided_at: string | null; created_at: string; }
function rowToApproval(row: ApprovalRow): Approval {
  return { operationId: row.operation_id as OperationId, actionRequest: JSON.parse(row.action_request) as ActionRequest,
    status: row.status as ApprovalStatus, prompt: row.prompt, note: row.note, decidedBy: row.decided_by,
    decidedAt: row.decided_at as Timestamp | null, createdAt: row.created_at as Timestamp };
}
export class ApprovalNotFoundError extends Error { constructor(id: string) { super(`Approval tidak ditemukan: ${id}.`); this.name = "ApprovalNotFoundError"; } }
export class ApprovalAlreadyDecidedError extends Error { constructor(id: string, status: string) { super(`Approval ${id} sudah diputuskan sebelumnya (status: ${status}).`); this.name = "ApprovalAlreadyDecidedError"; } }
export class RespondNotAllowedError extends Error { constructor() { super('Decision "RESPOND" tidak boleh dipakai untuk approval aksi efek-samping. Pakai REJECT.'); this.name = "RespondNotAllowedError"; } }

export interface IdempotentResult<T = unknown> {
  readonly idempotencyKey: string; readonly operationId: OperationId; readonly tool: string; readonly result: T; readonly completedAt: Timestamp;
}
interface IdempotentRow { idempotency_key: string; operation_id: string; tool: string; result_json: string; completed_at: string; }

export class HubRepository {
  constructor(private readonly db: HubDatabase) {}
  recordAuditEvent(input: RecordAuditEventInput): AuditEvent {
    const id = makeId("event");
    this.db.raw.prepare("INSERT INTO audit_events (id,ts,type,operation_id,module,detail,rule_id) VALUES (?,?,?,?,?,?,?)")
      .run(id, input.now, input.type, input.operationId, input.module, JSON.stringify(input.detail), input.ruleId ?? null);
    return { id, ts: input.now, type: input.type, operationId: input.operationId, module: input.module, detail: input.detail, ruleId: input.ruleId ?? null };
  }
  listAuditEvents(filter: { readonly operationId?: string | undefined } = {}): AuditEvent[] {
    const rows = filter.operationId === undefined
      ? this.db.raw.prepare("SELECT * FROM audit_events ORDER BY ts ASC, rowid ASC").all() as AuditEventRow[]
      : this.db.raw.prepare("SELECT * FROM audit_events WHERE operation_id=? ORDER BY ts ASC, rowid ASC").all(filter.operationId) as AuditEventRow[];
    return rows.map(rowToAuditEvent);
  }

  /** Idempotent create: repeated evaluate of the same operation returns the durable row. */
  createApproval(input: CreateApprovalInput): Approval {
    const existing = this.getApproval(input.operationId);
    if (existing !== null) return existing;
    this.db.raw.prepare("INSERT INTO approvals (operation_id,action_request,status,prompt,note,decided_by,decided_at,created_at) VALUES (?,?,'PENDING',?,NULL,NULL,NULL,?)")
      .run(input.operationId, JSON.stringify(input.actionRequest), input.prompt, input.now);
    return { operationId: input.operationId, actionRequest: input.actionRequest, status: "PENDING", prompt: input.prompt, note: null, decidedBy: null, decidedAt: null, createdAt: input.now };
  }
  ensureApproval(input: CreateApprovalInput): Approval { return this.createApproval(input); }
  getApproval(operationId: string): Approval | null {
    const row = this.db.raw.prepare("SELECT * FROM approvals WHERE operation_id=?").get(operationId) as ApprovalRow | undefined;
    return row === undefined ? null : rowToApproval(row);
  }
  decideApproval(operationId: string, decision: ApprovalDecision, decidedBy: string, note: string | null, now: Timestamp): Approval {
    const existing = this.getApproval(operationId);
    if (existing === null) throw new ApprovalNotFoundError(operationId);
    if (existing.status !== "PENDING") throw new ApprovalAlreadyDecidedError(operationId, existing.status);
    if (decision === "RESPOND") throw new RespondNotAllowedError();
    this.db.raw.prepare("UPDATE approvals SET status=?,note=?,decided_by=?,decided_at=? WHERE operation_id=?")
      .run(decision, note, decidedBy, now, operationId);
    return { ...existing, status: decision, note, decidedBy, decidedAt: now };
  }

  getIdempotentResult<T>(key: string): IdempotentResult<T> | null {
    const row = this.db.raw.prepare("SELECT * FROM idempotent_results WHERE idempotency_key=?").get(key) as IdempotentRow | undefined;
    if (row === undefined) return null;
    return { idempotencyKey: row.idempotency_key, operationId: row.operation_id as OperationId, tool: row.tool,
      result: JSON.parse(row.result_json) as T, completedAt: row.completed_at as Timestamp };
  }
  saveIdempotentResult<T>(key: string, operationId: OperationId, tool: string, result: T, now: Timestamp): IdempotentResult<T> {
    this.db.raw.prepare("INSERT INTO idempotent_results (idempotency_key,operation_id,tool,result_json,completed_at) VALUES (?,?,?,?,?)")
      .run(key, operationId, tool, JSON.stringify(result), now);
    return { idempotencyKey: key, operationId, tool, result, completedAt: now };
  }
}
