import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

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

describe("Google Drive Picker session proxy", () => {
  it("returns only the short-lived Picker session with no-store headers", async () => {
    connect
      .intercept({
        path: "/v1/integrations/google-drive/picker-session",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal" }),
      })
      .reply(200, {
        workspaceId: "ws_personal",
        scope: "https://www.googleapis.com/auth/drive.file",
        accessToken: "short-lived-picker-token",
        expiresAt: "2026-10-03T05:00:00.000Z",
        developerKey: "AIzaPickerKey_1234567890",
        appId: "123456789012",
      });

    const response = await POST(
      new Request("https://ecorione.example/api/integrations/google-drive/picker-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "ws_personal" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.body).toBeDefined();
    const text = await response.text();
    expect(text).toContain("short-lived-picker-token");
    expect(text).not.toContain("refresh-token");
    expect(text).not.toContain("internal-secret");
  });

  it("rejects non-Personal Workspace before Connect", async () => {
    const response = await POST(
      new Request("https://ecorione.example/api/integrations/google-drive/picker-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "ws_other" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
