import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HubMcpGovernance, McpPolicyDeniedError } from "./governance.js";
import {
  McpRequestContextSchema,
  McpServerConfigSchema,
  type McpGovernanceRequest,
} from "./types.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let hub: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  hub = agent.get("http://hub.local");
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
});

function request(withCredential = false): McpGovernanceRequest {
  const server = McpServerConfigSchema.parse({
    id: "remote",
    displayName: "Remote MCP",
    workspaceIds: ["ws_alpha"],
    transport: withCredential
      ? {
          type: "streamable-http",
          url: "https://mcp.example.test/mcp",
          credentialRef: "remote/token",
        }
      : { type: "streamable-http", url: "https://mcp.example.test/mcp" },
    toolPolicies: [{ name: "read", enabled: true, actionClass: "READ" }],
  });
  return {
    server,
    toolName: "read",
    actionClass: "READ",
    arguments: {},
    context: McpRequestContextSchema.parse({
      workspaceId: "ws_alpha",
      operationId: "op_mcpauthority001",
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
      now: "2026-09-09T16:00:00.000Z",
    }),
    idempotencyKey: null,
  };
}

describe("HubMcpGovernance authority plane", () => {
  it("fails closed before generic policy when MCP grant is missing", async () => {
    hub.intercept({ path: "/v1/authority/authorize", method: "POST" }).reply(200, {
      outcome: "DENY",
      reason: "missing standing grant",
      missingPermissionIds: ["mcp.tool.read"],
    });
    const governance = new HubMcpGovernance("http://hub.local", undefined);
    await expect(governance.authorize(request())).rejects.toBeInstanceOf(McpPolicyDeniedError);
  });

  it("continues to generic policy only after standing authority allows the tool", async () => {
    hub.intercept({ path: "/v1/authority/authorize", method: "POST" }).reply(200, {
      outcome: "ALLOW",
      reason: "standing grant",
      grantedPermissionIds: ["mcp.tool.read"],
    });
    hub.intercept({ path: "/v1/actions/evaluate", method: "POST" }).reply(200, {
      outcome: "ALLOW",
      reason: "read policy",
    });
    const governance = new HubMcpGovernance("http://hub.local", undefined);
    await expect(governance.authorize(request())).resolves.toBeUndefined();
  });

  it("requires secret.access authority before policy when a credentialRef is configured", async () => {
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "ALLOW",
        reason: "MCP tool allowed",
        grantedPermissionIds: ["mcp.tool.read"],
      })
      .times(1);
    hub
      .intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "DENY",
        reason: "credential grant missing",
        missingPermissionIds: ["credential.use"],
      })
      .times(1);
    const governance = new HubMcpGovernance("http://hub.local", undefined);
    await expect(governance.authorize(request(true))).rejects.toBeInstanceOf(McpPolicyDeniedError);
  });
});
