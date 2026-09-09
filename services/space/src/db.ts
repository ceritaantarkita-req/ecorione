import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('text','heading','list')),
  content TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_page_position ON blocks(page_id, position, id);
`;

export interface SpaceDatabase {
  readonly raw: SqliteDatabase;
  close(): void;
}

export function openSpaceDatabase(path: string): SpaceDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const raw = new SqliteConstructor(path);
  raw.pragma("foreign_keys = ON");
  if (path !== ":memory:") {
    raw.pragma("journal_mode = WAL");
    raw.pragma("busy_timeout = 5000");
  }
  raw.exec(SCHEMA);
  return { raw, close: () => raw.close() };
}
