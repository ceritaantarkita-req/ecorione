import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openFlowDatabase } from "./db.js";
import { FlowGraphRepository } from "./graph-repository.js";
import { SqliteConstructor } from "./sqlite.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("PE-01 Flow Project migration", () => {
  it("maps legacy ws_personal graph metadata to prj_personal without rewriting version JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-flow-project-"));
    dirs.push(dir);
    const path = join(dir, "flow.sqlite");

    const legacy = new SqliteConstructor(path);
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE flow_graphs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
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
    `);
    const graph = {
      id: "fg_legacy_personal",
      workspaceId: "ws_personal",
      name: "Legacy Personal",
      scope: "personal",
      sensitivity: "INTERNAL",
      maxParallelism: 4,
      nodes: [
        {
          id: "node_trigger1",
          kind: "trigger",
          version: 1,
          label: "Trigger",
          position: { x: 0, y: 0 },
          config: {},
          secretRefs: [],
          limits: {},
          retry: {},
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    legacy
      .prepare(
        "INSERT INTO flow_graphs(id,workspace_id,name,scope,sensitivity,current_version,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)",
      )
      .run(
        graph.id,
        graph.workspaceId,
        graph.name,
        graph.scope,
        graph.sensitivity,
        "2026-09-10T00:00:00.000Z",
        "2026-09-10T00:00:00.000Z",
      );
    legacy
      .prepare(
        "INSERT INTO flow_graph_versions(graph_id,version,digest,graph_json,validation_json,created_at) VALUES(?,1,?,?,?,?)",
      )
      .run(
        graph.id,
        "a".repeat(64),
        JSON.stringify(graph),
        JSON.stringify({ valid: false, issues: [], plan: null }),
        "2026-09-10T00:00:00.000Z",
      );
    legacy.close();

    const db = openFlowDatabase(path);
    try {
      const repo = new FlowGraphRepository(db);
      const loaded = repo.get("fg_legacy_personal");
      expect(loaded.graph.projectId).toBe("prj_personal");

      const raw = db.raw
        .prepare("SELECT graph_json FROM flow_graph_versions WHERE graph_id=? AND version=1")
        .get(graph.id) as { graph_json: string };
      expect(JSON.parse(raw.graph_json)).not.toHaveProperty("projectId");
    } finally {
      db.close();
    }
  });
});
