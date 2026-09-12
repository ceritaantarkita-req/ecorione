import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { proxyToFlow } from "./flow-proxy";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalFlowUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://flow.local");

  originalFlowUrl = process.env.ECORIONE_FLOW_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_FLOW_URL = "http://flow.local";
  process.env.ECORIONE_INTERNAL_TOKEN = "test-token";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalFlowUrl === undefined) delete process.env.ECORIONE_FLOW_URL;
  else process.env.ECORIONE_FLOW_URL = originalFlowUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

function request(method: string, body?: string): Request {
  return new Request("http://ai.local/api/flow/x", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body,
  });
}

describe("proxyToFlow", () => {
  it("meneruskan request valid dan bearer token ke Flow", async () => {
    let sawAuth: string | undefined;
    pool
      .intercept({
        path: "/v1/graphs/validate",
        method: "POST",
        body: JSON.stringify({ nodes: [] }),
      })
      .reply(200, (opts) => {
        sawAuth = (opts.headers as Record<string, string> | undefined)?.authorization;
        return { valid: true };
      });

    const response = await proxyToFlow(
      request("POST", JSON.stringify({ nodes: [] })),
      "/v1/graphs/validate",
      "POST",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
    expect(sawAuth).toBe("Bearer test-token");
  });

  it("menolak literal dan encoded dot-segment escape", async () => {
    const literal = await proxyToFlow(request("GET"), "/v1/../healthz", "GET");
    expect(literal.status).toBe(400);

    const encoded = await proxyToFlow(request("GET"), "/v1/%2e%2e/healthz", "GET");
    expect(encoded.status).toBe(400);
  });

  it("body mutasi yang bukan JSON valid → 400", async () => {
    const response = await proxyToFlow(
      request("POST", "bukan json {{{"),
      "/v1/graphs/validate",
      "POST",
    );
    expect(response.status).toBe(400);
  });

  it("kegagalan jaringan Flow → 502 eksplisit", async () => {
    pool.intercept({ path: "/v1/nodes", method: "GET" }).replyWithError(new Error("down"));
    const response = await proxyToFlow(request("GET"), "/v1/nodes", "GET");
    expect(response.status).toBe(502);
  });

  it("redirect owner tidak diikuti sambil membawa bearer token", async () => {
    pool
      .intercept({ path: "/v1/nodes", method: "GET" })
      .reply(302, "", { headers: { location: "/healthz" } });
    const response = await proxyToFlow(request("GET"), "/v1/nodes", "GET");
    expect(response.status).toBe(502);
  });
});
