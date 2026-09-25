import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { GET } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let hubPool: Interceptable;
let originalHubUrl: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  hubPool = agent.get("http://hub.local");
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
});

describe("/api/projects/:id/sources/mcp-resources", () => {
  it("forwards Project-scoped MCP resource discovery", async () => {
    hubPool
      .intercept({
        path: "/v1/projects/prj_finance/sources/mcp-resources?workspaceId=ws_personal&serverId=drive",
        method: "GET",
      })
      .reply(200, {
        serverId: "drive",
        resources: [
          {
            uri: "gdrive://file/1",
            name: "Budget",
            mimeType: "application/pdf",
          },
        ],
        warning: null,
      });

    const response = await GET(
      new Request(
        "http://ai.local/api/projects/prj_finance/sources/mcp-resources?workspaceId=ws_personal&serverId=drive",
      ),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      serverId: "drive",
      resources: [{ uri: "gdrive://file/1", name: "Budget" }],
    });
  });

  it("rejects invalid server id before Hub", async () => {
    const response = await GET(
      new Request(
        "http://ai.local/api/projects/prj_finance/sources/mcp-resources?workspaceId=ws_personal&serverId=INVALID SERVER",
      ),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(response.status).toBe(400);
  });
});
