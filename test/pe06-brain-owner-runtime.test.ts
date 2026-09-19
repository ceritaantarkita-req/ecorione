import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BrainQuerySchema,
  assertId,
  type BrainGraphResponse,
} from "../packages/shared-schema/src/index.js";
import { openHubDatabase } from "../services/hub/src/db.js";
import { buildHubServer } from "../services/hub/src/http.js";
import { openRndDatabase } from "../services/rnd/src/db.js";
import { buildRndServer } from "../services/rnd/src/http.js";
import { buildFlowServer } from "../services/flow/src/http.js";
import type {
  FlowGraphTemporalClient,
  FlowTemporalClient,
} from "../services/flow/src/temporal-client.js";
import { queryBrainGraph } from "../apps/ai/lib/brain-projection.js";

const WORKSPACE_ID = "ws_personal";
const PERSONAL_PROJECT_ID = "prj_personal";
const SOURCE_URL = "https://example.com/brain-runtime-source";

type Closeable = {
  listen(options: { host: string; port: number }): Promise<string>;
  close(): Promise<void>;
  server: { address(): AddressInfo | string | null };
};

const closeables: Closeable[] = [];
const databases: Array<{ close(): void }> = [];
let originalHubUrl: string | undefined;
let originalFlowUrl: string | undefined;
let originalInternalToken: string | undefined;

function temporal(): FlowTemporalClient & FlowGraphTemporalClient {
  return {
    start: vi.fn(async () => undefined),
    signal: vi.fn(async () => undefined),
    operationId: vi.fn(async () => assertId("operation", "op_pe06runtime01")),
    describe: vi.fn(async () => ({ status: "RUNNING" as const })),
    startGraph: vi.fn(async () => undefined),
    signalGraphDecision: vi.fn(async () => undefined),
    signalGraphInput: vi.fn(async () => undefined),
    graphState: vi.fn(async (runId) => ({
      runId,
      graphId: "fg_pe06runtime01",
      graphVersion: 1,
      traceOperationId: assertId("operation", "op_pe06runtime01"),
      status: "RUNNING" as const,
      nodes: [],
      output: null,
      error: null,
    })),
  };
}

async function listen(app: Closeable): Promise<string> {
  closeables.push(app);
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("PE-06 owner runtime address gagal.");
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  expectedStatus = 200,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json()) as T;
  expect(response.status).toBe(expectedStatus);
  return body;
}

