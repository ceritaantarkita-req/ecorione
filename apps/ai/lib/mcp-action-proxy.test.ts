import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { discoverMcpActionServer, listMcpActionServers } from "./mcp-action-proxy";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalConnectUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://connect.local");

  originalConnectUrl = process.env.ECORIONE_CONNECT_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_CONNECT_URL = "http://connect.local";
  process.env.ECORIONE_INTERNAL_TOKEN = "internal-test-token";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalConnectUrl === undefined) delete process.env.ECORIONE_CONNECT_URL;
  else process.env.ECORIONE_CONNECT_URL = originalConnectUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

describe("MCP action browser proxy", () => {
  it("lists only the requested Workspace through Connect", async () => {
    let authorization: string | undefined;
    pool
      .intercept({
        path: "/v1/mcp-outbound/servers?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, (opts) => {
        authorization = (opts.headers as Record<string, string> | undefined)?.authorization;
        return {
          servers: [
            {
              id: "mail",
              displayName: "Mail MCP",
              enabled: true,
              transport: "streamable-http",
              connected: false,
            },
          ],
        };
      });

    const response = await listMcpActionServers(
      new Request("http://ai.local/api/mcp-actions/servers?workspaceId=ws_personal"),
    );
    expect(response.status).toBe(200);
    expect(authorization).toBe("Bearer internal-test-token");
    expect(await response.json()).toMatchObject({
      servers: [{ id: "mail", displayName: "Mail MCP" }],
    });
  });

  it("forces user-initiated discovery to L0 and server-generated operation identity", async () => {
    let body: Record<string, unknown> | undefined;
    pool
      .intercept({
        path: "/v1/mcp-outbound/servers/mail/discover",
        method: "POST",
      })
      .reply(200, (opts) => {
        body = JSON.parse(String(opts.body)) as Record<string, unknown>;
        return {
          serverId: "mail",
          protocolEra: "modern",
          tools: [
            {
              name: "reply_message",
              enabled: true,
              actionClass: "EXTERNAL_SEND",
            },
          ],
          resources: [],
          errors: {},
        };
      });

    const response = await discoverMcpActionServer(
      new Request("http://ai.local/api/mcp-actions/servers/mail/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          scope: "personal",
          sensitivity: "INTERNAL",
        }),
      }),
      "mail",
    );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      workspaceId: "ws_personal",
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L0",
    });
    expect(String(body?.operationId)).toMatch(/^op_[a-z0-9_-]+$/);
    expect(Number.isNaN(Date.parse(String(body?.now)))).toBe(false);
  });

  it("rejects caller-supplied authority fields and invalid server ids before egress", async () => {
    const extra = await discoverMcpActionServer(
      new Request("http://ai.local/api/mcp-actions/servers/mail/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          scope: "personal",
          sensitivity: "INTERNAL",
          autonomy: "L3",
        }),
      }),
      "mail",
    );
    expect(extra.status).toBe(400);

    const invalid = await discoverMcpActionServer(
      new Request("http://ai.local/api/mcp-actions/servers/BAD!/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          scope: "personal",
          sensitivity: "INTERNAL",
        }),
      }),
      "BAD!",
    );
    expect(invalid.status).toBe(404);
  });
});
