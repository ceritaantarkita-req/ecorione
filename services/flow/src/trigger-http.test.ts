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

function temporal(): FlowTemporalClient &
  FlowGraphTemporalClient &
  TriggerScheduleTemporalClient {
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
    describeTimeTrigger: vi.fn(async (trigger) => ({
      triggerId: trigger.id,
      scheduleId: trigger.temporalScheduleId!,
      paused: !trigger.enabled,
      nextActionTimes: ["2026-09-20T01:00:00.000Z"],
      recentActionCount: 2,
    })),
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


function eventPayload(enabled = true) {
  return {
    ...manualPayload(enabled),
    name: "Event Trigger",
    kind: "event",
    configuration: { source: "github", eventKind: "push" },
  };
}

function webhookPayload(hookId = "hook_ecorione_001", enabled = true) {
  return {
    ...manualPayload(enabled),
    name: "Webhook Trigger",
    kind: "webhook",
    configuration: {
      adapter: "generic",
      hookId,
      source: "github",
      eventKind: "push",
    },
  };
}

function normalizedEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_delivery001",
    source: "github",
    kind: "push",
    occurredAt: "2026-09-19T10:00:00.000Z",
    receivedAt: "2026-09-19T10:00:01.000Z",
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    dedupeKey: "github:delivery-001",
    payload: { ref: "refs/heads/main" },
    metadata: {},
    ...overrides,
  };
}

