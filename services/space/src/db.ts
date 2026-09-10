import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteConstructor, type SqliteDatabase } from "./sqlite.js";

const CREATE_PAGES = `
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'ws_personal',
  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

const CREATE_BLOCKS = `
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

interface ColumnRow {
  name: string;
}
interface LegacyBlockRow {
  id: string;
  page_id: string;
  type: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function columns(raw: SqliteDatabase, table: string): Set<string> {
  return new Set(
    (raw.prepare(`PRAGMA table_info(${table})`).all() as ColumnRow[]).map((column) => column.name),
  );
}

function legacyBody(type: string, content: string): { type: string; body: object } {
  if (type === "heading") return { type, body: { kind: "heading", text: content, level: 2 } };
  if (type === "list") {
    return {
      type,
      body: {
        kind: "list",
        style: "bullet",
        items: content.length === 0 ? [] : content.split("\n"),
      },
    };
  }
  return { type: "paragraph", body: { kind: "paragraph", text: content } };
}

function migrateLegacySchema(raw: SqliteDatabase): void {
  const pageColumns = columns(raw, "pages");
  if (!pageColumns.has("workspace_id")) {
    raw.exec("ALTER TABLE pages ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'ws_personal';");
  }
  if (!pageColumns.has("version")) {
    raw.exec("ALTER TABLE pages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;");
  }

  const blockColumns = columns(raw, "blocks");
  if (blockColumns.has("content_json")) {
    if (!blockColumns.has("version")) {
      raw.exec("ALTER TABLE blocks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;");
    }
    return;
  }

  const legacyRows = raw.prepare("SELECT * FROM blocks ORDER BY page_id,position,id").all() as LegacyBlockRow[];
  raw.pragma("foreign_keys = OFF");
  try {
    raw.transaction(() => {
      raw.exec("ALTER TABLE blocks RENAME TO blocks_legacy_batch10;");
      raw.exec(CREATE_BLOCKS);
      const insert = raw.prepare(
        `INSERT INTO blocks(id,page_id,type,content_json,position,version,created_at,updated_at)
         VALUES(?,?,?,?,?,1,?,?)`,
      );
      for (const row of legacyRows) {
        const migrated = legacyBody(row.type, row.content);
        insert.run(
          row.id,
          row.page_id,
          migrated.type,
          JSON.stringify(migrated.body),
          row.position,
          row.created_at,
          row.updated_at,
        );
      }
      raw.exec("DROP TABLE blocks_legacy_batch10;");
    })();
  } finally {
    raw.pragma("foreign_keys = ON");
  }
}

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
  raw.exec(CREATE_PAGES);
  raw.exec(CREATE_BLOCKS);
  migrateLegacySchema(raw);
  raw.exec("CREATE INDEX IF NOT EXISTS idx_pages_workspace_updated ON pages(workspace_id,updated_at DESC,id ASC);");
  raw.exec("CREATE INDEX IF NOT EXISTS idx_blocks_page_position ON blocks(page_id,position,id);");
  raw.pragma("user_version = 10");
  return { raw, close: () => raw.close() };
}
