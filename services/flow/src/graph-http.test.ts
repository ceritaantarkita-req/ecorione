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
    agent
      .get("http://hub.local")
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
});
