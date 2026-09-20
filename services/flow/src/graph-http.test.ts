import { assertId } from "@ecorione/shared-schema";
import { MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFlowServer } from "./http.js";
import type { FlowGraphTemporalClient, FlowTemporalClient } from "./temporal-client.js";

const apps: Array<ReturnType<typeof buildFlowServer>> = [];
const agents: MockAgent[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const agent of agents.splice(0)) await agent.close();
});

function temporal(): FlowTemporalClient & FlowGraphTemporalClient {
  return {
    start: vi.fn(async () => undefined),
    signal: vi.fn(async () => undefined),
    operationId: vi.fn(async () => assertId("operation", "op_graphhttp001")),
    describe: vi.fn(async () => ({ status: "RUNNING" as const })),
    startGraph: vi.fn(async () => undefined),
    signalGraphDecision: vi.fn(async () => undefined),
    signalGraphInput: vi.fn(async () => undefined),
    graphState: vi.fn(async (runId) => ({
      runId,
      graphId: "fg_graphhttp01",
      graphVersion: 1,
      traceOperationId: assertId("operation", "op_graphhttp001"),
      status: "RUNNING" as const,
      nodes: [],
      output: null,
      error: null,
    })),
  };
}

const graphPayload = {
  workspaceId: "ws_personal",
  name: "HTTP graph acceptance",
  scope: "personal",
  sensitivity: "INTERNAL",
  maxParallelism: 2,
  nodes: [
    {
      id: "node_trigger1",
      kind: "trigger",
      version: 1,
      label: "Trigger",
      position: { x: 80, y: 100 },
      config: {},
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("Flow graph HTTP integration", () => {
  it("syncs declarations, persists a valid graph version, and starts the compiled plan", async () => {
    const agent = new MockAgent();
    agents.push(agent);
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const hub = agent.get("http://hub.local");
    hub
      .intercept({
        path: "/v1/projects/prj_personal?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { id: "prj_personal", workspaceId: "ws_personal", name: "Personal" });
    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });
    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "ALLOW",
        reason: "PCS-05 preflight grant is active.",
        grantedPermissionIds: ["node.execute"],
      });

    const temporalClient = temporal();
    const app = buildFlowServer(temporalClient, { hubUrl: "http://hub.local" });
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/v1/graphs",
      payload: graphPayload,
    });
    expect(created.statusCode).toBe(201);
    const saved = created.json() as {
      version: {
        graphId: string;
        version: number;
        digest: string;
        validation: { valid: boolean; plan: { planDigest: string } | null };
      };
    };
    expect(saved.version.version).toBe(1);
    expect(saved.version.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.version.validation.valid).toBe(true);
    expect(saved.version.validation.plan?.planDigest).toMatch(/^[a-f0-9]{64}$/);

    const versions = await app.inject({
      method: "GET",
      url: `/v1/graphs/${saved.version.graphId}/versions`,
    });
    expect(versions.statusCode).toBe(200);
    expect(versions.json().versions).toHaveLength(1);

    const started = await app.inject({
      method: "POST",
      url: `/v1/graphs/${saved.version.graphId}/runs`,
      payload: { input: { hello: "world" } },
    });
    expect(started.statusCode).toBe(202);
    const run = started.json() as {
      runId: string;
      graphId: string;
      graphVersion: number;
      planDigest: string;
    };
    expect(run.graphId).toBe(saved.version.graphId);
    expect(run.graphVersion).toBe(1);
    expect(run.planDigest).toBe(saved.version.validation.plan?.planDigest);
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
    expect(temporalClient.startGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: run.runId,
        input: { hello: "world" },
        depth: 0,
        plan: expect.objectContaining({ planDigest: run.planDigest }),
      }),
    );
  });

  it("requires explicit Hub approval before activating a missing node grant", async () => {
    const agent = new MockAgent();
    agents.push(agent);
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const hub = agent.get("http://hub.local");

    hub
      .intercept({
        path: "/v1/projects/prj_personal?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { id: "prj_personal", workspaceId: "ws_personal", name: "Personal" });
    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });

    const temporalClient = temporal();
    const app = buildFlowServer(temporalClient, { hubUrl: "http://hub.local" });
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/v1/graphs",
      payload: graphPayload,
    });
    expect(created.statusCode).toBe(201);
    const graphId = (created.json() as { version: { graphId: string; version: number } }).version
      .graphId;

    let requestedGrantOperationId = "";
    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "DENY",
        reason: "Missing standing grant.",
        grantedPermissionIds: [],
      });
    hub
      .intercept({ path: "/v1/authority/grants", method: "POST" })
      .reply(409, (opts) => {
        const body = JSON.parse(String(opts.body)) as { operationId: string };
        requestedGrantOperationId = body.operationId;
        return {
          error: {
            type: "AUTHORITY_APPROVAL_REQUIRED",
            message: "Approval required.",
            detail: {
              operationId: body.operationId,
              prompt: "Approve node.execute for Trigger.",
            },
          },
        };
      });

    const prepared = await app.inject({
      method: "POST",
      url: `/v1/graphs/${graphId}/authority/prepare`,
      payload: { version: 1 },
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.json()).toMatchObject({
      ready: false,
      requirements: [
        {
          definitionId: "core/trigger/v1",
          nodeIds: ["node_trigger1"],
          status: "APPROVAL_REQUIRED",
          prompt: "Approve node.execute for Trigger.",
        },
      ],
    });
    expect(requestedGrantOperationId).toMatch(/^op_nodegrant_[a-f0-9]{24}$/);

    hub
      .intercept({
        path: `/v1/approvals/${requestedGrantOperationId}/decide`,
        method: "POST",
        body: JSON.stringify({ decision: "APPROVE" }),
      })
      .reply(200, { operationId: requestedGrantOperationId, status: "APPROVE" });
    hub
      .intercept({ path: "/v1/authority/grants", method: "POST" })
      .reply(201, { deduplicated: false });
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "ALLOW",
        reason: "Standing grant active.",
        grantedPermissionIds: ["node.execute"],
      });

    const decided = await app.inject({
      method: "POST",
      url: `/v1/graphs/${graphId}/authority/decide`,
      payload: {
        version: 1,
        definitionId: "core/trigger/v1",
        operationId: requestedGrantOperationId,
        decision: "APPROVE",
      },
    });
    expect(decided.statusCode).toBe(200);
    expect(decided.json()).toEqual({
      definitionId: "core/trigger/v1",
      status: "GRANTED",
    });

    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "ALLOW",
        reason: "Standing grant active.",
        grantedPermissionIds: ["node.execute"],
      });

    const started = await app.inject({
      method: "POST",
      url: `/v1/graphs/${graphId}/runs`,
      payload: { version: 1, input: { hello: "world" } },
    });
    expect(started.statusCode).toBe(202);
    expect(temporalClient.startGraph).toHaveBeenCalledTimes(1);
  });

  it("fails closed before Temporal start when a graph node lacks standing authority", async () => {
    const agent = new MockAgent();
    agents.push(agent);
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const hub = agent.get("http://hub.local");
    hub
      .intercept({
        path: "/v1/projects/prj_personal?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { id: "prj_personal", workspaceId: "ws_personal", name: "Personal" });
    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });
    hub
      .intercept({ path: "/v1/authority/nodes/sync", method: "POST" })
      .reply(200, { workspaceId: "ws_personal", declared: 17 });
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "DENY",
        reason: "Missing standing grant.",
        grantedPermissionIds: [],
      });

    const temporalClient = temporal();
    const app = buildFlowServer(temporalClient, { hubUrl: "http://hub.local" });
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/v1/graphs",
      payload: graphPayload,
    });
    expect(created.statusCode).toBe(201);
    const graphId = (created.json() as { version: { graphId: string } }).version.graphId;

    const started = await app.inject({
      method: "POST",
      url: `/v1/graphs/${graphId}/runs`,
      payload: { input: { hello: "world" } },
    });

    expect(started.statusCode).toBe(403);
    expect(started.json()).toMatchObject({
      error: {
        type: "FLOW_NODE_AUTHORITY_DENIED",
        detail: {
          nodeId: "node_trigger1",
          definitionId: "core/trigger/v1",
          reason: "Missing standing grant.",
        },
      },
    });
    expect(temporalClient.startGraph).not.toHaveBeenCalled();
  });
});
