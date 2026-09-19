import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS flow_graphs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  current_version INTEGER NOT NULL CHECK(current_version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS flow_graph_versions (
  graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK(version >= 1),
  digest TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(graph_id, version)
);
CREATE INDEX IF NOT EXISTS idx_flow_graph_versions_graph ON flow_graph_versions(graph_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_flow_graph_versions_digest ON flow_graph_versions(graph_id, digest, version DESC);
CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('manual','time','event','webhook')),
  graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE RESTRICT,
  graph_version INTEGER NOT NULL CHECK(graph_version >= 1),
  version_policy TEXT NOT NULL CHECK(version_policy='PINNED'),
  requested_autonomy TEXT NOT NULL CHECK(requested_autonomy IN ('L0','L1','L2','L3')),
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  configuration_json TEXT NOT NULL,
  temporal_schedule_id TEXT,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_triggers_workspace_project_updated
  ON triggers(workspace_id, project_id, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_triggers_graph_version
  ON triggers(graph_id, graph_version, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_triggers_temporal_schedule
  ON triggers(temporal_schedule_id) WHERE temporal_schedule_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_triggers_webhook_hook_id
  ON triggers(json_extract(configuration_json,'$.hookId')) WHERE kind='webhook';
CREATE TABLE IF NOT EXISTS trigger_manual_fires (
  trigger_id TEXT NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  graph_id TEXT NOT NULL,
  graph_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(trigger_id, request_id)
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

function migrateProjectFoundation(db: SqliteDatabase): void {
  db.transaction(() => {
    if (!hasColumn(db, "flow_graphs", "project_id")) {
      db.exec("ALTER TABLE flow_graphs ADD COLUMN project_id TEXT");
    }
    db.exec(`
      UPDATE flow_graphs
      SET project_id='prj_personal'
      WHERE workspace_id='ws_personal' AND project_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_flow_graphs_workspace_project_updated
        ON flow_graphs(workspace_id, project_id, updated_at DESC, id);
    `);
  })();
}

interface SqliteMasterRow {
  readonly sql: string | null;
}

function triggersSupportPe05(db: SqliteDatabase): boolean {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='triggers'")
    .get() as SqliteMasterRow | undefined;
  return row?.sql?.includes("'event'") === true && row.sql.includes("'webhook'");
}

function migratePe05TriggerKinds(db: SqliteDatabase): void {
  if (triggersSupportPe05(db)) return;

  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE triggers_pe05 (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('manual','time','event','webhook')),
          graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE RESTRICT,
          graph_version INTEGER NOT NULL CHECK(graph_version >= 1),
          version_policy TEXT NOT NULL CHECK(version_policy='PINNED'),
          requested_autonomy TEXT NOT NULL CHECK(requested_autonomy IN ('L0','L1','L2','L3')),
          enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
          configuration_json TEXT NOT NULL,
          temporal_schedule_id TEXT,
          revision INTEGER NOT NULL CHECK(revision >= 1),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO triggers_pe05
        SELECT id,workspace_id,project_id,name,kind,graph_id,graph_version,version_policy,
               requested_autonomy,enabled,configuration_json,temporal_schedule_id,
               revision,created_at,updated_at
        FROM triggers;

        CREATE TABLE trigger_manual_fires_pe05 (
          trigger_id TEXT NOT NULL REFERENCES triggers_pe05(id) ON DELETE CASCADE,
          request_id TEXT NOT NULL,
          workflow_id TEXT NOT NULL,
          operation_id TEXT NOT NULL,
          graph_id TEXT NOT NULL,
          graph_version INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY(trigger_id, request_id)
        );

        INSERT INTO trigger_manual_fires_pe05
        SELECT trigger_id,request_id,workflow_id,operation_id,graph_id,graph_version,created_at
        FROM trigger_manual_fires;

        DROP TABLE trigger_manual_fires;
        DROP TABLE triggers;
        ALTER TABLE triggers_pe05 RENAME TO triggers;
        ALTER TABLE trigger_manual_fires_pe05 RENAME TO trigger_manual_fires;

        CREATE INDEX idx_triggers_workspace_project_updated
          ON triggers(workspace_id, project_id, updated_at DESC, id);
        CREATE INDEX idx_triggers_graph_version
          ON triggers(graph_id, graph_version, id);
        CREATE UNIQUE INDEX idx_triggers_temporal_schedule
          ON triggers(temporal_schedule_id) WHERE temporal_schedule_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_triggers_webhook_hook_id
          ON triggers(json_extract(configuration_json,'$.hookId')) WHERE kind='webhook';
      `);
    })();

    const violations = db.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) {
      throw new Error("PE-05 Trigger migration menghasilkan foreign-key violation.");
    }
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

function ensurePe05EventDeliveryTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trigger_event_deliveries (
      trigger_id TEXT NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
      dedupe_key TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_digest TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('PENDING','STARTED')),
      workflow_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      graph_id TEXT NOT NULL,
      graph_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(trigger_id, dedupe_key)
    );
    CREATE INDEX IF NOT EXISTS idx_trigger_event_deliveries_event
      ON trigger_event_deliveries(trigger_id, event_id);
  `);
}

export interface FlowDatabase {
  readonly raw: SqliteDatabase;
  readonly path: string;
  close(): void;
}
export function openFlowDatabase(path: string): FlowDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const raw = new SqliteConstructor(path);
  raw.pragma("foreign_keys = ON");
  if (path !== ":memory:") {
    raw.pragma("journal_mode = WAL");
    raw.pragma("busy_timeout = 5000");
  }
  raw.exec(SCHEMA);
  migrateProjectFoundation(raw);
  migratePe05TriggerKinds(raw);
  ensurePe05EventDeliveryTable(raw);
  return { raw, path, close: () => raw.close() };
}
