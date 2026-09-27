/** Hub durable state: audit, approvals, idempotent action results, historical ledger, extensions, authority. */
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

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instruction TEXT NOT NULL DEFAULT '',
  memory_policy TEXT NOT NULL DEFAULT 'GLOBAL_PLUS_PROJECT' CHECK(memory_policy='GLOBAL_PLUS_PROJECT'),
  autonomy_ceiling TEXT NOT NULL DEFAULT 'L3' CHECK(autonomy_ceiling IN ('L0','L1','L2','L3')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_archived
  ON projects(workspace_id, archived_at, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS project_source_bindings (
  project_id TEXT NOT NULL REFERENCES projects(id),
  workspace_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('artifact','space-page','flow-graph','mcp-server','url')),
  resource_id TEXT NOT NULL,
  owner TEXT NOT NULL CHECK(owner IN ('Artifact','Space','Flow','Connect')),
  role TEXT NOT NULL CHECK(role IN ('source','reference')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(project_id, resource_type, resource_id, role)
);
CREATE INDEX IF NOT EXISTS idx_project_source_bindings_project
  ON project_source_bindings(workspace_id, project_id, created_at DESC, resource_type, resource_id);

CREATE TABLE IF NOT EXISTS history_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  scope TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  sync_class TEXT NOT NULL,
  next_seq INTEGER NOT NULL DEFAULT 0 CHECK(next_seq >= 0),
  head_hash TEXT,
  archive_through_seq INTEGER NOT NULL DEFAULT -1 CHECK(archive_through_seq >= -1),
  archive_head_hash TEXT
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

CREATE TABLE IF NOT EXISTS history_archive_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES history_sessions(id),
  first_seq INTEGER NOT NULL CHECK(first_seq >= 0),
  last_seq INTEGER NOT NULL CHECK(last_seq >= first_seq),
  event_count INTEGER NOT NULL CHECK(event_count > 0),
  payload_gzip BLOB NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
  first_prev_hash TEXT,
  last_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  format_version INTEGER NOT NULL CHECK(format_version=1),
  UNIQUE(session_id, first_seq),
  UNIQUE(session_id, last_seq)
);
CREATE INDEX IF NOT EXISTS idx_history_archive_segments_session
  ON history_archive_segments(session_id, first_seq, last_seq);
CREATE TABLE IF NOT EXISTS history_archive_event_index (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES history_sessions(id),
  seq INTEGER NOT NULL CHECK(seq >= 0),
  segment_id TEXT NOT NULL REFERENCES history_archive_segments(id),
  UNIQUE(session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_history_archive_event_index_segment
  ON history_archive_event_index(segment_id, seq);
CREATE TABLE IF NOT EXISTS history_compaction_guard (
  session_id TEXT PRIMARY KEY REFERENCES history_sessions(id),
  through_seq INTEGER NOT NULL CHECK(through_seq >= 0),
  token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ecx_agent_bindings (
  workspace_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  target TEXT NOT NULL CHECK(target IN ('local','hosted')),
  capabilities_json TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  operation_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_ecx_agent_bindings_workspace
  ON ecx_agent_bindings(workspace_id, enabled, agent_id);

CREATE TABLE IF NOT EXISTS ecx_execution_receipts (
  packet_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  target TEXT NOT NULL CHECK(target IN ('local','hosted')),
  history_session_id TEXT,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('STARTED','SUCCEEDED','FAILED','UNCERTAIN')),
  hydrated_bytes INTEGER NOT NULL CHECK(hydrated_bytes >= 0),
  selected_ref_indexes_json TEXT NOT NULL,
  error TEXT,
  result_json TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ecx_execution_receipts_operation
  ON ecx_execution_receipts(operation_id, packet_id);
CREATE INDEX IF NOT EXISTS idx_ecx_execution_receipts_workspace
  ON ecx_execution_receipts(workspace_id, updated_at DESC, packet_id);

CREATE TABLE IF NOT EXISTS ecx_round_trip_receipts (
  packet_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  continuation_operation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  response_mode TEXT NOT NULL CHECK(response_mode IN ('delta','full')),
  parent_target TEXT NOT NULL CHECK(parent_target IN ('local','hosted')),
  history_session_id TEXT,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('STARTED','SUCCEEDED','FAILED','UNCERTAIN')),
  error TEXT,
  result_json TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ecx_round_trip_receipts_operation
  ON ecx_round_trip_receipts(operation_id, packet_id);
CREATE INDEX IF NOT EXISTS idx_ecx_round_trip_receipts_workspace
  ON ecx_round_trip_receipts(workspace_id, updated_at DESC, packet_id);


CREATE TABLE IF NOT EXISTS ecx_fanout_receipts (
  fanout_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  continuation_operation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  parent_target TEXT NOT NULL CHECK(parent_target IN ('local','hosted')),
  history_session_id TEXT,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('STARTED','SUCCEEDED','FAILED','UNCERTAIN')),
  error TEXT,
  result_json TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ecx_fanout_receipts_operation
  ON ecx_fanout_receipts(operation_id, fanout_id);
CREATE INDEX IF NOT EXISTS idx_ecx_fanout_receipts_workspace
  ON ecx_fanout_receipts(workspace_id, updated_at DESC, fanout_id);

CREATE TRIGGER IF NOT EXISTS history_events_no_update
BEFORE UPDATE ON history_events
BEGIN
  SELECT RAISE(ABORT, 'history_events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS history_events_no_delete
BEFORE DELETE ON history_events
WHEN NOT EXISTS (
  SELECT 1 FROM history_compaction_guard
  WHERE session_id=OLD.session_id AND OLD.seq<=through_seq
)
BEGIN
  SELECT RAISE(ABORT, 'history_events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS history_archive_segments_no_update
BEFORE UPDATE ON history_archive_segments
BEGIN
  SELECT RAISE(ABORT, 'history_archive_segments are immutable');
END;
CREATE TRIGGER IF NOT EXISTS history_archive_segments_no_delete
BEFORE DELETE ON history_archive_segments
BEGIN
  SELECT RAISE(ABORT, 'history_archive_segments are immutable');
END;
CREATE TRIGGER IF NOT EXISTS history_archive_event_index_no_update
BEFORE UPDATE ON history_archive_event_index
BEGIN
  SELECT RAISE(ABORT, 'history_archive_event_index is immutable');
END;
CREATE TRIGGER IF NOT EXISTS history_archive_event_index_no_delete
BEFORE DELETE ON history_archive_event_index
BEGIN
  SELECT RAISE(ABORT, 'history_archive_event_index is immutable');
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
  ON extension_revisions(workspace_id, extension_id, created_at);
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

CREATE TABLE IF NOT EXISTS capability_definitions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS authority_declarations (
  workspace_id TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  action_class TEXT NOT NULL,
  resource TEXT NOT NULL,
  access TEXT NOT NULL,
  side_effect INTEGER NOT NULL CHECK(side_effect IN (0,1)),
  description TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,subject_kind,subject_id,capability_id,permission_id)
);
CREATE INDEX IF NOT EXISTS idx_authority_declarations_subject
  ON authority_declarations(workspace_id,subject_kind,subject_id,capability_id);

CREATE TABLE IF NOT EXISTS authority_grants (
  workspace_id TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  max_sensitivity TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY(workspace_id,subject_kind,subject_id,capability_id,permission_id,scope)
);
CREATE INDEX IF NOT EXISTS idx_authority_grants_subject
  ON authority_grants(workspace_id,subject_kind,subject_id,capability_id,scope);

CREATE TABLE IF NOT EXISTS authority_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  capability_id TEXT,
  permission_ids_json TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_authority_events_subject
  ON authority_events(workspace_id,subject_kind,subject_id,created_at);
CREATE TRIGGER IF NOT EXISTS authority_events_no_update
BEFORE UPDATE ON authority_events
BEGIN
  SELECT RAISE(ABORT, 'authority_events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS authority_events_no_delete
BEFORE DELETE ON authority_events
BEGIN
  SELECT RAISE(ABORT, 'authority_events are append-only');
END;

CREATE TABLE IF NOT EXISTS authority_operations (
  idempotency_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS authority_operations_no_update
BEFORE UPDATE ON authority_operations
BEGIN
  SELECT RAISE(ABORT, 'authority_operations are immutable receipts');
END;
CREATE TRIGGER IF NOT EXISTS authority_operations_no_delete
BEFORE DELETE ON authority_operations
BEGIN
  SELECT RAISE(ABORT, 'authority_operations are immutable receipts');
END;

CREATE TABLE IF NOT EXISTS authority_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

interface TableInfoRow {
  readonly name: string;
}

function hasColumn(db: SqliteDatabase, table: string, column: string): boolean {
  return (db.pragma(`table_info(${table})`) as TableInfoRow[]).some(
    (row) => row.name === column,
  );
}

function migrateHistoryLedgerLifecycle(db: SqliteDatabase): void {
  db.transaction(() => {
    if (!hasColumn(db, "history_sessions", "archive_through_seq")) {
      db.exec(
        "ALTER TABLE history_sessions ADD COLUMN archive_through_seq INTEGER NOT NULL DEFAULT -1 CHECK(archive_through_seq >= -1)",
      );
    }
    if (!hasColumn(db, "history_sessions", "archive_head_hash")) {
      db.exec("ALTER TABLE history_sessions ADD COLUMN archive_head_hash TEXT");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS history_archive_segments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES history_sessions(id),
        first_seq INTEGER NOT NULL CHECK(first_seq >= 0),
        last_seq INTEGER NOT NULL CHECK(last_seq >= first_seq),
        event_count INTEGER NOT NULL CHECK(event_count > 0),
        payload_gzip BLOB NOT NULL,
        payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
        first_prev_hash TEXT,
        last_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        format_version INTEGER NOT NULL CHECK(format_version=1),
        UNIQUE(session_id, first_seq),
        UNIQUE(session_id, last_seq)
      );
      CREATE INDEX IF NOT EXISTS idx_history_archive_segments_session
        ON history_archive_segments(session_id, first_seq, last_seq);
      CREATE TABLE IF NOT EXISTS history_archive_event_index (
        event_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES history_sessions(id),
        seq INTEGER NOT NULL CHECK(seq >= 0),
        segment_id TEXT NOT NULL REFERENCES history_archive_segments(id),
        UNIQUE(session_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_history_archive_event_index_segment
        ON history_archive_event_index(segment_id, seq);
      CREATE TABLE IF NOT EXISTS history_compaction_guard (
        session_id TEXT PRIMARY KEY REFERENCES history_sessions(id),
        through_seq INTEGER NOT NULL CHECK(through_seq >= 0),
        token TEXT NOT NULL
      );
      DROP TRIGGER IF EXISTS history_events_no_delete;
      CREATE TRIGGER history_events_no_delete
      BEFORE DELETE ON history_events
      WHEN NOT EXISTS (
        SELECT 1 FROM history_compaction_guard
        WHERE session_id=OLD.session_id AND OLD.seq<=through_seq
      )
      BEGIN
        SELECT RAISE(ABORT, 'history_events are append-only');
      END;
      CREATE TRIGGER IF NOT EXISTS history_archive_segments_no_update
      BEFORE UPDATE ON history_archive_segments
      BEGIN
        SELECT RAISE(ABORT, 'history_archive_segments are immutable');
      END;
      CREATE TRIGGER IF NOT EXISTS history_archive_segments_no_delete
      BEFORE DELETE ON history_archive_segments
      BEGIN
        SELECT RAISE(ABORT, 'history_archive_segments are immutable');
      END;
      CREATE TRIGGER IF NOT EXISTS history_archive_event_index_no_update
      BEFORE UPDATE ON history_archive_event_index
      BEGIN
        SELECT RAISE(ABORT, 'history_archive_event_index is immutable');
      END;
      CREATE TRIGGER IF NOT EXISTS history_archive_event_index_no_delete
      BEFORE DELETE ON history_archive_event_index
      BEGIN
        SELECT RAISE(ABORT, 'history_archive_event_index is immutable');
      END;
    `);
  })();
}

function migrateProjectFoundation(db: SqliteDatabase): void {
  db.transaction(() => {
    if (!hasColumn(db, "history_sessions", "workspace_id")) {
      db.exec("ALTER TABLE history_sessions ADD COLUMN workspace_id TEXT");
    }
    if (!hasColumn(db, "history_sessions", "project_id")) {
      db.exec("ALTER TABLE history_sessions ADD COLUMN project_id TEXT");
    }
    if (!hasColumn(db, "history_sessions", "title")) {
      db.exec("ALTER TABLE history_sessions ADD COLUMN title TEXT");
    }
    if (!hasColumn(db, "history_sessions", "updated_at")) {
      db.exec("ALTER TABLE history_sessions ADD COLUMN updated_at TEXT");
    }

    db.prepare(
      `INSERT OR IGNORE INTO projects
       (id,workspace_id,name,description,instruction,memory_policy,autonomy_ceiling,created_at,updated_at,archived_at)
       VALUES ('prj_personal','ws_personal','Personal','','','GLOBAL_PLUS_PROJECT','L3',
         strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL)`,
    ).run();

    db.exec(`
      UPDATE history_sessions
      SET workspace_id='ws_personal', project_id='prj_personal'
      WHERE scope='personal' AND workspace_id IS NULL AND project_id IS NULL;
      UPDATE history_sessions SET updated_at=created_at WHERE updated_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_history_sessions_project_created
        ON history_sessions(workspace_id, project_id, created_at DESC, id);
    `);
  })();
}
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
  migrateProjectFoundation(raw);
  migrateHistoryLedgerLifecycle(raw);
  return {
    raw,
    path,
    close(): void {
      raw.close();
    },
  };
}
