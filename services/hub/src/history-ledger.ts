import { createHash } from "node:crypto";
import {
  HistoryEventSchema,
  HistorySessionSchema,
  maySendToHosted,
  sensitivityRank,
  type HistoryEvent,
  type HistoryEventDraft,
  type HistoryGrant,
  type HistoryRange,
  type HistorySession,
  type Scope,
  type Sensitivity,
  type SessionId,
  type SyncClass,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface SessionRow {
  id: string;
  created_at: string;
  scope: string;
  sensitivity: string;
  sync_class: string;
  next_seq: number;
  head_hash: string | null;
}
interface EventRow {
  id: string;
  session_id: string;
  seq: number;
  recorded_at: string;
  event_type: string;
  actor: string;
  operation_id: string | null;
  parent_event_id: string | null;
  payload_json: string;
  prev_hash: string | null;
  hash: string;
}

export class HistorySessionNotFoundError extends Error {
  constructor(id: string) {
    super(`History session tidak ditemukan: ${id}.`);
    this.name = "HistorySessionNotFoundError";
  }
}
export class HistorySessionConflictError extends Error {
  constructor(id: string) {
    super(`History session ${id} sudah ada dengan klasifikasi berbeda.`);
    this.name = "HistorySessionConflictError";
  }
}
export class HistorySequenceConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`History seq conflict: expected ${String(expected)}, actual ${String(actual)}.`);
    this.name = "HistorySequenceConflictError";
  }
}
export class HistoryEventConflictError extends Error {
  constructor(id: string) {
    super(`History event ${id} sudah ada dengan payload berbeda.`);
    this.name = "HistoryEventConflictError";
  }
}
export class HistoryIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryIntegrityError";
  }
}
export class HistoryAccessDeniedError extends Error {
  constructor() {
    super("History range tidak tersedia untuk grant ini.");
    this.name = "HistoryAccessDeniedError";
  }
}
export class HistoryPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryPayloadError";
  }
}

function normalizeJson(value: unknown, path = "payload"): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new HistoryPayloadError(`${path} mengandung angka non-finite.`);
    return value;
  }
  if (Array.isArray(value))
    return value.map((entry, index) => normalizeJson(entry, `${path}[${String(index)}]`));
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(object).sort()) {
      const entry = object[key];
      if (entry === undefined)
        throw new HistoryPayloadError(`${path}.${key} bernilai undefined.`);
      normalized[key] = normalizeJson(entry, `${path}.${key}`);
    }
    return normalized;
  }
  throw new HistoryPayloadError(`${path} bukan JSON-serializable.`);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

function sessionFromRow(row: SessionRow): HistorySession {
  return HistorySessionSchema.parse({
    id: row.id,
    createdAt: row.created_at,
    scope: row.scope,
    sensitivity: row.sensitivity,
    syncClass: row.sync_class,
    nextSeq: row.next_seq,
    headHash: row.head_hash,
  });
}

function eventFromRow(row: EventRow): HistoryEvent {
  return HistoryEventSchema.parse({
    id: row.id,
    sessionId: row.session_id,
    seq: row.seq,
    recordedAt: row.recorded_at,
    eventType: row.event_type,
    actor: row.actor,
    operationId: row.operation_id,
    parentEventId: row.parent_event_id,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    prevHash: row.prev_hash,
    hash: row.hash,
  });
}

function hashEvent(input: Omit<HistoryEvent, "hash">): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function sameDraft(actual: HistoryEvent, expected: HistoryEventDraft): boolean {
  return (
    canonicalJson({
      id: actual.id,
      recordedAt: actual.recordedAt,
      eventType: actual.eventType,
      actor: actual.actor,
      operationId: actual.operationId,
      parentEventId: actual.parentEventId,
      payload: actual.payload,
    }) === canonicalJson(expected)
  );
}

function assertGrant(session: HistorySession, grant: HistoryGrant): void {
  if (session.scope !== grant.scope) throw new HistoryAccessDeniedError();
  if (sensitivityRank(session.sensitivity) > sensitivityRank(grant.maxSensitivity)) {
    throw new HistoryAccessDeniedError();
  }
  if (grant.hostedEligible && !maySendToHosted(session.syncClass)) {
    throw new HistoryAccessDeniedError();
  }
}

