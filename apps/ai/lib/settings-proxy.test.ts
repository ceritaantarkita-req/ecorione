import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { proxyToConnectSettings } from "./settings-proxy";

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
  process.env.ECORIONE_INTERNAL_TOKEN = "test-token";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalConnectUrl === undefined) delete process.env.ECORIONE_CONNECT_URL;
  else process.env.ECORIONE_CONNECT_URL = originalConnectUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

function request(method: string, body?: string): Request {
  return new Request("http://ai.local/api/settings/x", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body,
  });
}

describe("proxyToConnectSettings", () => {
  it("meneruskan GET MCP workspace query yang memang didukung Connect", async () => {
    let sawAuth: string | undefined;
    pool
      .intercept({
        path: "/v1/settings/mcp/servers?workspaceId=workspace-default",
        method: "GET",
      })
      .reply(200, (opts) => {
        sawAuth = (opts.headers as Record<string, string> | undefined)?.authorization;
        return { servers: [] };
      });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=workspace-default",
      "GET",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ servers: [] });
    expect(sawAuth).toBe("Bearer test-token");
  });

  it("menolak query Settings yang tidak termasuk kontrak allowlist", async () => {
    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/runtime?workspaceId=unexpected",
      "GET",
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe("BAD_REQUEST");
  });

  it("menolak duplicate dan unknown MCP workspace query", async () => {
    const duplicate = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=a&workspaceId=b",
      "GET",
    );
    expect(duplicate.status).toBe(400);

    const unknown = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=a&admin=true",
      "GET",
    );
    expect(unknown.status).toBe(400);
  });

  it("menolak dot-segment sebelum URL owner dibentuk", async () => {
    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/../ops/provider-canary",
      "GET",
    );
    expect(response.status).toBe(400);
  });

  it("body mutasi yang bukan JSON valid → 400 tanpa memanggil Connect", async () => {
    const response = await proxyToConnectSettings(
      request("PUT", "bukan json {{{"),
      "/v1/settings/runtime",
      "PUT",
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe("BAD_REQUEST");
  });

  it("kegagalan jaringan Connect → 502 eksplisit", async () => {
    pool
      .intercept({ path: "/v1/settings/runtime", method: "GET" })
      .replyWithError(new Error("down"));

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/runtime",
      "GET",
    );
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "UPSTREAM_UNAVAILABLE",
    );
  });

  it("redirect owner tidak diikuti sambil membawa bearer token", async () => {
    pool
      .intercept({ path: "/v1/settings/runtime", method: "GET" })
      .reply(302, "", { headers: { location: "/v1/settings/credentials" } });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/runtime",
      "GET",
    );
    expect(response.status).toBe(502);
  });
});
