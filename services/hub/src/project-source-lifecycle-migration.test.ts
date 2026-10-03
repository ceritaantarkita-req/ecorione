import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { SqliteConstructor } from "./sqlite.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Project external source lifecycle migration", () => {
  it("preserves existing rows and expands the source-type constraint for Google Drive", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-hub-drive-migration-"));
    dirs.push(dir);
    const path = join(dir, "hub.sqlite");
    const legacy = new SqliteConstructor(path);
    legacy.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        instruction TEXT NOT NULL DEFAULT '',
        memory_policy TEXT NOT NULL DEFAULT 'GLOBAL_PLUS_PROJECT'
          CHECK(memory_policy='GLOBAL_PLUS_PROJECT'),
        autonomy_ceiling TEXT NOT NULL DEFAULT 'L3'
          CHECK(autonomy_ceiling IN ('L0','L1','L2','L3')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );
      INSERT INTO projects
        (id,workspace_id,name,description,instruction,memory_policy,autonomy_ceiling,
         created_at,updated_at,archived_at)
      VALUES
        ('prj_personal','ws_personal','Personal','','','GLOBAL_PLUS_PROJECT','L3',
         '2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z',NULL);

      CREATE TABLE project_external_source_lifecycle (
        project_id TEXT NOT NULL REFERENCES projects(id),
        workspace_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('url','mcp-resource')),
        source_key TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('source','reference')),
        latest_artifact_id TEXT NOT NULL,
        latest_context_episode_id TEXT,
        state TEXT NOT NULL CHECK(state IN ('SNAPSHOT_READY','INDEXED','DETACHED')),
        last_refreshed_at TEXT NOT NULL,
        last_indexed_at TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, source_type, source_key, role)
      );
      CREATE INDEX idx_project_external_source_lifecycle_project
        ON project_external_source_lifecycle(
          workspace_id, project_id, updated_at DESC, source_type, source_key
        );
      INSERT INTO project_external_source_lifecycle
        (project_id,workspace_id,source_type,source_key,role,latest_artifact_id,
         latest_context_episode_id,state,last_refreshed_at,last_indexed_at,updated_at)
      VALUES
        ('prj_personal','ws_personal','url','https://example.com/source','source',
         'art_legacy',NULL,'SNAPSHOT_READY','2026-10-01T00:00:00.000Z',NULL,
         '2026-10-01T00:00:00.000Z');
    `);
    legacy.close();

    const db = openHubDatabase(path);
    const definition = db.raw
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='project_external_source_lifecycle'",
      )
      .get() as { sql: string };
    expect(definition.sql).toContain("'google-drive'");

    expect(
      db.raw
        .prepare(
          "SELECT source_type,source_key,latest_artifact_id,state FROM project_external_source_lifecycle",
        )
        .all(),
    ).toEqual([
      {
        source_type: "url",
        source_key: "https://example.com/source",
        latest_artifact_id: "art_legacy",
        state: "SNAPSHOT_READY",
      },
    ]);

    expect(() =>
      db.raw
        .prepare(
          `INSERT INTO project_external_source_lifecycle
           (project_id,workspace_id,source_type,source_key,role,latest_artifact_id,
            latest_context_episode_id,state,last_refreshed_at,last_indexed_at,updated_at)
           VALUES (?,?,?,?,?,?,NULL,'SNAPSHOT_READY',?,NULL,?)`,
        )
        .run(
          "prj_personal",
          "ws_personal",
          "google-drive",
          "file-123",
          "source",
          "art_drive",
          "2026-10-03T00:00:00.000Z",
          "2026-10-03T00:00:00.000Z",
        ),
    ).not.toThrow();
    db.close();
  });
});
