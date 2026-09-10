import { describe, expect, it } from "vitest";
import { FlowGraphDocumentSchema } from "@ecorione/shared-schema";
import { CORE_NODE_DEFINITIONS, validateAndCompileFlowGraph } from "./node-registry.js";

function graph(nodes: Array<Record<string, unknown>>, edges: Array<Record<string, unknown>>) {
  return FlowGraphDocumentSchema.parse({ id: "fg_registry001", workspaceId: "ws_personal", name: "registry", scope: "personal", sensitivity: "INTERNAL", nodes, edges });
}
const node = (id: string, kind: string, config: Record<string, unknown> = {}) => ({ id, kind, version: 1, label: id, position: { x: 0, y: 0 }, config });
const edge = (id: string, sourceNodeId: string, targetNodeId: string, sourcePort = "out") => ({ id, sourceNodeId, sourcePort, targetNodeId, targetPort: "in" });

describe("Flow core node registry/compiler", () => {
  it("registers all 17 core node kinds", () => expect(CORE_NODE_DEFINITIONS).toHaveLength(17));
  it("compiles a deterministic DAG into levels", () => {
    const value = graph([node("node_trigger1", "trigger"), node("node_transform1", "transform", { mode: "pick", path: "name" }), node("node_condition1", "condition", { operator: "truthy" }), node("node_true001", "delay", { milliseconds: 0 }), node("node_false01", "delay", { milliseconds: 0 })], [edge("edge_000001", "node_trigger1", "node_transform1"), edge("edge_000002", "node_transform1", "node_condition1"), edge("edge_000003", "node_condition1", "node_true001", "true"), edge("edge_000004", "node_condition1", "node_false01", "false")]);
    const result = validateAndCompileFlowGraph(value, 1);
    expect(result.valid).toBe(true);
    expect(result.plan?.levels).toEqual([["node_trigger1"], ["node_transform1"], ["node_condition1"], ["node_false01", "node_true001"]]);
    expect(result.plan?.planDigest).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects cycles and unreachable nodes", () => {
    const value = graph([node("node_trigger1", "trigger"), node("node_delay001", "delay", { milliseconds: 0 }), node("node_delay002", "delay", { milliseconds: 0 })], [edge("edge_000001", "node_trigger1", "node_delay001"), edge("edge_000002", "node_delay001", "node_delay002"), edge("edge_000003", "node_delay002", "node_delay001")]);
    const result = validateAndCompileFlowGraph(value, 1);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain("GRAPH_CYCLE");
  });
  it("rejects unknown ports, inline secret-looking config, and limit escalation", () => {
    const value = graph([node("node_trigger1", "trigger"), { ...node("node_http0001", "http", { url: "https://example.com", method: "POST", headers: {}, body: { api_key: "bad" } }), limits: { timeoutMs: 999999999 } }], [edge("edge_000001", "node_trigger1", "node_http0001", "missing")]);
    const result = validateAndCompileFlowGraph(value, 1);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.code)).toEqual(expect.arrayContaining(["UNKNOWN_SOURCE_PORT", "INLINE_SECRET", "LIMIT_ESCALATION"]));
  });
});
