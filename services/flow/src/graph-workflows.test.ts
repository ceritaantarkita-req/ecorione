import { fileURLToPath } from "node:url";
import {
  FlowGraphDocumentSchema,
  FlowGraphExecutionInputSchema,
  assertId,
  type FlowGraphExecutionInput,
} from "@ecorione/shared-schema";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it, vi } from "vitest";
import type { FlowGraphActivities } from "./graph-activities.js";
import { validateAndCompileFlowGraph } from "./node-registry.js";

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

function edge(id: string, sourceNodeId: string, targetNodeId: string, sourcePort = "out") {
  return { id, sourceNodeId, sourcePort, targetNodeId, targetPort: "in" };
}

function execution(): FlowGraphExecutionInput {
  const graph = FlowGraphDocumentSchema.parse({
    id: "fg_temporalgraph01",
    workspaceId: "ws_personal",
    name: "Temporal graph acceptance",
    scope: "personal",
    sensitivity: "INTERNAL",
    maxParallelism: 2,
    nodes: [
      node("node_trigger1", "trigger"),
      node("node_delay001", "delay", { milliseconds: 24 * 60 * 60 * 1000 }),
      node("node_human001", "human-input"),
      node("node_condition1", "condition", { operator: "truthy" }),
      node("node_approval1", "approval", { prompt: "Approve graph?" }),
      node("node_false001", "delay", { milliseconds: 0 }),
    ],
    edges: [
      edge("edge_000001", "node_trigger1", "node_delay001"),
      edge("edge_000002", "node_delay001", "node_human001"),
      edge("edge_000003", "node_human001", "node_condition1"),
      edge("edge_000004", "node_condition1", "node_approval1", "true"),
      edge("edge_000005", "node_condition1", "node_false001", "false"),
    ],
  });
  const validation = validateAndCompileFlowGraph(graph, 1);
  if (!validation.valid || validation.plan === null) {
    throw new Error("Test graph failed compilation.");
  }
  return FlowGraphExecutionInputSchema.parse({
    runId: assertId("workflow", "wf_graphacceptance001"),
    operationId: assertId("operation", "op_graphacceptance001"),
    plan: validation.plan,
    input: { start: true },
    depth: 0,
  });
}

function activities(): FlowGraphActivities {
  return {
    authorizeGraphNode: vi.fn(async () => undefined),
    evaluateGraphNodePolicy: vi.fn(async () => ({ outcome: "ALLOW" as const, reason: "test" })),
    requestGraphApproval: vi.fn(async () => "Approve graph?"),
    executeGraphNode: vi.fn(async ({ input }) => input),
    recordGraphTrace: vi.fn(async () => undefined),
    resolveSubflow: vi.fn(async () => {
      throw new Error("Subflow is not used in this acceptance graph.");
    }),
  };
}

describe("Temporal graphExecutionWorkflow", () => {
  it("survives a durable timer, consumes human input, routes a branch, and resumes approval", async () => {
    const env = await TestWorkflowEnvironment.createTimeSkipping();
    try {
      const graphActivities = activities();
      const taskQueue = "flow-graph-runtime-test";
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
        activities: graphActivities,
      });
      const input = execution();
      const result = await worker.runUntil(async () => {
        const handle = await env.client.workflow.start("graphExecutionWorkflow", {
          workflowId: input.runId,
          taskQueue,
          args: [input],
        });
        await handle.signal("graphNodeInput", {
          nodeId: "node_human001",
          value: true,
        });
        await handle.signal("graphNodeDecision", {
          nodeId: "node_approval1",
          decision: "APPROVE",
          note: null,
        });
        return handle.result();
      });

      expect(result).toMatchObject({
        runId: input.runId,
        graphId: input.plan.graph.id,
        graphVersion: 1,
        output: true,
        traceOperationId: input.operationId,
      });
      expect(graphActivities.requestGraphApproval).toHaveBeenCalledTimes(1);
      expect(graphActivities.executeGraphNode).not.toHaveBeenCalled();
      expect(graphActivities.authorizeGraphNode).toHaveBeenCalledTimes(5);
    } finally {
      await env.teardown();
    }
  }, 30_000);
});
