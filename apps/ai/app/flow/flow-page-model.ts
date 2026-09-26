import type { FlowGraphNode, FlowNodeKind } from "@ecorione/shared-schema";

export const DRAFT_ID = "fg_draftcanvas01";
export const WORKSPACE_ID = "ws_personal";
export const NODE_WIDTH = 196;

export function defaultConfig(kind: FlowNodeKind): Record<string, unknown> {
  switch (kind) {
    case "trigger":
    case "parallel":
      return {};
    case "ai":
      return { target: "local", message: "Process this input." };
    case "memory":
      return { query: "{{ }}", k: 8, hostedEligibleOnly: false };
    case "artifact":
      return { artifactId: `art_${"0".repeat(64)}`, encoding: "utf8" };
    case "mcp-tool":
      return { serverId: "server", tool: "tool", arguments: {} };
    case "http":
      return { url: "https://example.com", method: "GET", headers: {} };
    case "transform":
      return { mode: "pick", path: "" };
    case "condition":
      return { operator: "truthy" };
    case "loop":
      return { mode: "identity", maxIterations: 100 };
    case "delay":
      return { milliseconds: 1000 };
    case "approval":
      return { prompt: "Approve this step?" };
    case "human-input":
      return { prompt: "Provide input" };
    case "sandbox":
      return {
        tier: "tier0",
        workspace: "/tmp/work",
        command: "pwd",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
      };
    case "data-owner":
      return { service: "context", path: "/v1/episodes?limit=20" };
    case "notification":
      return { message: "Flow node completed." };
    case "subflow":
      return { graphId: DRAFT_ID, waitForCompletion: true };
  }
}

export function newNodeId(kind: FlowNodeKind): string {
  return `node_${kind.replaceAll("-", "")}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

export function newEdgeId(): string {
  return `edge_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function errorType(body: unknown): string | null {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (
      error !== null &&
      typeof error === "object" &&
      "type" in error &&
      typeof (error as { type?: unknown }).type === "string"
    ) {
      return (error as { type: string }).type;
    }
  }
  return null;
}

export function errorMessage(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

export function parseInput(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function stringConfig(node: FlowGraphNode, key: string, fallback = ""): string {
  const value = node.config[key];
  return typeof value === "string" ? value : fallback;
}

export function numberConfig(node: FlowGraphNode, key: string, fallback = 0): number {
  const value = node.config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function outputOffset(node: FlowGraphNode, port: string): number {
  if (node.kind === "condition") return port === "false" ? 48 : 24;
  return 34;
}

export function configSummary(node: FlowGraphNode): string {
  switch (node.kind) {
    case "ai":
      return `${stringConfig(node, "target", "local")} · ${stringConfig(node, "message", "message")}`;
    case "http":
      return `${stringConfig(node, "method", "GET")} · ${stringConfig(node, "url", "URL")}`;
    case "delay":
      return `${numberConfig(node, "milliseconds", 1000)} ms`;
    case "condition":
      return stringConfig(node, "operator", "truthy");
    case "approval":
    case "human-input":
      return stringConfig(node, "prompt", "Prompt");
    case "memory":
      return stringConfig(node, "query", "Query");
    default:
      return Object.keys(node.config).length === 0
        ? "No required config"
        : `${Object.keys(node.config).length} config field(s)`;
  }
}
