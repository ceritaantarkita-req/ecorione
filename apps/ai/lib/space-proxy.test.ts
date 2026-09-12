import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { proxyToSpace } from "./space-proxy";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalSpaceUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://space.local");

  originalSpaceUrl = process.env.ECORIONE_SPACE_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_SPACE_URL = "http://space.local";
  process.env.ECORIONE_INTERNAL_TOKEN = "test-token";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalSpaceUrl === undefined) delete process.env.ECORIONE_SPACE_URL;
  else process.env.ECORIONE_SPACE_URL = originalSpaceUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

function request(method: string, body?: string): Request {
  return new Request("http://ai.local/api/space/x", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body,
  });
}

describe("proxyToSpace", () => {
  it("meneruskan path/query valid dan bearer token ke Space", async () => {
    let sawAuth: string | undefined;
    pool
      .intercept({ path: "/v1/pages?workspaceId=ws_personal", method: "GET" })
      .reply(200, (opts) => {
        sawAuth = (opts.headers as Record<string, string> | undefined)?.authorization;
        return { pages: [] };
      });

    const response = await proxyToSpace(
      request("GET"),
      "/v1/pages?workspaceId=ws_personal",
      "GET",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pages: [] });
    expect(sawAuth).toBe("Bearer test-token");
  });

  it("menolak literal dan encoded dot-segment escape", async () => {
    const literal = await proxyToSpace(request("GET"), "/v1/../healthz", "GET");
    expect(literal.status).toBe(400);

    const encoded = await proxyToSpace(request("GET"), "/v1/%2e%2e/healthz", "GET");
    expect(encoded.status).toBe(400);
  });

  it("body mutasi yang bukan JSON valid → 400", async () => {
    const response = await proxyToSpace(request("POST", "bukan json {{{"), "/v1/pages", "POST");
    expect(response.status).toBe(400);
  });

  it("status owner diteruskan apa adanya", async () => {
    pool
      .intercept({ path: "/v1/pages?workspaceId=ws_personal", method: "GET" })
      .reply(409, { error: { type: "CONFLICT" } });
    const response = await proxyToSpace(
      request("GET"),
      "/v1/pages?workspaceId=ws_personal",
      "GET",
    );
    expect(response.status).toBe(409);
  });

  it("kegagalan jaringan Space → 502 eksplisit", async () => {
    pool
      .intercept({ path: "/v1/pages?workspaceId=ws_personal", method: "GET" })
      .replyWithError(new Error("down"));
    const response = await proxyToSpace(
      request("GET"),
      "/v1/pages?workspaceId=ws_personal",
      "GET",
    );
    expect(response.status).toBe(502);
  });

  it("redirect owner tidak diikuti sambil membawa bearer token", async () => {
    pool
      .intercept({ path: "/v1/pages?workspaceId=ws_personal", method: "GET" })
      .reply(302, "", { headers: { location: "/healthz" } });
    const response = await proxyToSpace(
      request("GET"),
      "/v1/pages?workspaceId=ws_personal",
      "GET",
    );
    expect(response.status).toBe(502);
  });
});
