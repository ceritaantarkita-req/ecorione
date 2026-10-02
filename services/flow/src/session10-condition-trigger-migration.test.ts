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

describe("Session 10 Condition Trigger migration", () => {
  it("upgrades a PE-05 trigger table without losing existing definitions or event receipts", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-condition-trigger-"));
    dirs.push(dir);
    const path = join(dir, "flow.sqlite");
    const legacy = new SqliteConstructor(path);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE flow_graphs (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT,
        name TEXT NOT NULL, scope TEXT NOT NULL, sensitivity TEXT NOT NULL,
        current_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE flow_graph_versions (
        graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE CASCADE,
        version INTEGER NOT NULL, digest TEXT NOT NULL, graph_json TEXT NOT NULL,
        validation_json TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(graph_id, version)
      );
      CREATE TABLE triggers (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('manual','time','event','webhook')),
        graph_id TEXT NOT NULL REFERENCES flow_graphs(id) ON DELETE RESTRICT,
        graph_version INTEGER NOT NULL, version_policy TEXT NOT NULL CHECK(version_policy='PINNED'),
        requested_autonomy TEXT NOT NULL, enabled INTEGER NOT NULL,
        configuration_json TEXT NOT NULL, temporal_schedule_id TEXT,
        revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE trigger_manual_fires (
        trigger_id TEXT NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
        request_id TEXT NOT NULL, workflow_id TEXT NOT NULL, operation_id TEXT NOT NULL,
        graph_id TEXT NOT NULL, graph_version INTEGER NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(trigger_id, request_id)
      );
      CREATE TABLE trigger_event_deliveries (
        trigger_id TEXT NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
        dedupe_key TEXT NOT NULL, event_id TEXT NOT NULL, event_digest TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('PENDING','STARTED')),
        workflow_id TEXT NOT NULL, operation_id TEXT NOT NULL, graph_id TEXT NOT NULL,
        graph_version INTEGER NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY(trigger_id, dedupe_key)
      );
      INSERT INTO flow_graphs
        (id,workspace_id,project_id,name,scope,sensitivity,current_version,created_at,updated_at)
      VALUES
        ('fg_conditionlegacy01','ws_personal','prj_personal','Legacy','personal','INTERNAL',1,
         '2026-10-02T00:00:00.000Z','2026-10-02T00:00:00.000Z');
      INSERT INTO triggers
        (id,workspace_id,project_id,name,kind,graph_id,graph_version,version_policy,
         requested_autonomy,enabled,configuration_json,temporal_schedule_id,revision,created_at,updated_at)
      VALUES
        ('trg_conditionlegacy01','ws_personal','prj_personal','Legacy event','event',
         'fg_conditionlegacy01',1,'PINNED','L2',1,
         '{"source":"github","eventKind":"push"}',NULL,1,
         '2026-10-02T00:00:00.000Z','2026-10-02T00:00:00.000Z');
      INSERT INTO trigger_event_deliveries
        (trigger_id,dedupe_key,event_id,event_digest,state,workflow_id,operation_id,
         graph_id,graph_version,created_at)
      VALUES
        ('trg_conditionlegacy01','github:legacy-001','evt_conditionlegacy01',
         'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','STARTED',
         'wf_conditionlegacy01','op_conditionlegacy01','fg_conditionlegacy01',1,
         '2026-10-02T00:01:00.000Z');
    `);
    legacy.close();

    const db = openFlowDatabase(path);
    try {
      const repo = new TriggerRepository(db);
      expect(repo.require("trg_conditionlegacy01" as never).kind).toBe("event");
      expect(
        db.raw
          .prepare("SELECT state FROM trigger_event_deliveries WHERE trigger_id=?")
          .get("trg_conditionlegacy01"),
      ).toEqual({ state: "STARTED" });

      const condition = repo.create(
        {
          workspaceId: "ws_personal",
          projectId: "prj_personal",
          name: "Score gate",
          kind: "condition",
          graphId: "fg_conditionlegacy01",
          graphVersion: 1,
          versionPolicy: "PINNED",
          requestedAutonomy: "L2",
          enabled: true,
          configuration: {
            source: "github",
            eventKind: "push",
            predicate: { field: "payload.score", operator: "GTE", value: 80 },
          },
        } as never,
        "2026-10-02T01:00:00.000Z" as never,
      );
      expect(condition.kind).toBe("condition");
      expect(condition.temporalScheduleId).toBeNull();
      expect(db.raw.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
