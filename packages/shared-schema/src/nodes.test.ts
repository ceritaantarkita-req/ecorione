import { describe, expect, it } from "vitest";
import {
  FLOW_NODE_KINDS,
  FlowGraphDocumentSchema,
  HttpNodeConfigSchema,
  parseFlowNodeConfig,
} from "./nodes.js";

describe("Flow node contracts", () => {
  it("keeps the complete core node pack stable", () => {
    expect(FLOW_NODE_KINDS).toEqual([
      "trigger",
      "ai",
      "memory",
      "artifact",
      "mcp-tool",
      "http",
      "transform",
      "condition",
      "loop",
      "parallel",
      "delay",
      "approval",
      "human-input",
      "sandbox",
      "data-owner",
      "notification",
      "subflow",
    ]);
  });

  it("rejects inline credential headers from HTTP graph config", () => {
    expect(() =>
      HttpNodeConfigSchema.parse({
        url: "https://example.com/data",
        method: "GET",
        headers: { Authorization: "Bearer plaintext" },
      }),
    ).toThrow(/Credential header/);
  });

  it("parses typed node config without accepting unknown fields", () => {
    expect(parseFlowNodeConfig("delay", { milliseconds: 500 })).toEqual({ milliseconds: 500 });
    expect(() =>
      parseFlowNodeConfig("delay", { milliseconds: 500, command: "oops" }),
    ).toThrow();
  });

  it("rejects duplicate node and edge ids at the shared boundary", () => {
    expect(() =>
      FlowGraphDocumentSchema.parse({
        id: "fg_contract001",
        workspaceId: "ws_personal",
        name: "bad graph",
        scope: "personal",
        sensitivity: "INTERNAL",
        nodes: [
          {
            id: "node_same01",
            kind: "trigger",
            version: 1,
            label: "A",
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: "node_same01",
            kind: "transform",
            version: 1,
            label: "B",
            position: { x: 100, y: 0 },
            config: { mode: "pick", path: "x" },
          },
        ],
        edges: [],
      }),
    ).toThrow(/duplikat/);
  });
});
