import { createHash } from "node:crypto";
import {
  VoiceChunkAckSchema,
  VoiceEventSchema,
  VoiceSessionSnapshotSchema,
  type OperationId,
  type SessionId,
  type Timestamp,
  type VoiceAudioChunkRequest,
  type VoiceChunkAck,
  type VoiceEvent,
  type VoiceEventType,
  type VoiceSessionCreateRequest,
  type VoiceSessionSnapshot,
  type VoiceSessionState,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface SessionRow {
  session_id: string;
  workspace_id: string;
  config_fingerprint: string;
  state: string;
  scope: string;
  max_sensitivity: string;
  sync_class: string;
  route_json: string;
  language_mode: string;
  active_language: string;
  voice: string | null;
  vad_json: string;
  last_client_sequence: number;
  next_event_sequence: number;
  generation: number;
  barge_in_count: number;
  created_at: string;
  updated_at: string;
  error: string | null;
}

interface EventRow {
  session_id: string;
  sequence: number;
  generation: number;
  event_type: string;
  at: string;
  data_json: string;
}

interface ChunkRow {
  fingerprint: string;
  status: string;
  response_json: string | null;
}

export class VoiceSessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Voice session tidak ditemukan: ${sessionId}.`);
    this.name = "VoiceSessionNotFoundError";
  }
}

export class VoiceSessionConflictError extends Error {
  constructor(sessionId: string) {
    super(`Voice session ${sessionId} sudah ada dengan konfigurasi berbeda.`);
    this.name = "VoiceSessionConflictError";
  }
}

export class VoiceChunkConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceChunkConflictError";
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function sessionConfigFingerprint(input: VoiceSessionCreateRequest): string {
  return digest({
    sessionId: input.sessionId,
    workspaceId: input.workspaceId ?? "ws_personal",
    scope: input.scope,
    maxSensitivity: input.maxSensitivity,
    syncClass: input.syncClass,
    route: input.route,
    languageMode: input.languageMode,
    voice: input.voice ?? null,
    vad: input.vad,
  });
}

function chunkFingerprint(input: VoiceAudioChunkRequest): string {
  return digest(input);
}

function rowToSnapshot(row: SessionRow): VoiceSessionSnapshot {
  return VoiceSessionSnapshotSchema.parse({
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    state: row.state,
    scope: row.scope,
    maxSensitivity: row.max_sensitivity,
    syncClass: row.sync_class,
    route: JSON.parse(row.route_json) as unknown,
    languageMode: row.language_mode,
    activeLanguage: row.active_language,
    voice: row.voice,
    vad: JSON.parse(row.vad_json) as unknown,
    lastClientSequence: row.last_client_sequence,
    nextEventSequence: row.next_event_sequence,
    generation: row.generation,
    bargeInCount: row.barge_in_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    error: row.error,
  });
}

function rowToEvent(row: EventRow): VoiceEvent {
  return VoiceEventSchema.parse({
    sessionId: row.session_id,
    sequence: row.sequence,
    generation: row.generation,
    type: row.event_type,
    at: row.at,
    data: JSON.parse(row.data_json) as unknown,
  });
}

export class VoiceSessionStore {
  constructor(private readonly db: HubDatabase) {
    this.db.raw.exec(`
      CREATE TABLE IF NOT EXISTS voice_sessions (
        session_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        config_fingerprint TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('LISTENING','THINKING','SPEAKING','INTERRUPTED','CLOSED','FAILED')),
        scope TEXT NOT NULL,
        max_sensitivity TEXT NOT NULL,
        sync_class TEXT NOT NULL,
        route_json TEXT NOT NULL,
        language_mode TEXT NOT NULL CHECK(language_mode IN ('auto','id','en')),
        active_language TEXT NOT NULL CHECK(active_language IN ('id','en')),
        voice TEXT,
        vad_json TEXT NOT NULL,
        last_client_sequence INTEGER NOT NULL DEFAULT -1,
        next_event_sequence INTEGER NOT NULL DEFAULT 0 CHECK(next_event_sequence >= 0),
        generation INTEGER NOT NULL DEFAULT 0 CHECK(generation >= 0),
        barge_in_count INTEGER NOT NULL DEFAULT 0 CHECK(barge_in_count >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS voice_events (
        session_id TEXT NOT NULL REFERENCES voice_sessions(session_id),
        sequence INTEGER NOT NULL CHECK(sequence >= 0),
        generation INTEGER NOT NULL CHECK(generation >= 0),
        event_type TEXT NOT NULL,
        at TEXT NOT NULL,
        data_json TEXT NOT NULL,
        PRIMARY KEY(session_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS idx_voice_events_session ON voice_events(session_id, sequence);
      CREATE TRIGGER IF NOT EXISTS voice_events_no_update
      BEFORE UPDATE ON voice_events
      BEGIN
        SELECT RAISE(ABORT, 'voice_events are append-only');
      END;
      CREATE TRIGGER IF NOT EXISTS voice_events_no_delete
      BEFORE DELETE ON voice_events
      BEGIN
        SELECT RAISE(ABORT, 'voice_events are append-only');
      END;
      CREATE TABLE IF NOT EXISTS voice_chunk_receipts (
        session_id TEXT NOT NULL REFERENCES voice_sessions(session_id),
        client_sequence INTEGER NOT NULL CHECK(client_sequence >= 0),
        operation_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('PROCESSING','READY','FAILED')),
        response_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        PRIMARY KEY(session_id, client_sequence)
      );
    `);
  }

  create(input: VoiceSessionCreateRequest, now: Timestamp): VoiceSessionSnapshot {
    const configFingerprint = sessionConfigFingerprint(input);
    const existing = this.sessionRow(input.sessionId);
    if (existing !== undefined) {
      if (existing.config_fingerprint !== configFingerprint) {
        throw new VoiceSessionConflictError(input.sessionId);
      }
      return rowToSnapshot(existing);
    }
    const workspaceId = input.workspaceId ?? "ws_personal";
    const activeLanguage = input.languageMode === "en" ? "en" : "id";
    this.db.raw
      .prepare(
        `INSERT INTO voice_sessions(
          session_id,workspace_id,config_fingerprint,state,scope,max_sensitivity,sync_class,
          route_json,language_mode,active_language,voice,vad_json,last_client_sequence,
          next_event_sequence,generation,barge_in_count,created_at,updated_at,error
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.sessionId,
        workspaceId,
        configFingerprint,
        "LISTENING",
        input.scope,
        input.maxSensitivity,
        input.syncClass,
        JSON.stringify(input.route),
        input.languageMode,
        activeLanguage,
        input.voice ?? null,
        JSON.stringify(input.vad),
        -1,
        0,
        0,
        0,
        now,
        now,
        null,
      );
    this.appendEvent(input.sessionId, "session.started", 0, { operationId: input.operationId }, now);
    return this.get(input.sessionId);
  }

  get(sessionId: SessionId): VoiceSessionSnapshot {
    const row = this.sessionRow(sessionId);
    if (row === undefined) throw new VoiceSessionNotFoundError(sessionId);
    return rowToSnapshot(row);
  }

  listEvents(sessionId: SessionId, after: number): VoiceEvent[] {
    this.get(sessionId);
    const rows = this.db.raw
      .prepare(
        `SELECT session_id,sequence,generation,event_type,at,data_json
         FROM voice_events WHERE session_id=? AND sequence>? ORDER BY sequence ASC`,
      )
      .all(sessionId, after) as EventRow[];
    return rows.map(rowToEvent);
  }

  appendEvent(
    sessionId: SessionId,
    type: VoiceEventType,
    generation: number,
    data: Readonly<Record<string, unknown>>,
    at: Timestamp,
  ): VoiceEvent {
    const tx = this.db.raw.transaction(() => {
      const session = this.sessionRow(sessionId);
      if (session === undefined) throw new VoiceSessionNotFoundError(sessionId);
      const sequence = session.next_event_sequence;
      this.db.raw
        .prepare(
          `INSERT INTO voice_events(session_id,sequence,generation,event_type,at,data_json)
           VALUES(?,?,?,?,?,?)`,
        )
        .run(sessionId, sequence, generation, type, at, JSON.stringify(data));
      this.db.raw
        .prepare("UPDATE voice_sessions SET next_event_sequence=?, updated_at=? WHERE session_id=?")
        .run(sequence + 1, at, sessionId);
      return VoiceEventSchema.parse({ sessionId, sequence, generation, type, at, data });
    });
    return tx();
  }

  setState(
    sessionId: SessionId,
    state: VoiceSessionState,
    now: Timestamp,
    error: string | null = null,
  ): VoiceSessionSnapshot {
    const result = this.db.raw
      .prepare("UPDATE voice_sessions SET state=?,updated_at=?,error=? WHERE session_id=?")
      .run(state, now, error, sessionId);
    if (Number(result.changes) === 0) throw new VoiceSessionNotFoundError(sessionId);
    return this.get(sessionId);
  }

  setLanguage(sessionId: SessionId, language: "id" | "en", now: Timestamp): VoiceSessionSnapshot {
    const result = this.db.raw
      .prepare("UPDATE voice_sessions SET active_language=?,updated_at=? WHERE session_id=?")
      .run(language, now, sessionId);
    if (Number(result.changes) === 0) throw new VoiceSessionNotFoundError(sessionId);
    return this.get(sessionId);
  }

  interrupt(sessionId: SessionId, now: Timestamp): VoiceSessionSnapshot {
    const result = this.db.raw
      .prepare(
        `UPDATE voice_sessions
         SET state='INTERRUPTED',generation=generation+1,barge_in_count=barge_in_count+1,
             updated_at=?,error=NULL
         WHERE session_id=? AND state NOT IN ('CLOSED','FAILED')`,
      )
      .run(now, sessionId);
    if (Number(result.changes) === 0) {
      const existing = this.sessionRow(sessionId);
      if (existing === undefined) throw new VoiceSessionNotFoundError(sessionId);
    }
    return this.get(sessionId);
  }

  close(sessionId: SessionId, now: Timestamp): VoiceSessionSnapshot {
    return this.setState(sessionId, "CLOSED", now, null);
  }

  fail(sessionId: SessionId, message: string, now: Timestamp): VoiceSessionSnapshot {
    return this.setState(sessionId, "FAILED", now, message.slice(0, 1024));
  }

  recoverOpenSessions(now: Timestamp): number {
    const rows = this.db.raw
      .prepare("SELECT session_id,generation FROM voice_sessions WHERE state NOT IN ('CLOSED','FAILED')")
      .all() as Array<{ session_id: string; generation: number }>;
    for (const row of rows) {
      this.db.raw
        .prepare(
          "UPDATE voice_sessions SET state='FAILED',updated_at=?,error=? WHERE session_id=?",
        )
        .run(now, "Realtime voice process restarted; live session tidak diadopsi diam-diam.", row.session_id);
      this.appendEvent(
        row.session_id as SessionId,
        "error",
        row.generation,
        { reason: "process-restart", recoverable: false },
        now,
      );
    }
    return rows.length;
  }

  beginChunk(input: VoiceAudioChunkRequest, now: Timestamp): { replay: VoiceChunkAck | null } {
    const fingerprint = chunkFingerprint(input);
    const prior = this.db.raw
      .prepare(
        `SELECT fingerprint,status,response_json FROM voice_chunk_receipts
         WHERE session_id=? AND client_sequence=?`,
      )
      .get(input.sessionId, input.clientSequence) as ChunkRow | undefined;
    if (prior !== undefined) {
      if (prior.fingerprint !== fingerprint) {
        throw new VoiceChunkConflictError(
          `clientSequence ${String(input.clientSequence)} sudah dipakai untuk audio berbeda.`,
        );
      }
      if (prior.status === "READY" && prior.response_json !== null) {
        return { replay: VoiceChunkAckSchema.parse(JSON.parse(prior.response_json) as unknown) };
      }
      throw new VoiceChunkConflictError(
        `clientSequence ${String(input.clientSequence)} berada pada state ${prior.status}; jangan retry ambigu dengan payload baru.`,
      );
    }
    const session = this.get(input.sessionId);
    if (session.state === "CLOSED" || session.state === "FAILED") {
      throw new VoiceChunkConflictError(`Voice session tidak menerima audio pada state ${session.state}.`);
    }
    const expected = session.lastClientSequence + 1;
    if (input.clientSequence !== expected) {
      throw new VoiceChunkConflictError(
        `Urutan audio harus monotonic: expected ${String(expected)}, diterima ${String(input.clientSequence)}.`,
      );
    }
    const tx = this.db.raw.transaction(() => {
      this.db.raw
        .prepare(
          `INSERT INTO voice_chunk_receipts(
            session_id,client_sequence,operation_id,fingerprint,status,response_json,error,created_at,completed_at
          ) VALUES(?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          input.sessionId,
          input.clientSequence,
          input.operationId,
          fingerprint,
          "PROCESSING",
          null,
          null,
          now,
          null,
        );
      this.db.raw
        .prepare("UPDATE voice_sessions SET last_client_sequence=?,updated_at=? WHERE session_id=?")
        .run(input.clientSequence, now, input.sessionId);
    });
    tx();
    return { replay: null };
  }

  completeChunk(ack: VoiceChunkAck, now: Timestamp): void {
    const result = this.db.raw
      .prepare(
        `UPDATE voice_chunk_receipts SET status='READY',response_json=?,error=NULL,completed_at=?
         WHERE session_id=? AND client_sequence=? AND status='PROCESSING'`,
      )
      .run(JSON.stringify(ack), now, ack.sessionId, ack.clientSequence);
    if (Number(result.changes) === 0) {
      throw new VoiceChunkConflictError("Voice chunk receipt tidak lagi PROCESSING.");
    }
  }

  failChunk(
    sessionId: SessionId,
    clientSequence: number,
    error: string,
    now: Timestamp,
  ): void {
    this.db.raw
      .prepare(
        `UPDATE voice_chunk_receipts SET status='FAILED',error=?,completed_at=?
         WHERE session_id=? AND client_sequence=? AND status='PROCESSING'`,
      )
      .run(error.slice(0, 1024), now, sessionId, clientSequence);
  }

  private sessionRow(sessionId: SessionId): SessionRow | undefined {
    return this.db.raw
      .prepare(
        `SELECT session_id,workspace_id,config_fingerprint,state,scope,max_sensitivity,sync_class,
                route_json,language_mode,active_language,voice,vad_json,last_client_sequence,
                next_event_sequence,generation,barge_in_count,created_at,updated_at,error
         FROM voice_sessions WHERE session_id=?`,
      )
      .get(sessionId) as SessionRow | undefined;
  }
}