function graphPayload(name: string, projectId: string) {
  return {
    workspaceId: WORKSPACE_ID,
    projectId,
    name,
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
}

function brainQuery(projectId = PERSONAL_PROJECT_ID) {
  return BrainQuerySchema.parse({
    workspaceId: WORKSPACE_ID,
    projectId,
    limit: 120,
    runLimit: 50,
  });
}

function nodeIds(graph: BrainGraphResponse): string[] {
  return graph.nodes.map((node) => `${node.type}:${node.canonicalId}`);
}

afterEach(async () => {
  process.env.ECORIONE_HUB_URL = originalHubUrl;
  process.env.ECORIONE_FLOW_URL = originalFlowUrl;
  process.env.ECORIONE_INTERNAL_TOKEN = originalInternalToken;
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  if (originalFlowUrl === undefined) delete process.env.ECORIONE_FLOW_URL;
  if (originalInternalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;

  for (const app of closeables.splice(0).reverse()) await app.close();
  for (const db of databases.splice(0).reverse()) db.close();
});

describe("PE-06 Brain real-owner runtime acceptance", () => {
  it("rebuilds the same Project graph from canonical owners and removes detached state without mutating owners", async () => {
    originalHubUrl = process.env.ECORIONE_HUB_URL;
    originalFlowUrl = process.env.ECORIONE_FLOW_URL;
    originalInternalToken = process.env.ECORIONE_INTERNAL_TOKEN;
    delete process.env.ECORIONE_INTERNAL_TOKEN;

    const rndDb = openRndDatabase();
    databases.push(rndDb);
    const rndUrl = await listen(buildRndServer(rndDb));

    const hubDb = openHubDatabase();
    databases.push(hubDb);
    const hub = buildHubServer(hubDb, {
      contextUrl: "http://127.0.0.1:1",
      connectUrl: "http://127.0.0.1:1",
      rndUrl,
      flowUrl: "http://127.0.0.1:1",
    });
    const hubUrl = await listen(hub);

    const flow = buildFlowServer(temporal(), { hubUrl, rndUrl });
    const flowUrl = await listen(flow);

    process.env.ECORIONE_HUB_URL = hubUrl;
    process.env.ECORIONE_FLOW_URL = flowUrl;

    await requestJson(
      `${hubUrl}/v1/projects/${PERSONAL_PROJECT_ID}/sources`,
      {
        method: "POST",
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          resourceType: "url",
          resourceId: SOURCE_URL,
          role: "source",
        }),
      },
      201,
    );

    const personalFlow = await requestJson<{
      version: { graphId: string; version: number };
    }>(
      `${flowUrl}/v1/graphs`,
      {
        method: "POST",
        body: JSON.stringify(graphPayload("PE-06 Personal Flow", PERSONAL_PROJECT_ID)),
      },
      201,
    );

    const sibling = await requestJson<{ id: string }>(
      `${hubUrl}/v1/projects`,
      {
        method: "POST",
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          name: "PE-06 Sibling",
        }),
      },
      201,
    );

    const siblingFlow = await requestJson<{
      version: { graphId: string; version: number };
    }>(
      `${flowUrl}/v1/graphs`,
      {
        method: "POST",
        body: JSON.stringify(graphPayload("PE-06 Sibling Flow", sibling.id)),
      },
      201,
    );

    const first = await queryBrainGraph(brainQuery());
    const rebuilt = await queryBrainGraph(brainQuery());

    expect(rebuilt).toEqual(first);
    expect(first.truncated).toBe(false);
    expect(nodeIds(first)).toEqual([
      `Project:${PERSONAL_PROJECT_ID}`,
      `Source:url:${SOURCE_URL}:source`,
      `Flow:${personalFlow.version.graphId}`,
    ]);
    expect(nodeIds(first)).not.toContain(`Flow:${siblingFlow.version.graphId}`);
    expect(first.edges.map((edge) => edge.type)).toEqual([
      "BELONGS_TO",
      "BELONGS_TO",
    ]);

    const projectNode = first.nodes.find((node) => node.type === "Project");
    const sourceNode = first.nodes.find((node) => node.type === "Source");
    const flowNode = first.nodes.find((node) => node.type === "Flow");
    expect(projectNode?.href).toBe("/projects");
    expect(sourceNode?.href).toBe("/projects");
    expect(flowNode?.href).toBe(
      `/flow?graph=${encodeURIComponent(personalFlow.version.graphId)}&version=1`,
    );

    await requestJson(
      `${hubUrl}/v1/projects/${PERSONAL_PROJECT_ID}/sources`,
      {
        method: "DELETE",
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          resourceType: "url",
          resourceId: SOURCE_URL,
          role: "source",
        }),
      },
      200,
    );

    const afterDetach = await queryBrainGraph(brainQuery());
    expect(nodeIds(afterDetach)).toEqual([
      `Project:${PERSONAL_PROJECT_ID}`,
      `Flow:${personalFlow.version.graphId}`,
    ]);
    expect(afterDetach.nodes.some((node) => node.canonicalId.includes(SOURCE_URL))).toBe(false);

    const ownerProject = await requestJson<{ id: string; workspaceId: string }>(
      `${hubUrl}/v1/projects/${PERSONAL_PROJECT_ID}?workspaceId=${WORKSPACE_ID}`,
    );
    expect(ownerProject).toMatchObject({
      id: PERSONAL_PROJECT_ID,
      workspaceId: WORKSPACE_ID,
    });

    const ownerFlow = await requestJson<{
      graphId: string;
      graph: { projectId: string };
    }>(`${flowUrl}/v1/graphs/${personalFlow.version.graphId}?version=1`);
    expect(ownerFlow).toMatchObject({
      graphId: personalFlow.version.graphId,
      graph: { projectId: PERSONAL_PROJECT_ID },
    });
  });
});
