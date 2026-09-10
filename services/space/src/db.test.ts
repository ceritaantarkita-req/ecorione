import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PERSONAL_SPACE_WORKSPACE_ID } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { openSpaceDatabase, type SpaceDatabase } from "./db.js";
import { SqliteConstructor } from "./sqlite.js";
import { SpaceStore } from "./store.js";

const roots: string[] = [];
const dbs: SpaceDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Space Batch 10 database migration", () => {
  it("migrates the legacy page/text/heading/list schema without changing ids or order", () => {
    const root = mkdtempSync(join(tmpdir(), "ecorione-space-batch10-"));
    roots.push(root);
    const path = join(root, "space.db");
    const legacy = new SqliteConstructor(path);
    legacy.pragma("foreign_keys = ON");
    legacy.exec(`
      CREATE TABLE pages (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        scope TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE blocks (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('text','heading','list')),
        content TEXT NOT NULL,
        position INTEGER NOT NULL CHECK(position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const timestamp = "2026-09-10T00:00:00.000Z";
    legacy
      .prepare("INSERT INTO pages(id,title,scope,created_at,updated_at) VALUES(?,?,?,?,?)")
      .run("page_legacy01", "Legacy notes", "personal", timestamp, timestamp);
    const insert = legacy.prepare(
      "INSERT INTO blocks(id,page_id,type,content,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
    );
    insert.run("block_legacytext", "page_legacy01", "text", "Body", 0, timestamp, timestamp);
    insert.run("block_legacyheading", "page_legacy01", "heading", "Title", 1, timestamp, timestamp);
    insert.run("block_legacylist", "page_legacy01", "list", "One\nTwo", 2, timestamp, timestamp);
    legacy.close();

    const db = openSpaceDatabase(path);
    dbs.push(db);
    const document = new SpaceStore(db).getPage("page_legacy01", PERSONAL_SPACE_WORKSPACE_ID);
    expect(document?.page).toMatchObject({
      id: "page_legacy01",
      workspaceId: "ws_personal",
      version: 1,
    });
    expect(document?.blocks.map((block) => ({ id: block.id, type: block.type, body: block.body }))).toEqual([
      {
        id: "block_legacytext",
        type: "paragraph",
        body: { kind: "paragraph", text: "Body" },
      },
      {
        id: "block_legacyheading",
        type: "heading",
        body: { kind: "heading", text: "Title", level: 2 },
      },
      {
        id: "block_legacylist",
        type: "list",
        body: { kind: "list", style: "bullet", items: ["One", "Two"] },
      },
    ]);
    expect(db.raw.pragma("user_version", { simple: true })).toBe(10);
  });
});
