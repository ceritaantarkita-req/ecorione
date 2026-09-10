import { PERSONAL_SPACE_WORKSPACE_ID } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { openSpaceDatabase, type SpaceDatabase } from "./db.js";
import { SpaceReferenceError, SpaceStore } from "./store.js";

const dbs: SpaceDatabase[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
});

describe("Space table/view references", () => {
  it("prevents deleting a referenced table until the exact dependent view is removed", () => {
    const db = openSpaceDatabase(":memory:");
    dbs.push(db);
    const store = new SpaceStore(db);
    const now = "2026-09-10T00:00:00.000Z";
    const page = store.createPage({
      workspaceId: PERSONAL_SPACE_WORKSPACE_ID,
      title: "Database page",
      scope: "work",
      now,
    });
    const table = store.addBlock({
      pageId: page.id,
      workspaceId: PERSONAL_SPACE_WORKSPACE_ID,
      body: {
        kind: "table",
        columns: [{ id: "col_name", label: "Name" }],
        rows: [{ id: "row_one", cells: { col_name: "Alice" } }],
      },
      position: 0,
      expectedPageVersion: 1,
      now,
    });
    expect(table).not.toBeNull();
    const view = store.addBlock({
      pageId: page.id,
      workspaceId: PERSONAL_SPACE_WORKSPACE_ID,
      body: { kind: "database-view", sourceBlockId: table!.block.id },
      position: 1,
      expectedPageVersion: 2,
      now,
    });
    expect(view).not.toBeNull();

    expect(() =>
      store.deleteBlock({
        id: table!.block.id,
        workspaceId: PERSONAL_SPACE_WORKSPACE_ID,
        expectedVersion: table!.block.version,
        expectedPageVersion: 3,
        now,
      }),
    ).toThrow(SpaceReferenceError);

    expect(
      store.deleteBlock({
        id: view!.block.id,
        workspaceId: PERSONAL_SPACE_WORKSPACE_ID,
        expectedVersion: view!.block.version,
        expectedPageVersion: 3,
        now,
      }),
    ).toEqual({ pageVersion: 4 });
    expect(
      store.deleteBlock({
        id: table!.block.id,
        workspaceId: PERSONAL_SPACE_WORKSPACE_ID,
        expectedVersion: table!.block.version,
        expectedPageVersion: 4,
        now,
      }),
    ).toEqual({ pageVersion: 5 });
  });
});