export interface CreateHistorySessionInput {
  readonly id: SessionId;
  readonly createdAt: string;
  readonly scope: Scope;
  readonly sensitivity: Sensitivity;
  readonly syncClass: SyncClass;
}

export interface AppendHistoryResult {
  readonly event: HistoryEvent;
  readonly deduplicated: boolean;
}

export class HistoryLedger {
  constructor(private readonly db: HubDatabase) {}

  createSession(input: CreateHistorySessionInput): HistorySession {
    const existing = this.getSession(input.id);
    if (existing !== null) {
      if (
        existing.scope !== input.scope ||
        existing.sensitivity !== input.sensitivity ||
        existing.syncClass !== input.syncClass
      ) {
        throw new HistorySessionConflictError(input.id);
      }
      return existing;
    }
    this.db.raw
      .prepare(
        "INSERT INTO history_sessions(id,created_at,scope,sensitivity,sync_class,next_seq,head_hash) VALUES(?,?,?,?,?,0,NULL)",
      )
      .run(input.id, input.createdAt, input.scope, input.sensitivity, input.syncClass);
    return HistorySessionSchema.parse({ ...input, nextSeq: 0, headHash: null });
  }

  ensureSession(input: CreateHistorySessionInput): HistorySession {
    const transaction = this.db.raw.transaction(() => {
      const existing = this.getSession(input.id);
      if (existing === null) return this.createSession(input);
      if (existing.scope !== input.scope || existing.syncClass !== input.syncClass) {
        throw new HistorySessionConflictError(input.id);
      }
      if (sensitivityRank(input.sensitivity) > sensitivityRank(existing.sensitivity)) {
        this.db.raw
          .prepare("UPDATE history_sessions SET sensitivity=? WHERE id=?")
          .run(input.sensitivity, input.id);
        return HistorySessionSchema.parse({ ...existing, sensitivity: input.sensitivity });
      }
      return existing;
    });
    return transaction.immediate();
  }

  getSession(id: string): HistorySession | null {
    const row = this.db.raw.prepare("SELECT * FROM history_sessions WHERE id=?").get(id) as
      SessionRow | undefined;
    return row === undefined ? null : sessionFromRow(row);
  }

  listSessions(scope?: Scope): HistorySession[] {
    const rows = (
      scope === undefined
        ? this.db.raw
            .prepare("SELECT * FROM history_sessions ORDER BY created_at DESC,id ASC")
            .all()
        : this.db.raw
            .prepare(
              "SELECT * FROM history_sessions WHERE scope=? ORDER BY created_at DESC,id ASC",
            )
            .all(scope)
    ) as SessionRow[];
    return rows.map(sessionFromRow);
  }

  private existingEvent(id: string): HistoryEvent | null {
    const row = this.db.raw.prepare("SELECT * FROM history_events WHERE id=?").get(id) as
      EventRow | undefined;
    return row === undefined ? null : eventFromRow(row);
  }

  private appendLocked(
    sessionId: SessionId,
    expectedSeq: number | null,
    draft: HistoryEventDraft,
  ): AppendHistoryResult {
    const existing = this.existingEvent(draft.id);
    if (existing !== null) {
      if (existing.sessionId !== sessionId || !sameDraft(existing, draft)) {
        throw new HistoryEventConflictError(draft.id);
      }
      return { event: existing, deduplicated: true };
    }
    const session = this.getSession(sessionId);
    if (session === null) throw new HistorySessionNotFoundError(sessionId);
    if (expectedSeq !== null && expectedSeq !== session.nextSeq) {
      throw new HistorySequenceConflictError(expectedSeq, session.nextSeq);
    }
    const payloadJson = canonicalJson(draft.payload);
    const withoutHash = {
      ...draft,
      payload: JSON.parse(payloadJson) as Record<string, unknown>,
      sessionId,
      seq: session.nextSeq,
      prevHash: session.headHash,
    };
    const event = HistoryEventSchema.parse({ ...withoutHash, hash: hashEvent(withoutHash) });
    this.db.raw
      .prepare(
        "INSERT INTO history_events(id,session_id,seq,recorded_at,event_type,actor,operation_id,parent_event_id,payload_json,prev_hash,hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        event.id,
        event.sessionId,
        event.seq,
        event.recordedAt,
        event.eventType,
        event.actor,
        event.operationId,
        event.parentEventId,
        payloadJson,
        event.prevHash,
        event.hash,
      );
    this.db.raw
      .prepare("UPDATE history_sessions SET next_seq=?,head_hash=? WHERE id=?")
      .run(event.seq + 1, event.hash, sessionId);
    return { event, deduplicated: false };
  }

