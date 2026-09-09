import {
  MultimodalRunStatusSchema,
  type ArtifactId,
  type MultimodalRunStatus,
  type OperationId,
  type SessionId,
  type Timestamp,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface RunRow {
  operation_id: string;
  fingerprint: string;
  session_id: string;
  task: string;
  source_artifact_id: string | null;
  output_artifact_id: string | null;
  state: string;
  route_used: string | null;
  error: string | null;
  result_json: string | null;
  created_at: string;
  updated_at: string;
}

export class MultimodalRunConflictError extends Error {
  constructor(operationId: string) {
    super(`Multimodal operation ${operationId} sudah dipakai untuk request berbeda.`);
    this.name = "MultimodalRunConflictError";
  }
}
export class MultimodalRunNotFoundError extends Error {
  constructor(operationId: string) {
    super(`Multimodal operation tidak ditemukan: ${operationId}.`);
    this.name = "MultimodalRunNotFoundError";
  }
}

function statusFromRow(row: RunRow): MultimodalRunStatus {
  return MultimodalRunStatusSchema.parse({
    operationId: row.operation_id,
    sessionId: row.session_id,
    task: row.task,
    sourceArtifactId: row.source_artifact_id,
    outputArtifactId: row.output_artifact_id,
    state: row.state,
    routeUsed: row.route_used,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class MultimodalRunStore {
  constructor(private readonly db: HubDatabase) {
    this.db.raw.exec(`
      CREATE TABLE IF NOT EXISTS multimodal_runs (
        operation_id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        session_id TEXT NOT NULL,
        task TEXT NOT NULL CHECK(task IN ('ocr','vision','transcribe','synthesize')),
        source_artifact_id TEXT,
        output_artifact_id TEXT,
        state TEXT NOT NULL CHECK(state IN ('RECEIVED','PROCESSING','READY','FAILED')),
        route_used TEXT CHECK(route_used IS NULL OR route_used IN ('local','hosted')),
        error TEXT,
        result_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_multimodal_runs_session ON multimodal_runs(session_id, created_at);
    `);
  }

  begin(input: {
    operationId: OperationId;
    fingerprint: string;
    sessionId: SessionId;
    task: "ocr" | "vision" | "transcribe" | "synthesize";
    sourceArtifactId: ArtifactId | null;
    now: Timestamp;
  }): { status: MultimodalRunStatus; priorResult: unknown | null } {
    const existing = this.row(input.operationId);
    if (existing !== null) {
      if (existing.fingerprint !== input.fingerprint) {
        throw new MultimodalRunConflictError(input.operationId);
      }
      return {
        status: statusFromRow(existing),
        priorResult:
          existing.result_json === null ? null : (JSON.parse(existing.result_json) as unknown),
      };
    }
    this.db.raw
      .prepare(
        `INSERT INTO multimodal_runs(
          operation_id,fingerprint,session_id,task,source_artifact_id,output_artifact_id,
          state,route_used,error,result_json,created_at,updated_at
        ) VALUES(?,?,?,?,?,NULL,'RECEIVED',NULL,NULL,NULL,?,?)`,
      )
      .run(
        input.operationId,
        input.fingerprint,
        input.sessionId,
        input.task,
        input.sourceArtifactId,
        input.now,
        input.now,
      );
    return { status: this.get(input.operationId), priorResult: null };
  }

  markProcessing(operationId: OperationId, now: Timestamp): MultimodalRunStatus {
    this.require(operationId);
    this.db.raw
      .prepare(
        "UPDATE multimodal_runs SET state='PROCESSING',error=NULL,updated_at=? WHERE operation_id=? AND state='RECEIVED'",
      )
      .run(now, operationId);
    return this.get(operationId);
  }

  complete(input: {
    operationId: OperationId;
    routeUsed: "local" | "hosted";
    outputArtifactId?: ArtifactId | null | undefined;
    result: unknown;
    now: Timestamp;
  }): MultimodalRunStatus {
    this.require(input.operationId);
    this.db.raw
      .prepare(
        `UPDATE multimodal_runs
         SET state='READY',route_used=?,output_artifact_id=?,error=NULL,result_json=?,updated_at=?
         WHERE operation_id=?`,
      )
      .run(
        input.routeUsed,
        input.outputArtifactId ?? null,
        JSON.stringify(input.result),
        input.now,
        input.operationId,
      );
    return this.get(input.operationId);
  }

  fail(operationId: OperationId, error: string, now: Timestamp): MultimodalRunStatus {
    this.require(operationId);
    this.db.raw
      .prepare(
        "UPDATE multimodal_runs SET state='FAILED',error=?,updated_at=? WHERE operation_id=? AND state<>'READY'",
      )
      .run(error.slice(0, 1024), now, operationId);
    return this.get(operationId);
  }

  get(operationId: OperationId): MultimodalRunStatus {
    const row = this.require(operationId);
    return statusFromRow(row);
  }

  private row(operationId: OperationId): RunRow | null {
    const row = this.db.raw
      .prepare("SELECT * FROM multimodal_runs WHERE operation_id=?")
      .get(operationId) as RunRow | undefined;
    return row ?? null;
  }

  private require(operationId: OperationId): RunRow {
    const row = this.row(operationId);
    if (row === null) throw new MultimodalRunNotFoundError(operationId);
    return row;
  }
}
