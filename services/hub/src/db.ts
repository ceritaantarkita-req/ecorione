/** Hub durable state: audit, approvals, idempotent action results, historical ledger, extensions. */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";
export const IN_MEMORY = ":memory:";
const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, ts TEXT NOT NULL, type TEXT NOT NULL, operation_id TEXT,
  module TEXT NOT NULL, detail TEXT NOT NULL, rule_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_events_operation_id ON audit_events (operation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events (ts);
CREATE TABLE IF NOT EXISTS approvals (
  operation_id TEXT PRIMARY KEY, action_request TEXT NOT NULL, status TEXT NOT NULL,
  prompt TEXT NOT NULL, note TEXT, decided_by TEXT, decided_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotent_results (
  idempotency_key TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  result_json TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotent_results_operation ON idempotent_results(operation_id);

CREATE TABLE IF NOT EXISTS history_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  scope TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  sync_class TEXT NOT NULL,
  next_seq INTEGER NOT NULL DEFAULT 0 CHECK(next_seq >= 0),
  head_hash TEXT
);
CREATE TABLE IF NOT EXISTS history_events (
  id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES history_sessions(id),
  seq INTEGER NOT NULL CHECK(seq >= 0),
  recorded_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  operation_id TEXT,
  parent_event_id TEXT,
  payload_json TEXT NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  PRIMARY KEY(session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_history_events_operation ON history_events(operation_id);
CREATE INDEX IF NOT EXISTS idx_history_events_recorded_at ON history_events(recorded_at);
CREATE TRIGGER IF NOT EXISTS history_events_no_update
BEFORE UPDATE ON history_events
BEGIN
  SELECT RAISE(ABORT, 'history_events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS history_events_no_delete
BEFORE DELETE ON history_events
BEGIN
  SELECT RAISE(ABORT, 'history_events are append-only');
END;

CREATE TABLE IF NOT EXISTS extension_revisions (
  revision_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('INSTALL','UPDATE','ROLLBACK')),
  source_revision_id TEXT REFERENCES extension_revisions(revision_id),
  operation_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_extension_revisions_workspace_extension
  ON extension_revisions(workspace_id, extension_id, created_at, rowid);
CREATE TRIGGER IF NOT EXISTS extension_revisions_no_update
BEFORE UPDATE ON extension_revisions
BEGIN
  SELECT RAISE(ABORT, 'extension_revisions are append-only');
END;
CREATE TRIGGER IF NOT EXISTS extension_revisions_no_delete
BEFORE DELETE ON extension_revisions
BEGIN
  SELECT RAISE(ABORT, 'extension_revisions are append-only');
END;

CREATE TABLE IF NOT EXISTS extension_installations (
  workspace_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  current_revision_id TEXT NOT NULL REFERENCES extension_revisions(revision_id),
  lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('INSTALLED','DISABLED','REMOVED')),
  health_status TEXT NOT NULL CHECK(health_status IN ('UNKNOWN','HEALTHY','DEGRADED','ERROR','BLOCKED')),
  health_detail TEXT,
  health_checked_at TEXT,
  updated_at TEXT NOT NULL,
  removed_at TEXT,
  PRIMARY KEY(workspace_id, extension_id)
);
CREATE INDEX IF NOT EXISTS idx_extension_installations_workspace
  ON extension_installations(workspace_id, extension_id);

CREATE TABLE IF NOT EXISTS extension_operations (
  idempotency_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('INSTALL','UPDATE','ROLLBACK','REMOVE','HEALTH')),
  workspace_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_extension_operations_workspace_extension
  ON extension_operations(workspace_id, extension_id, completed_at);
CREATE TRIGGER IF NOT EXISTS extension_operations_no_update
BEFORE UPDATE ON extension_operations
BEGIN
  SELECT RAISE(ABORT, 'extension_operations are immutable receipts');
END;
CREATE TRIGGER IF NOT EXISTS extension_operations_no_delete
BEFORE DELETE ON extension_operations
BEGIN
  SELECT RAISE(ABORT, 'extension_operations are immutable receipts');
END;
`;
export interface HubDatabase {
  readonly raw: SqliteDatabase;
  readonly path: string;
  close(): void;
}
export function openHubDatabase(path: string = IN_MEMORY): HubDatabase {
  if (path !== IN_MEMORY) mkdirSync(dirname(path), { recursive: true });
  const raw = new SqliteConstructor(path);
  raw.pragma("foreign_keys = ON");
  if (path !== IN_MEMORY) {
    raw.pragma("journal_mode = WAL");
    raw.pragma("synchronous = NORMAL");
    raw.pragma("busy_timeout = 5000");
  }
  raw.exec(SCHEMA);
  return {
    raw,
    path,
    close(): void {
      raw.close();
    },
  };
}
