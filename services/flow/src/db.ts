import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS flow_graphs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  current_version INTEGER NOT NULL CHECK(current_version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flow_graphs_workspace_updated ON flow_graphs(workspace_id, updated_at DESC, id);
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

export interface FlowDatabase {
  readonly raw: SqliteDatabase;
  readonly path: string;
  close(): void;
}
export function openFlowDatabase(path: string): FlowDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const raw = new SqliteConstructor(path);
  raw.pragma("foreign_keys = ON");
  if (path !== ":memory:") { raw.pragma("journal_mode = WAL"); raw.pragma("busy_timeout = 5000"); }
  raw.exec(SCHEMA);
  return { raw, path, close: () => raw.close() };
}
