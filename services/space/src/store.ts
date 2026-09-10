import { randomUUID } from "node:crypto";
import {
  SpaceBlockBodySchema,
  SpaceBlockSchema,
  SpaceDocumentSchema,
  SpacePageSchema,
  type Scope,
  type SpaceBlock,
  type SpaceBlockBody,
  type SpaceBlockId,
  type SpaceDocument,
  type SpacePage,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { SpaceDatabase } from "./db.js";

interface PageRow {
  id: string;
  workspace_id: string;
  title: string;
  scope: string;
  version: number;
  created_at: string;
  updated_at: string;
}
interface BlockRow {
  id: string;
  page_id: string;
  workspace_id: string;
  type: string;
  content_json: string;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
}
interface BlockContentRow {
  content_json: string;
}

export class SpaceVersionConflictError extends Error {
  constructor(message = "Space version berubah; refresh dokumen sebelum menulis ulang.") {
    super(message);
    this.name = "SpaceVersionConflictError";
  }
}
export class SpaceReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpaceReferenceError";
  }
}

function localId(prefix: "page" | "block"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}
function pageFromRow(row: PageRow): SpacePage {
  return SpacePageSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    scope: row.scope,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
function blockFromRow(row: BlockRow): SpaceBlock {
  const body = SpaceBlockBodySchema.parse(JSON.parse(row.content_json) as unknown);
  return SpaceBlockSchema.parse({
    id: row.id,
    pageId: row.page_id,
    workspaceId: row.workspace_id,
    type: row.type,
    body,
    position: row.position,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class SpaceStore {
  constructor(private readonly db: SpaceDatabase) {}

  createPage(input: {
    workspaceId: WorkspaceId;
    title: string;
    scope: Scope;
    now: string;
  }): SpacePage {
    const page = SpacePageSchema.parse({
      id: localId("page"),
      workspaceId: input.workspaceId,
      title: input.title,
      scope: input.scope,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.db.raw
      .prepare(
        "INSERT INTO pages(id,workspace_id,title,scope,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        page.id,
        page.workspaceId,
        page.title,
        page.scope,
        page.version,
        page.createdAt,
        page.updatedAt,
      );
    return page;
  }

  listPages(input: { workspaceId: WorkspaceId; scope?: Scope | undefined }): SpacePage[] {
    const rows = (
      input.scope === undefined
        ? this.db.raw
            .prepare("SELECT * FROM pages WHERE workspace_id=? ORDER BY updated_at DESC,id ASC")
            .all(input.workspaceId)
        : this.db.raw
            .prepare(
              "SELECT * FROM pages WHERE workspace_id=? AND scope=? ORDER BY updated_at DESC,id ASC",
            )
            .all(input.workspaceId, input.scope)
    ) as PageRow[];
    return rows.map(pageFromRow);
  }

  getPage(id: string, workspaceId: WorkspaceId): SpaceDocument | null {
    const row = this.db.raw
      .prepare("SELECT * FROM pages WHERE id=? AND workspace_id=?")
      .get(id, workspaceId) as PageRow | undefined;
    if (row === undefined) return null;
    const blocks = this.db.raw
      .prepare(
        `SELECT b.*,p.workspace_id FROM blocks b JOIN pages p ON p.id=b.page_id
         WHERE b.page_id=? AND p.workspace_id=? ORDER BY b.position ASC,b.id ASC`,
      )
      .all(id, workspaceId) as BlockRow[];
    return SpaceDocumentSchema.parse({ page: pageFromRow(row), blocks: blocks.map(blockFromRow) });
  }

  getBlock(
    id: string,
    workspaceId: WorkspaceId,
  ): { page: SpacePage; block: SpaceBlock } | null {
    const row = this.db.raw
      .prepare(
        `SELECT b.*,p.workspace_id FROM blocks b JOIN pages p ON p.id=b.page_id
         WHERE b.id=? AND p.workspace_id=?`,
      )
      .get(id, workspaceId) as BlockRow | undefined;
    if (row === undefined) return null;
    const pageRow = this.db.raw
      .prepare("SELECT * FROM pages WHERE id=? AND workspace_id=?")
      .get(row.page_id, workspaceId) as PageRow | undefined;
    if (pageRow === undefined) return null;
    return { page: pageFromRow(pageRow), block: blockFromRow(row) };
  }

  renamePage(input: {
    id: string;
    workspaceId: WorkspaceId;
    title: string;
    expectedVersion: number;
    now: string;
  }): SpacePage | null {
    const result = this.db.raw
      .prepare(
        `UPDATE pages SET title=?,version=version+1,updated_at=?
         WHERE id=? AND workspace_id=? AND version=?`,
      )
      .run(input.title, input.now, input.id, input.workspaceId, input.expectedVersion);
    if (result.changes === 0) {
      const exists = this.db.raw
        .prepare("SELECT 1 FROM pages WHERE id=? AND workspace_id=?")
        .get(input.id, input.workspaceId);
      if (exists === undefined) return null;
      throw new SpaceVersionConflictError();
    }
    return this.getPage(input.id, input.workspaceId)?.page ?? null;
  }

  deletePage(input: {
    id: string;
    workspaceId: WorkspaceId;
    expectedVersion: number;
  }): boolean {
    const result = this.db.raw
      .prepare("DELETE FROM pages WHERE id=? AND workspace_id=? AND version=?")
      .run(input.id, input.workspaceId, input.expectedVersion);
    if (result.changes > 0) return true;
    const exists = this.db.raw
      .prepare("SELECT 1 FROM pages WHERE id=? AND workspace_id=?")
      .get(input.id, input.workspaceId);
    if (exists !== undefined) throw new SpaceVersionConflictError();
    return false;
  }

  private assertDatabaseViewSource(pageId: string, body: SpaceBlockBody): void {
    if (body.kind !== "database-view") return;
    const source = this.db.raw
      .prepare("SELECT type FROM blocks WHERE id=? AND page_id=?")
      .get(body.sourceBlockId, pageId) as { type: string } | undefined;
    if (source === undefined || source.type !== "table") {
      throw new SpaceReferenceError("database-view harus menunjuk table block pada page yang sama.");
    }
  }

  private hasDatabaseViewDependency(pageId: string, blockId: string): boolean {
    const rows = this.db.raw
      .prepare("SELECT content_json FROM blocks WHERE page_id=? AND type='database-view'")
      .all(pageId) as BlockContentRow[];
    return rows.some((row) => {
      const body = SpaceBlockBodySchema.parse(JSON.parse(row.content_json) as unknown);
      return body.kind === "database-view" && body.sourceBlockId === blockId;
    });
  }

  addBlock(input: {
    pageId: string;
    workspaceId: WorkspaceId;
    body: SpaceBlockBody;
    position: number;
    expectedPageVersion: number;
    now: string;
  }): { block: SpaceBlock; pageVersion: number } | null {
    return this.db.raw.transaction(() => {
      const pageRow = this.db.raw
        .prepare("SELECT * FROM pages WHERE id=? AND workspace_id=?")
        .get(input.pageId, input.workspaceId) as PageRow | undefined;
      if (pageRow === undefined) return null;
      if (pageRow.version !== input.expectedPageVersion) throw new SpaceVersionConflictError();
      this.assertDatabaseViewSource(input.pageId, input.body);
      const count = (
        this.db.raw.prepare("SELECT COUNT(*) AS n FROM blocks WHERE page_id=?").get(input.pageId) as {
          n: number;
        }
      ).n;
      const position = Math.min(input.position, count);
      this.db.raw
        .prepare("UPDATE blocks SET position=position+1 WHERE page_id=? AND position>=?")
        .run(input.pageId, position);
      const block = SpaceBlockSchema.parse({
        id: localId("block"),
        pageId: input.pageId,
        workspaceId: input.workspaceId,
        type: input.body.kind,
        body: input.body,
        position,
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      });
      this.db.raw
        .prepare(
          `INSERT INTO blocks(id,page_id,type,content_json,position,version,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?)`,
        )
        .run(
          block.id,
          block.pageId,
          block.type,
          JSON.stringify(block.body),
          block.position,
          block.version,
          block.createdAt,
          block.updatedAt,
        );
      const bumped = this.db.raw
        .prepare(
          "UPDATE pages SET version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?",
        )
        .run(input.now, input.pageId, input.workspaceId, input.expectedPageVersion);
      if (bumped.changes !== 1) throw new SpaceVersionConflictError();
      return { block, pageVersion: input.expectedPageVersion + 1 };
    })();
  }

  updateBlock(input: {
    id: string;
    workspaceId: WorkspaceId;
    body?: SpaceBlockBody | undefined;
    position?: number | undefined;
    expectedVersion: number;
    expectedPageVersion: number;
    now: string;
  }): { block: SpaceBlock; pageVersion: number } | null {
    return this.db.raw.transaction(() => {
      const current = this.getBlock(input.id, input.workspaceId);
      if (current === null) return null;
      if (
        current.block.version !== input.expectedVersion ||
        current.page.version !== input.expectedPageVersion
      ) {
        throw new SpaceVersionConflictError();
      }
      const body = input.body ?? current.block.body;
      this.assertDatabaseViewSource(current.page.id, body);
      const count = (
        this.db.raw.prepare("SELECT COUNT(*) AS n FROM blocks WHERE page_id=?").get(current.page.id) as {
          n: number;
        }
      ).n;
      const target = Math.min(input.position ?? current.block.position, Math.max(0, count - 1));
      if (target < current.block.position) {
        this.db.raw
          .prepare(
            `UPDATE blocks SET position=position+1
             WHERE page_id=? AND position>=? AND position<? AND id<>?`,
          )
          .run(current.page.id, target, current.block.position, input.id);
      } else if (target > current.block.position) {
        this.db.raw
          .prepare(
            `UPDATE blocks SET position=position-1
             WHERE page_id=? AND position>? AND position<=? AND id<>?`,
          )
          .run(current.page.id, current.block.position, target, input.id);
      }
      const result = this.db.raw
        .prepare(
          `UPDATE blocks SET type=?,content_json=?,position=?,version=version+1,updated_at=?
           WHERE id=? AND version=?`,
        )
        .run(body.kind, JSON.stringify(body), target, input.now, input.id, input.expectedVersion);
      if (result.changes !== 1) throw new SpaceVersionConflictError();
      const bumped = this.db.raw
        .prepare(
          "UPDATE pages SET version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?",
        )
        .run(input.now, current.page.id, input.workspaceId, input.expectedPageVersion);
      if (bumped.changes !== 1) throw new SpaceVersionConflictError();
      const next = this.getBlock(input.id, input.workspaceId);
      if (next === null) throw new Error("Block hilang setelah update atomik.");
      return { block: next.block, pageVersion: input.expectedPageVersion + 1 };
    })();
  }

  deleteBlock(input: {
    id: string;
    workspaceId: WorkspaceId;
    expectedVersion: number;
    expectedPageVersion: number;
    now: string;
  }): { pageVersion: number } | null {
    return this.db.raw.transaction(() => {
      const current = this.getBlock(input.id, input.workspaceId);
      if (current === null) return null;
      if (
        current.block.version !== input.expectedVersion ||
        current.page.version !== input.expectedPageVersion
      ) {
        throw new SpaceVersionConflictError();
      }
      if (current.block.type === "table" && this.hasDatabaseViewDependency(current.page.id, input.id)) {
        throw new SpaceReferenceError("Table block masih dipakai database-view; hapus view lebih dulu.");
      }
      const deleted = this.db.raw
        .prepare("DELETE FROM blocks WHERE id=? AND version=?")
        .run(input.id, input.expectedVersion);
      if (deleted.changes !== 1) throw new SpaceVersionConflictError();
      this.db.raw
        .prepare("UPDATE blocks SET position=position-1 WHERE page_id=? AND position>?")
        .run(current.page.id, current.block.position);
      const bumped = this.db.raw
        .prepare(
          "UPDATE pages SET version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?",
        )
        .run(input.now, current.page.id, input.workspaceId, input.expectedPageVersion);
      if (bumped.changes !== 1) throw new SpaceVersionConflictError();
      return { pageVersion: input.expectedPageVersion + 1 };
    })();
  }

  reorderBlocks(input: {
    pageId: string;
    workspaceId: WorkspaceId;
    blockIds: readonly SpaceBlockId[];
    expectedPageVersion: number;
    now: string;
  }): SpaceDocument | null {
    return this.db.raw.transaction(() => {
      const document = this.getPage(input.pageId, input.workspaceId);
      if (document === null) return null;
      if (document.page.version !== input.expectedPageVersion) throw new SpaceVersionConflictError();
      const current = document.blocks.map((block) => block.id).sort();
      const requested = [...input.blockIds].sort();
      if (
        current.length !== requested.length ||
        current.some((id, index) => id !== requested[index])
      ) {
        throw new SpaceReferenceError("Reorder wajib memuat tepat seluruh block pada page.");
      }
      const seen = new Set(input.blockIds);
      if (seen.size !== input.blockIds.length) {
        throw new SpaceReferenceError("Reorder tidak menerima block id duplikat.");
      }
      const update = this.db.raw.prepare(
        "UPDATE blocks SET position=?,updated_at=? WHERE id=? AND page_id=?",
      );
      input.blockIds.forEach((id, position) => update.run(position, input.now, id, input.pageId));
      const bumped = this.db.raw
        .prepare(
          "UPDATE pages SET version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?",
        )
        .run(input.now, input.pageId, input.workspaceId, input.expectedPageVersion);
      if (bumped.changes !== 1) throw new SpaceVersionConflictError();
      return this.getPage(input.pageId, input.workspaceId);
    })();
  }
}
