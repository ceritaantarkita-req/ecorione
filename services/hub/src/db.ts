/**
 * Database Hub — `docs/api-fase1.md` §Hub. File terpisah dari memori dan trace store
 * (`ECORIONE_HUB_DB_PATH`) — modul lain tidak pernah membuka file DB modul lain secara
 * langsung (AGENTS.md, "Arsitektur singkat").
 *
 * Dua tabel: `audit_events` (append-only, kolom mengikuti `AuditEventSchema`) dan
 * `approvals` (`operation_id` PK, durable state approval gate).
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

export const IN_MEMORY = ":memory:";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  operation_id TEXT,
  module TEXT NOT NULL,
  detail TEXT NOT NULL,
  rule_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_events_operation_id ON audit_events (operation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events (ts);

CREATE TABLE IF NOT EXISTS approvals (
  operation_id TEXT PRIMARY KEY,
  action_request TEXT NOT NULL,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  note TEXT,
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL
);
`;

export interface HubDatabase {
  readonly raw: SqliteDatabase;
  readonly path: string;
  close(): void;
}

export function openHubDatabase(path: string = IN_MEMORY): HubDatabase {
  // `better-sqlite3` tidak membuat direktori induk sendiri — tanpa ini, `pnpm dev` di
  // mesin baru (`./data/` belum ada, gitignored) gagal dengan "directory does not
  // exist" alih-alih menyala.
  if (path !== IN_MEMORY) mkdirSync(dirname(path), { recursive: true });
  const raw = new SqliteConstructor(path);

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
