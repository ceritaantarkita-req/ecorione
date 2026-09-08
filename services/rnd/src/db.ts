/**
 * Database trace store — `docs/api-fase1.md` §RnD. File terpisah dari memori
 * (`ECORIONE_RND_DB_PATH`), bukan tabel tambahan di DB Context: modul lain tidak pernah
 * membuka file DB modul lain secara langsung (AGENTS.md, "Arsitektur singkat").
 *
 * Skema jauh lebih sederhana dari Context — trace store bukan sumber kebenaran privasi
 * (ADR-06 append-only-lewat-trigger tidak perlu diulang di sini), cukup append-only
 * secara konvensi kode.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

export const IN_MEMORY = ":memory:";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS spans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  attributes TEXT NOT NULL,
  operation_id TEXT,
  trace_id TEXT,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spans_operation_id ON spans (operation_id);
CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans (trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_recorded_at ON spans (recorded_at);
`;

export interface RndDatabase {
  readonly raw: SqliteDatabase;
  readonly path: string;
  close(): void;
}

export function openRndDatabase(path: string = IN_MEMORY): RndDatabase {
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
