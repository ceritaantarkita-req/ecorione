import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { GET } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;
let connect: Interceptable;
let originalConnectUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  connect = agent.get("http://connect.local");
  originalConnectUrl = process.env.ECORIONE_CONNECT_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_CONNECT_URL = "http://connect.local";
  process.env.ECORIONE_INTERNAL_TOKEN = "internal-secret";
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await agent.close();
  if (originalConnectUrl === undefined) delete process.env.ECORIONE_CONNECT_URL;
  else process.env.ECORIONE_CONNECT_URL = originalConnectUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

describe("Google Drive OAuth browser callback", () => {
  it("forwards code/state internally and redirects only to validated same-origin returnPath", async () => {
    const state = "s".repeat(43);
    connect
      .intercept({
        path: "/v1/integrations/google-drive/oauth/callback",
        method: "POST",
        body: JSON.stringify({ code: "authorization-code", state }),
      })
      .reply(200, {
        workspaceId: "ws_personal",
        connected: true,
        returnPath: "/projects?project=prj_personal",
      });

    const response = await GET(
      new Request(
        `https://ecorione.example/api/integrations/google-drive/callback?code=authorization-code&state=${state}`,
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://ecorione.example/projects?project=prj_personal&googleDrive=connected",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns safely after cancelled consent without echoing Google error detail", async () => {
    const state = "c".repeat(43);
    connect
      .intercept({
        path: "/v1/integrations/google-drive/oauth/callback",
        method: "POST",
        body: JSON.stringify({
          state,
          error: "access_denied",
          errorDescription: "private Google detail",
        }),
      })
      .reply(200, {
        workspaceId: "ws_personal",
        connected: false,
        returnPath: "/projects",
      });

    const response = await GET(
      new Request(
        `https://ecorione.example/api/integrations/google-drive/callback?error=access_denied&error_description=private%20Google%20detail&state=${state}`,
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://ecorione.example/projects?googleDrive=cancelled",
    );
    expect(response.headers.get("location")).not.toContain("private");
  });

  it("refuses a backslash return path that WHATWG URL would reinterpret cross-origin", async () => {
    const state = "b".repeat(43);
    connect
      .intercept({
        path: "/v1/integrations/google-drive/oauth/callback",
        method: "POST",
      })
      .reply(200, {
        workspaceId: "ws_personal",
        connected: true,
        returnPath: "/\\evil.example/steal",
      });

    const response = await GET(
      new Request(
        `https://ecorione.example/api/integrations/google-drive/callback?code=authorization-code&state=${state}`,
      ),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  it("refuses an upstream open-redirect return path", async () => {
    const state = "r".repeat(43);
    connect
      .intercept({
        path: "/v1/integrations/google-drive/oauth/callback",
        method: "POST",
      })
      .reply(200, {
        workspaceId: "ws_personal",
        connected: true,
        returnPath: "https://evil.example/steal",
      });

    const response = await GET(
      new Request(
        `https://ecorione.example/api/integrations/google-drive/callback?code=authorization-code&state=${state}`,
      ),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });
});
