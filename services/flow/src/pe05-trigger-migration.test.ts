import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openFlowDatabase } from "./db.js";
import { SqliteConstructor } from "./sqlite.js";
import { TriggerRepository } from "./trigger-repository.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("PE-05 Trigger kind migration", () => {
  it("upgrades the PE-03 manual/time table without losing definitions or fire receipts", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-pe05-trigger-"));
    dirs.push(dir);
    const path = join(dir, "flow.sqlite");
    const legacy = new SqliteConstructor(path);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE flow_graphs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        name TEXT NOT NULL,
        scope TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        current_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE flow_graph_versions (
        graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        digest TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        validation_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(graph_id, version)
      );
      CREATE TABLE triggers (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('manual','time')),
        graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE RESTRICT,
        graph_version INTEGER NOT NULL,
        version_policy TEXT NOT NULL CHECK(version_policy='PINNED'),
        requested_autonomy TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        configuration_json TEXT NOT NULL,
        temporal_schedule_id TEXT,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE trigger_manual_fires (
        trigger_id TEXT NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
        request_id TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        graph_id TEXT NOT NULL,
        graph_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(trigger_id, request_id)
      );
      INSERT INTO flow_graphs
        (id,workspace_id,project_id,name,scope,sensitivity,current_version,created_at,updated_at)
      VALUES
        ('fg_pe05legacy01','ws_personal','prj_personal','Legacy','personal','INTERNAL',1,
         '2026-09-19T00:00:00.000Z','2026-09-19T00:00:00.000Z');
      INSERT INTO triggers
        (id,workspace_id,project_id,name,kind,graph_id,graph_version,version_policy,
         requested_autonomy,enabled,configuration_json,temporal_schedule_id,revision,created_at,updated_at)
      VALUES
        ('trg_pe05legacy01','ws_personal','prj_personal','Legacy manual','manual',
         'fg_pe05legacy01',1,'PINNED','L2',1,'{}',NULL,1,
         '2026-09-19T00:00:00.000Z','2026-09-19T00:00:00.000Z');
      INSERT INTO trigger_manual_fires
        (trigger_id,request_id,workflow_id,operation_id,graph_id,graph_version,created_at)
      VALUES
        ('trg_pe05legacy01','request-legacy-001','wf_pe05legacy01','op_pe05legacy01',
         'fg_pe05legacy01',1,'2026-09-19T00:01:00.000Z');
    `);
    legacy.close();

    const db = openFlowDatabase(path);
    try {
      const repo = new TriggerRepository(db);
      expect(repo.require("trg_pe05legacy01" as never).kind).toBe("manual");
      expect(
        repo.getManualFire("trg_pe05legacy01" as never, "request-legacy-001"),
      ).toMatchObject({
        workflowId: "wf_pe05legacy01",
        operationId: "op_pe05legacy01",
        deduplicated: true,
      });

      const webhook = repo.create(
        {
          workspaceId: "ws_personal",
          projectId: "prj_personal",
          name: "Migrated webhook",
          kind: "webhook",
          graphId: "fg_pe05legacy01",
          graphVersion: 1,
          versionPolicy: "PINNED",
          requestedAutonomy: "L2",
          enabled: true,
          configuration: {
            adapter: "generic",
            hookId: "hook_migrated_001",
            source: "github",
            eventKind: "push",
          },
        } as never,
        "2026-09-19T01:00:00.000Z" as never,
      );
      expect(webhook.kind).toBe("webhook");
      expect(db.raw.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
