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
  return { raw, path, close: () => raw.close() };
}
