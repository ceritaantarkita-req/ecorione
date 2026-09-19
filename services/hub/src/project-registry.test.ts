import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_WORKSPACE_ID,
  type Timestamp,
} from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import {
  DefaultProjectArchiveError,
  ProjectRegistry,
  ProjectRequiredError,
  ProjectWorkspaceConflictError,
} from "./project-registry.js";

const NOW = "2026-09-19T00:00:00.000Z" as Timestamp;
const LATER = "2026-09-19T00:01:00.000Z" as Timestamp;
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("PE-01 ProjectRegistry", () => {
  it("seeds Personal exactly once and stays reopen-safe", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-project-"));
    dirs.push(dir);
    const path = join(dir, "hub.sqlite");

    const first = openHubDatabase(path);
    expect(new ProjectRegistry(first).list(DEFAULT_WORKSPACE_ID).map((p) => p.id)).toEqual([
      DEFAULT_PROJECT_ID,
    ]);
    first.close();

    const second = openHubDatabase(path);
    expect(new ProjectRegistry(second).list(DEFAULT_WORKSPACE_ID).map((p) => p.id)).toEqual([
      DEFAULT_PROJECT_ID,
    ]);
    second.close();
  });

  it("creates, lists and archives a Project without moving Workspace authority", () => {
    const db = openHubDatabase();
    try {
      const registry = new ProjectRegistry(db);
      const created = registry.create(
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          name: "Finance",
          description: "",
          instruction: "",
          memoryPolicy: "GLOBAL_PLUS_PROJECT",
          autonomyCeiling: "L3",
        },
        NOW,
      );
      expect(registry.list(DEFAULT_WORKSPACE_ID).map((p) => p.id)).toContain(created.id);
      expect(() =>
        registry.require(created.id, "ws_other" as never),
      ).toThrow(ProjectWorkspaceConflictError);

      const archived = registry.archive(created.id, DEFAULT_WORKSPACE_ID, LATER);
      expect(archived.archivedAt).toBe(LATER);
      expect(registry.list(DEFAULT_WORKSPACE_ID).map((p) => p.id)).not.toContain(created.id);
    } finally {
      db.close();
    }
  });

  it("keeps Personal non-archivable and requires explicit Project outside Personal Workspace", () => {
    const db = openHubDatabase();
    try {
      const registry = new ProjectRegistry(db);
      expect(() =>
        registry.archive(DEFAULT_PROJECT_ID, DEFAULT_WORKSPACE_ID, NOW),
      ).toThrow(DefaultProjectArchiveError);
      expect(registry.resolve({}).project.id).toBe(DEFAULT_PROJECT_ID);
      expect(() =>
        registry.resolve({ workspaceId: "ws_other" as never }),
      ).toThrow(ProjectRequiredError);
    } finally {
      db.close();
    }
  });
});
