import { MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, describe, expect, it } from "vitest";
import { FlowGraphDocumentSchema, type FlowGraphExecutionInput } from "@ecorione/shared-schema";
import { createFlowGraphActivities } from "./graph-activities.js";
import { validateAndCompileFlowGraph } from "./node-registry.js";

const agents: MockAgent[] = [];

afterEach(async () => {
  for (const agent of agents.splice(0)) await agent.close();
});

function node(id: string, kind: string, config: Record<string, unknown> = {}) {
  return {
    id,
    kind,
    version: 1,
    label: id,
    position: { x: 0, y: 0 },
    config,
  };
}

function graph(projectId: string, id: string, extraNode: ReturnType<typeof node>) {
  return FlowGraphDocumentSchema.parse({
    id,
    workspaceId: "ws_personal",
    projectId,
    name: id,
    scope: "personal",
    sensitivity: "INTERNAL",
    maxParallelism: 1,
    nodes: [node("node_trigger1", "trigger"), extraNode],
    edges: [
      {
        id: "edge_project01",
        sourceNodeId: "node_trigger1",
        sourcePort: "out",
        targetNodeId: extraNode.id,
        targetPort: "in",
      },
    ],
  });
}

function executionFor(graphDocument: ReturnType<typeof graph>): FlowGraphExecutionInput {
  const validation = validateAndCompileFlowGraph(graphDocument, 1);
  if (!validation.valid || validation.plan === null)
    throw new Error("Graph failed compilation.");
  return {
    runId: "wf_projectisolation01" as never,
    operationId: "op_projectisolation01" as never,
    plan: validation.plan,
    input: null,
    triggerId: null,
    autonomy: "L1",
    depth: 0,
  };
}

function activities() {
  return createFlowGraphActivities({
    hubUrl: "http://hub.local",
    connectUrl: "http://connect.local",
    contextUrl: "http://context.local",
    artifactUrl: "http://artifact.local",
    spaceUrl: "http://space.local",
    sandboxUrl: "http://sandbox.local",
    rndUrl: "http://rnd.local",
    flowUrl: "http://flow.local",
    httpHostAllowlist: [],
    ownerApiAllowlist: [],
  });
}

describe("PE-03 Flow Project isolation", () => {
  it("sends graph Project to Memory retrieval and effective autonomy to Hub authority", async () => {
    const agent = new MockAgent();
    agents.push(agent);
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const context = agent.get("http://context.local");
    context.intercept({ path: "/v1/retrieve", method: "POST" }).reply(200, (options) => {
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body).toMatchObject({
        query: "remember project",
        scopes: ["personal"],
        k: 8,
        maxSensitivity: "INTERNAL",
        hostedEligibleOnly: false,
        projectId: "prj_alpha",
      });
      expect(typeof body.now).toBe("string");
      return { hits: [], diagnostics: {} };
    });
    agent
      .get("http://hub.local")
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, (options) => {
        const body = JSON.parse(options.body as string) as Record<string, unknown>;
        expect(body).toMatchObject({
          workspaceId: "ws_personal",
          autonomy: "L1",
        });
        return {
          outcome: "ALLOW",
          reason: "test",
          grantedPermissionIds: ["node.execute"],
        };
      });

    const execution = executionFor(
      graph(
        "prj_alpha",
        "fg_projectmemory01",
        node("node_memory001", "memory", { query: "remember project" }),
      ),
    );
    const compiled = execution.plan.nodes.find((item) => item.node.id === "node_memory001");
    if (compiled === undefined) throw new Error("Memory node missing.");

    const runtime = activities();
    await expect(runtime.authorizeGraphNode({ execution, compiled })).resolves.toBeUndefined();
    await expect(
      runtime.executeGraphNode({ execution, compiled, input: null }),
    ).resolves.toEqual({ hits: [], diagnostics: {} });
  });

  it("rejects a Subflow owned by a sibling Project", async () => {
    const agent = new MockAgent();
    agents.push(agent);
    agent.disableNetConnect();
    setGlobalDispatcher(agent);

    const child = graph(
      "prj_beta",
      "fg_projectchild01",
      node("node_delay001", "delay", { milliseconds: 0 }),
    );
    const childValidation = validateAndCompileFlowGraph(child, 1);
    if (!childValidation.valid || childValidation.plan === null) {
      throw new Error("Child graph failed compilation.");
    }
    agent
      .get("http://flow.local")
      .intercept({
        path: "/v1/graphs/fg_projectchild01?version=1",
        method: "GET",
      })
      .reply(200, { validation: { valid: true, plan: childValidation.plan } });

    const execution = executionFor(
      graph(
        "prj_alpha",
        "fg_projectparent01",
        node("node_subflow01", "subflow", {
          graphId: "fg_projectchild01",
          version: 1,
          waitForCompletion: true,
        }),
      ),
    );
    const compiled = execution.plan.nodes.find((item) => item.node.id === "node_subflow01");
    if (compiled === undefined) throw new Error("Subflow node missing.");

    await expect(activities().resolveSubflow({ execution, compiled })).rejects.toThrow(
      "Subflow cross-project ditolak",
    );
  });
});
