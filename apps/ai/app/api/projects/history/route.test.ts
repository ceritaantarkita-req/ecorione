import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { GET } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalHubUrl: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://hub.local");
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
});

describe("GET /api/projects/history", () => {
  it("requests recent sessions scoped to one Project", async () => {
    pool
      .intercept({
        path: "/v1/history/sessions?scope=personal&workspaceId=ws_personal&projectId=prj_finance&maxSensitivity=RESTRICTED&hostedEligible=0",
        method: "GET",
      })
      .reply(200, { sessions: [] });

    const res = await GET(
      new Request(
        "http://ai.local/api/projects/history?workspaceId=ws_personal&projectId=prj_finance",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [] });
  });

  it("requires an explicit valid Project id", async () => {
    const res = await GET(
      new Request("http://ai.local/api/projects/history?workspaceId=ws_personal"),
    );
    expect(res.status).toBe(400);
  });
});
