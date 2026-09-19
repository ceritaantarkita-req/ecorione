import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openFlowDatabase } from "./db.js";
import { FlowGraphRepository } from "./graph-repository.js";
import {
  TriggerKindConflictError,
  TriggerRepository,
  TriggerRevisionConflictError,
} from "./trigger-repository.js";

const dirs: string[] = [];
const NOW = "2026-09-19T06:00:00.000Z" as never;
const LATER = "2026-09-19T06:01:00.000Z" as never;

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function graph() {
  return {
    id: "fg_triggerrepo01",
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: "Trigger target",
    scope: "personal",
    sensitivity: "INTERNAL",
    maxParallelism: 1,
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
  } as never;
}

function manualCreate() {
  return {
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: "Manual",
    kind: "manual",
    graphId: "fg_triggerrepo01",
    graphVersion: 1,
    versionPolicy: "PINNED",
    requestedAutonomy: "L2",
    enabled: true,
    configuration: {},
  } as const;
}

describe("PE-03 TriggerRepository", () => {
  it("persists definitions across reopen and assigns deterministic schedule identity", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-trigger-"));
    dirs.push(dir);
    const path = join(dir, "flow.sqlite");

    const first = openFlowDatabase(path);
    const graphs = new FlowGraphRepository(first);
    graphs.create(graph(), NOW);
    const repo = new TriggerRepository(first);
    const manual = repo.create(manualCreate() as never, NOW);
    const timed = repo.create(
      {
        ...manualCreate(),
        name: "Time",
        kind: "time",
        configuration: {
          cronExpression: "0 8 * * *",
          timezone: "Asia/Jakarta",
          catchupWindowMs: 60_000,
          overlap: "SKIP",
        },
      } as never,
      NOW,
    );
    expect(manual.temporalScheduleId).toBeNull();
    expect(timed.temporalScheduleId).toBe(`ecorione-trigger-${timed.id}`);
    first.close();

    const second = openFlowDatabase(path);
    try {
      const reopened = new TriggerRepository(second).list(
        "ws_personal" as never,
        "prj_personal" as never,
      );
      expect(reopened.map((item) => item.id).sort()).toEqual([manual.id, timed.id].sort());
    } finally {
      second.close();
    }
  });

  it("uses optimistic revision and keeps kind/Project identity immutable", () => {
    const db = openFlowDatabase(":memory:");
    try {
      new FlowGraphRepository(db).create(graph(), NOW);
      const repo = new TriggerRepository(db);
      const created = repo.create(manualCreate() as never, NOW);
      const updated = repo.update(
        created.id,
        {
          ...manualCreate(),
          name: "Updated",
          expectedRevision: 1,
        } as never,
        LATER,
      );
      expect(updated.revision).toBe(2);
      expect(updated.name).toBe("Updated");

      expect(() =>
        repo.update(
          created.id,
          {
            ...manualCreate(),
            name: "Stale",
            expectedRevision: 1,
          } as never,
          LATER,
        ),
      ).toThrow(TriggerRevisionConflictError);

      expect(() =>
        repo.update(
          created.id,
          {
            ...manualCreate(),
            kind: "time",
            configuration: {
              cronExpression: "0 9 * * *",
              timezone: "Asia/Jakarta",
              catchupWindowMs: 60_000,
              overlap: "SKIP",
            },
            expectedRevision: 2,
          } as never,
          LATER,
        ),
      ).toThrow(TriggerKindConflictError);
    } finally {
      db.close();
    }
  });

  it("deduplicates manual fire by Trigger + caller request identity", () => {
    const db = openFlowDatabase(":memory:");
    try {
      new FlowGraphRepository(db).create(graph(), NOW);
      const repo = new TriggerRepository(db);
      const created = repo.create(manualCreate() as never, NOW);
      const first = repo.recordManualFire(
        created.id,
        "req-manual-001",
        {
          triggerId: created.id,
          graphId: created.graphId,
          graphVersion: 1,
          workflowId: "wf_trigger_aaaaaaaaaaaaaaaaaaaaaaaa",
          operationId: "op_trigger_aaaaaaaaaaaaaaaaaaaaaaaa",
          deduplicated: false,
        } as never,
        NOW,
      );
      const second = repo.recordManualFire(
        created.id,
        "req-manual-001",
        {
          triggerId: created.id,
          graphId: created.graphId,
          graphVersion: 1,
          workflowId: "wf_trigger_bbbbbbbbbbbbbbbbbbbbbbbb",
          operationId: "op_trigger_bbbbbbbbbbbbbbbbbbbbbbbb",
          deduplicated: false,
        } as never,
        LATER,
      );
      expect(first.workflowId).toBe("wf_trigger_aaaaaaaaaaaaaaaaaaaaaaaa");
      expect(second.workflowId).toBe(first.workflowId);
      expect(second.deduplicated).toBe(true);
    } finally {
      db.close();
    }
  });
});
