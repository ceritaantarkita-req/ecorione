import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { GET } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let context: Interceptable;
let hub: Interceptable;
let flow: Interceptable;
let originalContextUrl: string | undefined;
let originalHubUrl: string | undefined;
let originalFlowUrl: string | undefined;

const NOW = "2026-09-19T12:00:00.000Z";

function project(id = "prj_finance", workspaceId = "ws_personal") {
  return {
    id,
    workspaceId,
    name: id === "prj_finance" ? "Finance" : "Other",
    description: "",
    instruction: "",
    memoryPolicy: "GLOBAL_PLUS_PROJECT",
    autonomyCeiling: "L3",
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
  };
}

function graph(projectId = "prj_finance") {
  return {
    graphId: projectId === "prj_finance" ? "fg_finance01" : "fg_other0001",
    workspaceId: "ws_personal",
    projectId,
    name: projectId === "prj_finance" ? "Finance Flow" : "Other Flow",
    scope: "personal",
    sensitivity: "INTERNAL",
    currentVersion: 3,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function trigger(projectId = "prj_finance") {
  const finance = projectId === "prj_finance";
  return {
    id: finance ? "trg_finance01" : "trg_other01",
    workspaceId: "ws_personal",
    projectId,
    name: finance ? "Daily finance" : "Other trigger",
    graphId: finance ? "fg_finance01" : "fg_other0001",
    graphVersion: 3,
    versionPolicy: "PINNED",
    requestedAutonomy: "L2",
    enabled: true,
    kind: "manual",
    configuration: {},
    temporalScheduleId: null,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function run(projectId = "prj_finance") {
  const finance = projectId === "prj_finance";
  return {
    operationId: finance ? "op_finance01" : "op_other01",
    workspaceId: "ws_personal",
    projectId,
    triggerId: finance ? "trg_finance01" : "trg_other01",
    graphId: finance ? "fg_finance01" : "fg_other0001",
    graphVersion: 3,
    temporalWorkflowId: finance ? "wf_finance01" : "wf_other01",
    startedAt: NOW,
    finishedAt: NOW,
    status: "COMPLETED",
    cost: null,
    availability: {
      temporal: true,
      rnd: true,
      hubAudit: true,
      trigger: true,
    },
  };
}

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  context = agent.get("http://context.local");
  hub = agent.get("http://hub.local");
  flow = agent.get("http://flow.local");
  originalContextUrl = process.env.ECORIONE_CONTEXT_URL;
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  originalFlowUrl = process.env.ECORIONE_FLOW_URL;
  process.env.ECORIONE_CONTEXT_URL = "http://context.local";
  process.env.ECORIONE_HUB_URL = "http://hub.local";
  process.env.ECORIONE_FLOW_URL = "http://flow.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalContextUrl === undefined) delete process.env.ECORIONE_CONTEXT_URL;
  else process.env.ECORIONE_CONTEXT_URL = originalContextUrl;
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
  if (originalFlowUrl === undefined) delete process.env.ECORIONE_FLOW_URL;
  else process.env.ECORIONE_FLOW_URL = originalFlowUrl;
});

describe("PE-06 Brain API", () => {
  it("builds a deterministic Project graph from authorized owner contracts", async () => {
    hub
      .intercept({
        path: "/v1/projects/prj_finance?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, project());
    hub
      .intercept({
        path: "/v1/projects/prj_finance/sources?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        sources: [
          {
            binding: {
              projectId: "prj_finance",
              workspaceId: "ws_personal",
              resourceType: "flow-graph",
              resourceId: "fg_finance01",
              owner: "Flow",
              role: "source",
              createdAt: NOW,
            },
            availability: "AVAILABLE",
            metadata: { ignoredRawOwnerPayload: "must-not-leak" },
            unavailableReason: null,
          },
        ],
      });
    flow
      .intercept({
        path: "/v1/graphs?workspaceId=ws_personal&projectId=prj_finance",
        method: "GET",
      })
      .reply(200, { graphs: [graph()] });
    flow
      .intercept({
        path: "/v1/triggers?workspaceId=ws_personal&projectId=prj_finance",
        method: "GET",
      })
      .reply(200, { triggers: [trigger()] });
    flow
      .intercept({
        path: "/v1/runs?workspaceId=ws_personal&projectId=prj_finance&limit=50",
        method: "GET",
      })
      .reply(200, { runs: [run()] });
    context
      .intercept({
        path: "/v1/facts?projectId=prj_finance&maxSensitivity=RESTRICTED&limit=40",
        method: "GET",
      })
      .reply(200, { facts: [] });

    const response = await GET(
      new Request("http://ai.local/api/brain?workspaceId=ws_personal&projectId=prj_finance"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      nodes: Array<{ type: string; canonicalId: string; metadata: Record<string, unknown> }>;
      edges: Array<{ type: string }>;
      truncated: boolean;
    };

    expect(body.nodes.map((node) => node.type)).toEqual([
      "Project",
      "Source",
      "Flow",
      "Trigger",
      "Run",
    ]);
    expect(body.edges.map((edge) => edge.type).sort()).toEqual([
      "BELONGS_TO",
      "BELONGS_TO",
      "BELONGS_TO",
      "BELONGS_TO",
      "EXECUTED",
      "REFERENCES",
      "TRIGGERED",
      "USES",
    ]);
    expect(body.nodes.find((node) => node.type === "Source")?.metadata).not.toHaveProperty(
      "ignoredRawOwnerPayload",
    );
    expect(body.truncated).toBe(false);
  });

  it("projects Fact provenance only to the authorized bound Artifact owner node", async () => {
    hub
      .intercept({
        path: "/v1/projects/prj_finance?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, project());
    hub
      .intercept({
        path: "/v1/projects/prj_finance/sources?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        sources: [
          {
            binding: {
              projectId: "prj_finance",
              workspaceId: "ws_personal",
              resourceType: "artifact",
              resourceId: "art_finance01",
              owner: "Artifact",
              role: "source",
              createdAt: NOW,
            },
            availability: "AVAILABLE",
            metadata: {
              id: "art_finance01",
              path: "sha256/aa/finance.pdf",
              description: "Finance report",
              mimeType: "application/pdf",
              sizeBytes: 4096,
              scope: "personal",
              sensitivity: "INTERNAL",
              syncClass: "LOCAL_ONLY",
            },
            unavailableReason: null,
          },
        ],
      });
    flow
      .intercept({
        path: "/v1/graphs?workspaceId=ws_personal&projectId=prj_finance",
        method: "GET",
      })
      .reply(200, { graphs: [] });
    flow
      .intercept({
        path: "/v1/triggers?workspaceId=ws_personal&projectId=prj_finance",
        method: "GET",
      })
      .reply(200, { triggers: [] });
    flow
      .intercept({
        path: "/v1/runs?workspaceId=ws_personal&projectId=prj_finance&limit=50",
        method: "GET",
      })
      .reply(200, { runs: [] });
    context
      .intercept({
        path: "/v1/facts?projectId=prj_finance&maxSensitivity=RESTRICTED&limit=40",
        method: "GET",
      })
      .reply(200, {
        facts: [
          {
            id: "mem_financefact01",
            subject: "Finance",
            predicate: "source",
            object: "report",
            text: "Finance fact from the bound report",
            confidence: 0.95,
            salience: 0.8,
            sourceEpisodeIds: ["epi_financefact01"],
            tValid: NOW,
            tInvalid: null,
            supersededBy: null,
            createdAt: NOW,
            projectId: "prj_finance",
            scope: "personal",
            sensitivity: "INTERNAL",
            syncClass: "LOCAL_ONLY",
            trust: "USER",
            provenance: {
              sourceApp: "hub:project-source",
              sourceUri: "artifact:art_finance01",
            },
          },
        ],
      });

    const response = await GET(
      new Request("http://ai.local/api/brain?workspaceId=ws_personal&projectId=prj_finance"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      nodes: Array<{ id: string; type: string; canonicalId: string }>;
      edges: Array<{
        type: string;
        sourceNodeId: string;
        targetNodeId: string;
      }>;
    };
    const factNode = body.nodes.find(
      (node) => node.type === "Fact" && node.canonicalId === "mem_financefact01",
    );
    const artifactNode = body.nodes.find(
      (node) => node.type === "Artifact" && node.canonicalId === "art_finance01",
    );
    expect(factNode).toBeDefined();
    expect(artifactNode).toBeDefined();
    expect(body.edges).toContainEqual(
      expect.objectContaining({
        type: "GENERATED_FROM",
        sourceNodeId: factNode?.id,
        targetNodeId: artifactNode?.id,
      }),
    );
  });

  it("filters sibling-Project owner rows defensively before node or edge disclosure", async () => {
    hub
      .intercept({
        path: "/v1/projects/prj_finance?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, project());
    hub
      .intercept({
        path: "/v1/projects/prj_finance/sources?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, { sources: [] });
    flow
      .intercept({
        path: "/v1/graphs?workspaceId=ws_personal&projectId=prj_finance",
        method: "GET",
      })
      .reply(200, { graphs: [graph("prj_other")] });
    flow
      .intercept({
        path: "/v1/triggers?workspaceId=ws_personal&projectId=prj_finance",
        method: "GET",
      })
      .reply(200, { triggers: [trigger("prj_other")] });
    flow
      .intercept({
        path: "/v1/runs?workspaceId=ws_personal&projectId=prj_finance&limit=50",
        method: "GET",
      })
      .reply(200, { runs: [run("prj_other")] });
    context
      .intercept({
        path: "/v1/facts?projectId=prj_finance&maxSensitivity=RESTRICTED&limit=40",
        method: "GET",
      })
      .reply(200, { facts: [] });

    const response = await GET(
      new Request("http://ai.local/api/brain?workspaceId=ws_personal&projectId=prj_finance"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      nodes: Array<{ type: string; canonicalId: string }>;
      edges: unknown[];
    };
    expect(body.nodes).toEqual([
      expect.objectContaining({ type: "Project", canonicalId: "prj_finance" }),
    ]);
    expect(body.edges).toEqual([]);
  });

  it("fails closed on Project authorization before querying any other owner", async () => {
    hub
      .intercept({
        path: "/v1/projects/prj_finance?workspaceId=ws_other",
        method: "GET",
      })
      .reply(409, { error: { code: "PROJECT_WORKSPACE_CONFLICT" } });

    const response = await GET(
      new Request("http://ai.local/api/brain?workspaceId=ws_other&projectId=prj_finance"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { type: "PROJECT_UNAVAILABLE" },
    });
  });

  it("rejects unbounded or malformed queries before owner egress", async () => {
    const response = await GET(
      new Request(
        "http://ai.local/api/brain?workspaceId=ws_personal&projectId=prj_finance&limit=9999",
      ),
    );
    expect(response.status).toBe(400);
  });
});
