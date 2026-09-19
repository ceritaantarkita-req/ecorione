import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openFlowDatabase, type FlowDatabase } from "./db.js";
import {
  getRunProjection,
  listRunProjections,
  type RunProjectionDependencies,
} from "./run-projection.js";
import type { FlowServerTemporalClient } from "./temporal-client.js";
import { TriggerRepository } from "./trigger-repository.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;
let db: FlowDatabase;

function trace(
  operationId: string,
  projectId: string,
  runId: string,
  name: string,
  recordedAt: string,
  extra: Record<string, string | number | boolean | string[]> = {},
) {
  return {
    id: `span_${operationId}_${name.replaceAll(".", "_")}`,
    name,
    operationId,
    traceId: null,
    recordedAt,
    attributes: {
      workspaceId: "ws_personal",
      projectId,
      graphId: projectId === "prj_alpha" ? "fg_runalpha01" : "fg_runbeta01",
      graphVersion: 1,
      runId,
      ...extra,
    },
  };
}

function temporal(
  status: "RUNNING" | "COMPLETED" | "FAILED" = "COMPLETED",
): FlowServerTemporalClient {
  return {
    start: vi.fn(async () => undefined),
    signal: vi.fn(async () => undefined),
    operationId: vi.fn(async () => "op_legacy001" as never),
    describe: vi.fn(async () => ({ status })),
    graphState: vi.fn(async (runId) => ({
      runId,
      graphId: "fg_runalpha01",
      graphVersion: 1,
      traceOperationId: "op_runalpha001" as never,
      status,
      nodes: [],
      output: { ok: true },
      error: status === "FAILED" ? "graph failed" : null,
    })),
  };
}

function deps(client = temporal()): RunProjectionDependencies {
  return {
    triggers: new TriggerRepository(db),
    temporal: client,
    options: {
      rndUrl: "http://rnd.local",
      hubUrl: "http://hub.local",
    },
  };
}

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  db = openFlowDatabase(":memory:");
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await agent.close();
  db.close();
});

describe("PE-04 Run projection", () => {
  it("discovers recent runs from lifecycle evidence and isolates Project A/B", async () => {
    agent
      .get("http://rnd.local")
      .intercept({ path: "/v1/traces?limit=200", method: "GET" })
      .reply(200, {
        traces: [
          trace(
            "op_runbeta001",
            "prj_beta",
            "wf_runbeta001",
            "flow.graph.run.started",
            "2026-09-19T08:02:00.000Z",
          ),
          trace(
            "op_runalpha001",
            "prj_alpha",
            "wf_runalpha001",
            "flow.graph.run.completed",
            "2026-09-19T08:01:00.000Z",
          ),
          trace(
            "op_runalpha001",
            "prj_alpha",
            "wf_runalpha001",
            "flow.graph.run.started",
            "2026-09-19T08:00:00.000Z",
          ),
        ],
      });

    const runs = await listRunProjections(deps(), {
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      limit: 10,
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      operationId: "op_runalpha001",
      projectId: "prj_alpha",
      temporalWorkflowId: "wf_runalpha001",
      status: "COMPLETED",
      startedAt: "2026-09-19T08:00:00.000Z",
      finishedAt: "2026-09-19T08:01:00.000Z",
    });
  });

  it("rebuilds Run detail from RnD + Temporal + root/child Hub audit", async () => {
    const operationId = "op_runalpha001";
    agent
      .get("http://rnd.local")
      .intercept({
        path: `/v1/traces?operationId=${operationId}&limit=1000`,
        method: "GET",
      })
      .reply(200, {
        traces: [
          trace(
            operationId,
            "prj_alpha",
            "wf_runalpha001",
            "flow.graph.run.completed",
            "2026-09-19T08:01:00.000Z",
          ),
          trace(
            operationId,
            "prj_alpha",
            "wf_runalpha001",
            "flow.graph.run.started",
            "2026-09-19T08:00:00.000Z",
          ),
        ],
      });
    agent
      .get("http://rnd.local")
      .intercept({
        path: `/v1/traces/summary?operationId=${operationId}`,
        method: "GET",
      })
      .reply(200, {
        callCount: 1,
        totalActualUsd: 0.01,
        totalNaiveUsd: 0.02,
        totalSavedUsd: 0.01,
      });
    agent
      .get("http://hub.local")
      .intercept({
        path: `/v1/audit?operationPrefix=${operationId}`,
        method: "GET",
      })
      .reply(200, {
        events: [
          {
            id: "evt_runapproval001",
            ts: "2026-09-19T08:00:10.000Z",
            type: "APPROVAL_REQUESTED",
            operationId: "op_runalpha001-node_approval1",
            module: "Flow",
            detail: { prompt: "Approve?" },
            ruleId: null,
          },
          {
            id: "evt_runapproval002",
            ts: "2026-09-19T08:00:20.000Z",
            type: "APPROVAL_DECIDED",
            operationId: "op_runalpha001-node_approval1",
            module: "Flow",
            detail: { decision: "APPROVE", note: "ok" },
            ruleId: null,
          },
        ],
      });

    const run = await getRunProjection(deps(), operationId as never);
    expect(run).toMatchObject({
      operationId,
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      graphId: "fg_runalpha01",
      graphVersion: 1,
      temporalWorkflowId: "wf_runalpha001",
      status: "COMPLETED",
      output: { ok: true },
      cost: {
        callCount: 1,
        totalActualUsd: 0.01,
        totalNaiveUsd: 0.02,
        totalSavedUsd: 0.01,
      },
      availability: {
        temporal: true,
        rnd: true,
        hubAudit: true,
        trigger: true,
      },
    });
    expect(run?.approvals).toEqual([
      expect.objectContaining({
        operationId: "op_runalpha001-node_approval1",
        status: "APPROVE",
        prompt: "Approve?",
        note: "ok",
      }),
    ]);
  });

  it("returns explicit partial availability when Temporal and Hub audit are unavailable", async () => {
    const operationId = "op_runalpha002";
    agent
      .get("http://rnd.local")
      .intercept({
        path: `/v1/traces?operationId=${operationId}&limit=1000`,
        method: "GET",
      })
      .reply(200, {
        traces: [
          trace(
            operationId,
            "prj_alpha",
            "wf_runalpha002",
            "flow.graph.run.failed",
            "2026-09-19T09:01:00.000Z",
            { error: "owner failed" },
          ),
          trace(
            operationId,
            "prj_alpha",
            "wf_runalpha002",
            "flow.graph.run.started",
            "2026-09-19T09:00:00.000Z",
          ),
        ],
      });
    agent
      .get("http://rnd.local")
      .intercept({
        path: `/v1/traces/summary?operationId=${operationId}`,
        method: "GET",
      })
      .reply(200, {
        callCount: 0,
        totalActualUsd: 0,
        totalNaiveUsd: 0,
        totalSavedUsd: 0,
      });
    agent
      .get("http://hub.local")
      .intercept({
        path: `/v1/audit?operationPrefix=${operationId}`,
        method: "GET",
      })
      .replyWithError(new Error("hub unavailable"));

    const client = temporal();
    vi.mocked(client.describe).mockRejectedValue(new Error("temporal unavailable"));
    const run = await getRunProjection(deps(client), operationId as never);

    expect(run).toMatchObject({
      status: "FAILED",
      errors: ["owner failed"],
      availability: {
        temporal: false,
        rnd: true,
        hubAudit: false,
        trigger: true,
      },
    });
  });
});
