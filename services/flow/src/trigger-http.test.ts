import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openFlowDatabase, type FlowDatabase } from "./db.js";
import { FlowGraphRepository } from "./graph-repository.js";
import { buildFlowServer } from "./http.js";
import type {
  FlowGraphTemporalClient,
  FlowTemporalClient,
  TriggerScheduleTemporalClient,
} from "./temporal-client.js";
import { TriggerRepository } from "./trigger-repository.js";

const NOW = "2026-09-19T07:00:00.000Z" as never;
let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;
let db: FlowDatabase;

function graph(versionName = "Trigger target") {
  return {
    id: "fg_triggerhttp01",
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: versionName,
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

function temporal(): FlowTemporalClient & FlowGraphTemporalClient & TriggerScheduleTemporalClient {
  return {
    start: vi.fn(async () => undefined),
    signal: vi.fn(async () => undefined),
    operationId: vi.fn(async () => "op_triggerhttp" as never),
    describe: vi.fn(async () => ({ status: "RUNNING" as const })),
    startGraph: vi.fn(async () => undefined),
    signalGraphDecision: vi.fn(async () => undefined),
    signalGraphInput: vi.fn(async () => undefined),
    graphState: vi.fn(async (runId) => ({
      runId,
      graphId: "fg_triggerhttp01",
      graphVersion: 1,
      traceOperationId: "op_triggerhttp" as never,
      status: "RUNNING" as const,
      nodes: [],
      output: null,
      error: null,
    })),
    reconcileTimeTrigger: vi.fn(async () => undefined),
    pauseTimeTrigger: vi.fn(async () => undefined),
  };
}

function project(ceiling: "L0" | "L1" | "L2" | "L3" = "L3") {
  return {
    id: "prj_personal",
    workspaceId: "ws_personal",
    name: "Personal",
    description: "",
    instruction: "",
    memoryPolicy: "GLOBAL_PLUS_PROJECT",
    autonomyCeiling: ceiling,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    archivedAt: null,
  };
}

function mockProject(ceiling: "L0" | "L1" | "L2" | "L3" = "L3") {
  agent
    .get("http://hub.local")
    .intercept({
      path: "/v1/projects/prj_personal?workspaceId=ws_personal",
      method: "GET",
    })
    .reply(200, project(ceiling));
}

function mockPolicyAllow() {
  agent
    .get("http://hub.local")
    .intercept({ path: "/v1/actions/evaluate", method: "POST" })
    .reply(200, { outcome: "ALLOW", reason: "test" });
}

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  db = openFlowDatabase(":memory:");
  new FlowGraphRepository(db).create(graph(), NOW);
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await agent.close();
  db.close();
});

function build(temporalClient = temporal()) {
  return {
    temporalClient,
    app: buildFlowServer(temporalClient, {
      hubUrl: "http://hub.local",
      graphRepository: new FlowGraphRepository(db),
      triggerRepository: new TriggerRepository(db),
    }),
  };
}

function manualPayload(enabled = true) {
  return {
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: "Manual Trigger",
    kind: "manual",
    graphId: "fg_triggerhttp01",
    graphVersion: 1,
    versionPolicy: "PINNED",
    requestedAutonomy: "L2",
    enabled,
    configuration: {},
  };
}

describe("PE-03 Trigger HTTP", () => {
  it("fires one pinned manual Trigger exactly once for duplicate caller request", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();

    const created = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: manualPayload(),
    });
    expect(created.statusCode).toBe(201);
    const triggerId = (created.json() as { id: string }).id;

    const graphs = new FlowGraphRepository(db);
    const current = graphs.get("fg_triggerhttp01" as never);
    graphs.save(
      {
        ...current.graph,
        name: "Flow v2 should not move Trigger",
      },
      1,
      "2026-09-19T07:01:00.000Z" as never,
    );

    mockProject();
    mockPolicyAllow();
    const first = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/fire`,
      payload: {
        workspaceId: "ws_personal",
        projectId: "prj_personal",
        requestId: "request-manual-001",
        input: { hello: "world" },
      },
    });
    expect(first.statusCode).toBe(202);
    const firstBody = first.json() as {
      graphVersion: number;
      workflowId: string;
      operationId: string;
      deduplicated: boolean;
    };
    expect(firstBody.graphVersion).toBe(1);
    expect(firstBody.deduplicated).toBe(false);
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
    expect(temporalClient.startGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ graphVersion: 1 }),
        input: { hello: "world" },
      }),
    );

    const second = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/fire`,
      payload: {
        workspaceId: "ws_personal",
        projectId: "prj_personal",
        requestId: "request-manual-001",
        input: { hello: "world" },
      },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      workflowId: firstBody.workflowId,
      operationId: firstBody.operationId,
      deduplicated: true,
    });
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("reconciles a time Trigger with explicit timezone/overlap/catchup configuration", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();

    const res = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: {
        ...manualPayload(),
        name: "Morning",
        kind: "time",
        configuration: {
          cronExpression: "0 8 * * *",
          timezone: "Asia/Jakarta",
          catchupWindowMs: 60_000,
          overlap: "QUEUE_ONE",
        },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      kind: "time",
      graphVersion: 1,
      versionPolicy: "PINNED",
      configuration: {
        timezone: "Asia/Jakarta",
        catchupWindowMs: 60_000,
        overlap: "QUEUE_ONE",
      },
    });
    expect(temporalClient.reconcileTimeTrigger).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("suppresses dispatch when a manual Trigger is disabled", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();
    const created = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: manualPayload(false),
    });
    const triggerId = (created.json() as { id: string }).id;

    const fired = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/fire`,
      payload: {
        workspaceId: "ws_personal",
        projectId: "prj_personal",
        requestId: "request-manual-002",
      },
    });
    expect(fired.statusCode).toBe(400);
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects requested autonomy above the Project ceiling before policy or Temporal", async () => {
    mockProject("L1");
    const { app, temporalClient } = build();
    const res = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: manualPayload(),
    });
    expect(res.statusCode).toBe(400);
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
    expect(temporalClient.reconcileTimeTrigger).not.toHaveBeenCalled();
    await app.close();
  });
});