  append(
    sessionId: SessionId,
    expectedSeq: number,
    draft: HistoryEventDraft,
  ): AppendHistoryResult {
    const transaction = this.db.raw.transaction(() =>
      this.appendLocked(sessionId, expectedSeq, draft),
    );
    return transaction.immediate();
  }

  appendNext(sessionId: SessionId, draft: HistoryEventDraft): AppendHistoryResult {
    const transaction = this.db.raw.transaction(() =>
      this.appendLocked(sessionId, null, draft),
    );
    return transaction.immediate();
  }

  appendBatch(
    sessionId: SessionId,
    drafts: readonly HistoryEventDraft[],
  ): AppendHistoryResult[] {
    const transaction = this.db.raw.transaction(() =>
      drafts.map((draft) => this.appendLocked(sessionId, null, draft)),
    );
    return transaction.immediate();
  }

  verifySession(sessionId: SessionId): void {
    const session = this.getSession(sessionId);
    if (session === null) throw new HistorySessionNotFoundError(sessionId);
    const rows = this.db.raw
      .prepare("SELECT * FROM history_events WHERE session_id=? ORDER BY seq ASC")
      .all(sessionId) as EventRow[];
    let previousHash: string | null = null;
    for (let index = 0; index < rows.length; index += 1) {
      const event = eventFromRow(rows[index] as EventRow);
      if (event.seq !== index) {
        throw new HistoryIntegrityError(
          `History ${sessionId} tidak contiguous: expected seq ${String(index)}, got ${String(event.seq)}.`,
        );
      }
      if (event.prevHash !== previousHash) {
        throw new HistoryIntegrityError(
          `History ${sessionId} prevHash mismatch pada seq ${String(index)}.`,
        );
      }
      const { hash: _hash, ...withoutHash } = event;
      const recomputed = hashEvent(withoutHash);
      if (recomputed !== event.hash) {
        throw new HistoryIntegrityError(
          `History ${sessionId} hash mismatch pada seq ${String(index)}.`,
        );
      }
      previousHash = event.hash;
    }
    if (session.nextSeq !== rows.length) {
      throw new HistoryIntegrityError(
        `History ${sessionId} nextSeq tidak cocok dengan committed rows.`,
      );
    }
    if (session.headHash !== previousHash) {
      throw new HistoryIntegrityError(
        `History ${sessionId} headHash tidak cocok dengan committed prefix.`,
      );
    }
  }

  readRange(input: {
    readonly sessionId: SessionId;
    readonly afterSeq: number;
    readonly throughSeq?: number | undefined;
    readonly limit: number;
    readonly grant: HistoryGrant;
  }): HistoryRange {
    const session = this.getSession(input.sessionId);
    if (session === null) throw new HistorySessionNotFoundError(input.sessionId);
    assertGrant(session, input.grant);
    this.verifySession(input.sessionId);
    const upper = input.throughSeq ?? Math.max(-1, session.nextSeq - 1);
    if (upper < input.afterSeq) {
      return {
        sessionId: input.sessionId,
        afterSeq: input.afterSeq,
        throughSeq: input.afterSeq,
        nextSeq: session.nextSeq,
        events: [],
      };
    }
    const rows = this.db.raw
      .prepare(
        "SELECT * FROM history_events WHERE session_id=? AND seq>? AND seq<=? ORDER BY seq ASC LIMIT ?",
      )
      .all(input.sessionId, input.afterSeq, upper, input.limit) as EventRow[];
    const events = rows.map(eventFromRow);
    return {
      sessionId: input.sessionId,
      afterSeq: input.afterSeq,
      throughSeq: events.length === 0 ? input.afterSeq : (events.at(-1)?.seq ?? input.afterSeq),
      nextSeq: session.nextSeq,
      events,
    };
  }
}
