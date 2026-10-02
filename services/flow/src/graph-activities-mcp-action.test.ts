import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { createFlowGraphActivities } from "./graph-activities.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let connectPool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  connectPool = agent.get("http://connect.local");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

describe("Session 11 MCP action activity", () => {
  it("sends resolved structured arguments to Connect governance/runtime", async () => {
    let body: Record<string, unknown> | undefined;
    connectPool
      .intercept({
        path: "/v1/mcp-outbound/servers/mail/tools/reply_message/call",
        method: "POST",
      })
      .reply(200, (opts) => {
        body = JSON.parse(String(opts.body)) as Record<string, unknown>;
        return {
          serverId: "mail",
          toolName: "reply_message",
          protocolEra: "modern",
          result: { content: [{ type: "text", text: "sent" }] },
          deduplicated: false,
          idempotencySettlement: "settled",
          audit: "recorded",
        };
      });

    const activities = createFlowGraphActivities({
      hubUrl: "http://hub.local",
      connectUrl: "http://connect.local",
      contextUrl: "http://context.local",
      artifactUrl: "http://artifact.local",
      spaceUrl: "http://space.local",
      sandboxUrl: "http://sandbox.local",
      rndUrl: "http://rnd.local",
      flowUrl: "http://flow.local",
      token: "internal-token",
      httpHostAllowlist: [],
      ownerApiAllowlist: [],
    });

    const result = await activities.executeGraphNode({
      execution: {
        runId: "wf_session11mcp",
        operationId: "op_session11mcp",
        autonomy: "L2",
        plan: {
          graphVersion: 1,
          graph: {
            workspaceId: "ws_personal",
            scope: "personal",
            sensitivity: "INTERNAL",
          },
        },
      },
      compiled: {
        node: {
          id: "node_reply",
          kind: "mcp-tool",
          config: {
            serverId: "mail",
            tool: "reply_message",
            arguments: {
              to: "{{ sender.email }}",
              subject: "Reply: {{ subject }}",
              score: "{{ score }}",
              tags: "{{ tags }}",
            },
          },
        },
        limits: { maxOutputBytes: 1_048_576 },
      },
      input: {
        sender: { email: "rani@example.com" },
        subject: "Hello",
        score: 91,
        tags: ["important", "customer"],
      },
    } as never);

    expect(body).toMatchObject({
      workspaceId: "ws_personal",
      operationId: "op_session11mcp-node_reply",
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L2",
      arguments: {
        to: "rani@example.com",
        subject: "Reply: Hello",
        score: 91,
        tags: ["important", "customer"],
      },
    });
    expect(result).toMatchObject({ toolName: "reply_message" });
  });
});