describe("PE-03/PE-05 Trigger HTTP", () => {
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
        autonomy: "L2",
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

  it("rejects manual dispatch when Hub policy denies before Temporal", async () => {
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

    mockProject();
    agent
      .get("http://hub.local")
      .intercept({ path: "/v1/actions/evaluate", method: "POST" })
      .reply(200, { outcome: "DENY", reason: "blocked by test policy" });

    const fired = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/fire`,
      payload: {
        workspaceId: "ws_personal",
        projectId: "prj_personal",
        requestId: "request-manual-denied-001",
      },
    });
    expect(fired.statusCode).toBe(403);
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a sibling-Project Flow target before policy or Temporal", async () => {
    const siblingGraph = graph("Sibling target") as unknown as Record<string, unknown>;
    new FlowGraphRepository(db).create(
      {
        ...siblingGraph,
        id: "fg_triggerhttp02",
        projectId: "prj_other",
      } as never,
      NOW,
    );
    mockProject();
    const { app, temporalClient } = build();

    const res = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: {
        ...manualPayload(),
        graphId: "fg_triggerhttp02",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
    expect(temporalClient.reconcileTimeTrigger).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects cross-Workspace and missing pinned Flow versions before policy or Temporal", async () => {
    const { app, temporalClient } = build();

    agent
      .get("http://hub.local")
      .intercept({
        path: "/v1/projects/prj_personal?workspaceId=ws_other",
        method: "GET",
      })
      .reply(200, { ...project(), workspaceId: "ws_other" });

    const crossWorkspace = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: {
        ...manualPayload(),
        workspaceId: "ws_other",
      },
    });
    expect(crossWorkspace.statusCode).toBe(400);

    mockProject();
    const missingVersion = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: {
        ...manualPayload(),
        graphVersion: 99,
      },
    });
    expect(missingVersion.statusCode).toBe(404);
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
    expect(temporalClient.reconcileTimeTrigger).not.toHaveBeenCalled();
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

  it("reads Temporal schedule runtime for the same Project only", async () => {
    mockProject();
    mockPolicyAllow();
    const { app } = build();

    const created = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: {
        ...manualPayload(),
        name: "Runtime schedule",
        kind: "time",
        configuration: {
          cronExpression: "0 8 * * *",
          timezone: "Asia/Jakarta",
          catchupWindowMs: 60_000,
          overlap: "SKIP",
        },
      },
    });
    expect(created.statusCode).toBe(201);
    const triggerId = (created.json() as { id: string }).id;

    const runtime = await app.inject({
      method: "GET",
      url: `/v1/triggers/${triggerId}/schedule?workspaceId=ws_personal&projectId=prj_personal`,
    });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json()).toMatchObject({
      triggerId,
      paused: false,
      nextActionTimes: ["2026-09-20T01:00:00.000Z"],
      recentActionCount: 2,
    });

    const wrongProject = await app.inject({
      method: "GET",
      url: `/v1/triggers/${triggerId}/schedule?workspaceId=ws_personal&projectId=prj_other`,
    });
    expect(wrongProject.statusCode).toBe(409);
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

  it("dispatches one normalized event and deduplicates repeated delivery", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();

    const created = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: eventPayload(),
    });
    expect(created.statusCode).toBe(201);
    const triggerId = (created.json() as { id: string }).id;

    mockProject();
    mockPolicyAllow();
    const first = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/event`,
      payload: normalizedEvent(),
    });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toMatchObject({ triggerId, deduplicated: false });
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
    expect(temporalClient.startGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { ref: "refs/heads/main" },
        triggerId,
        autonomy: "L2",
      }),
    );

    mockProject();
    mockPolicyAllow();
    const duplicate = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/event`,
      payload: normalizedEvent(),
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json()).toMatchObject({
      workflowId: (first.json() as { workflowId: string }).workflowId,
      operationId: (first.json() as { operationId: string }).operationId,
      deduplicated: true,
    });
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("rejects conflicting reuse of an event dedupe key", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();
    const created = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: eventPayload(),
    });
    const triggerId = (created.json() as { id: string }).id;

    mockProject();
    mockPolicyAllow();
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/v1/triggers/${triggerId}/event`,
          payload: normalizedEvent(),
        })
      ).statusCode,
    ).toBe(202);

    mockProject();
    mockPolicyAllow();
    const conflict = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/event`,
      payload: normalizedEvent({
        eventId: "evt_delivery002",
        payload: { ref: "refs/heads/other" },
      }),
    });
    expect(conflict.statusCode).toBe(409);
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("fails closed for disabled or sibling-Project event delivery", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();
    const disabled = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: eventPayload(false),
    });
    const triggerId = (disabled.json() as { id: string }).id;

    const disabledResult = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/event`,
      payload: normalizedEvent(),
    });
    expect(disabledResult.statusCode).toBe(400);

    const wrongProject = await app.inject({
      method: "POST",
      url: `/v1/triggers/${triggerId}/event`,
      payload: normalizedEvent({ projectId: "prj_other" }),
    });
    expect(wrongProject.statusCode).toBe(409);
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
    await app.close();
  });

  it("routes generic webhook delivery through the configured Trigger selector", async () => {
    mockProject();
    mockPolicyAllow();
    const { app, temporalClient } = build();
    const created = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: webhookPayload(),
    });
    expect(created.statusCode).toBe(201);
    const triggerId = (created.json() as { id: string }).id;

    mockProject();
    mockPolicyAllow();
    const delivered = await app.inject({
      method: "POST",
      url: "/v1/webhooks/hook_ecorione_001",
      payload: {
        deliveryId: "delivery-webhook-001",
        occurredAt: "2026-09-19T10:10:00.000Z",
        payload: { action: "opened" },
        metadata: { sender: "integration-test" },
      },
    });
    expect(delivered.statusCode).toBe(202);
    expect(delivered.json()).toMatchObject({ triggerId, deduplicated: false });
    expect(temporalClient.startGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerId,
        input: { action: "opened" },
      }),
    );
    await app.close();
  });

  it("rejects duplicate webhook hookId at the Flow owner boundary", async () => {
    mockProject();
    mockPolicyAllow();
    const { app } = build();

    const first = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: webhookPayload(),
    });
    expect(first.statusCode).toBe(201);

    mockProject();
    mockPolicyAllow();
    const second = await app.inject({
      method: "POST",
      url: "/v1/triggers",
      payload: { ...webhookPayload(), name: "Duplicate hook" },
    });
    expect(second.statusCode).toBe(409);
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
