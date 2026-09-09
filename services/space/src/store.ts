import { randomUUID } from "node:crypto";
import {
  SpaceBlockSchema,
  SpacePageSchema,
  type Scope,
  type SpaceBlock,
  type SpaceBlockType,
  type SpacePage,
} from "@ecorione/shared-schema";
import type { SpaceDatabase } from "./db.js";

interface PageRow {
  id: string;
  title: string;
  scope: string;
  created_at: string;
  updated_at: string;
}
interface BlockRow {
  id: string;
  page_id: string;
  type: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function localId(prefix: "page" | "block"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}
function pageFromRow(row: PageRow): SpacePage {
  return SpacePageSchema.parse({
    id: row.id,
    title: row.title,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
function blockFromRow(row: BlockRow): SpaceBlock {
  return SpaceBlockSchema.parse({
    id: row.id,
    pageId: row.page_id,
    type: row.type,
    content: row.content,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SpaceStore {
  constructor(private readonly db: SpaceDatabase) {}

  createPage(input: { title: string; scope: Scope; now: string }): SpacePage {
    const page = SpacePageSchema.parse({
      id: localId("page"),
      title: input.title,
      scope: input.scope,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.db.raw
      .prepare("INSERT INTO pages(id,title,scope,created_at,updated_at) VALUES(?,?,?,?,?)")
      .run(page.id, page.title, page.scope, page.createdAt, page.updatedAt);
    return page;
  }

  listPages(scope?: Scope): SpacePage[] {
    const rows = (
      scope === undefined
        ? this.db.raw.prepare("SELECT * FROM pages ORDER BY updated_at DESC,id ASC").all()
        : this.db.raw
            .prepare("SELECT * FROM pages WHERE scope=? ORDER BY updated_at DESC,id ASC")
            .all(scope)
    ) as PageRow[];
    return rows.map(pageFromRow);
  }

  getPage(id: string): { page: SpacePage; blocks: SpaceBlock[] } | null {
    const row = this.db.raw.prepare("SELECT * FROM pages WHERE id=?").get(id) as
      PageRow | undefined;
    if (row === undefined) return null;
    const blocks = this.db.raw
      .prepare("SELECT * FROM blocks WHERE page_id=? ORDER BY position ASC,id ASC")
      .all(id) as BlockRow[];
    return { page: pageFromRow(row), blocks: blocks.map(blockFromRow) };
  }

  renamePage(id: string, title: string, now: string): SpacePage | null {
    const changed = this.db.raw
      .prepare("UPDATE pages SET title=?,updated_at=? WHERE id=?")
      .run(title, now, id).changes;
    return changed === 0 ? null : (this.getPage(id)?.page ?? null);
  }

  deletePage(id: string): boolean {
    return this.db.raw.prepare("DELETE FROM pages WHERE id=?").run(id).changes > 0;
  }

  addBlock(input: {
    pageId: string;
    type: SpaceBlockType;
    content: string;
    position: number;
    now: string;
  }): SpaceBlock | null {
    if (this.getPage(input.pageId) === null) return null;
    const block = SpaceBlockSchema.parse({
      id: localId("block"),
      pageId: input.pageId,
      type: input.type,
      content: input.content,
      position: input.position,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.db.raw
      .prepare(
        "INSERT INTO blocks(id,page_id,type,content,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        block.id,
        block.pageId,
        block.type,
        block.content,
        block.position,
        block.createdAt,
        block.updatedAt,
      );
    return block;
  }

  updateBlock(
    id: string,
    patch: { type?: SpaceBlockType; content?: string; position?: number },
    now: string,
  ): SpaceBlock | null {
    const row = this.db.raw.prepare("SELECT * FROM blocks WHERE id=?").get(id) as
      BlockRow | undefined;
    if (row === undefined) return null;
    const current = blockFromRow(row);
    const next = SpaceBlockSchema.parse({
      ...current,
      type: patch.type ?? current.type,
      content: patch.content ?? current.content,
      position: patch.position ?? current.position,
      updatedAt: now,
    });
    this.db.raw
      .prepare("UPDATE blocks SET type=?,content=?,position=?,updated_at=? WHERE id=?")
      .run(next.type, next.content, next.position, next.updatedAt, id);
    this.db.raw.prepare("UPDATE pages SET updated_at=? WHERE id=?").run(now, next.pageId);
    return next;
  }

  deleteBlock(id: string): boolean {
    return this.db.raw.prepare("DELETE FROM blocks WHERE id=?").run(id).changes > 0;
  }
}
