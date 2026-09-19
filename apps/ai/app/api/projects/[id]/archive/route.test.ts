import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

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

describe("POST /api/projects/:id/archive", () => {
  it("archives the selected Project in the explicit Workspace", async () => {
    pool
      .intercept({
        path: "/v1/projects/prj_finance/archive",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal" }),
      })
      .reply(200, {
        id: "prj_finance",
        workspaceId: "ws_personal",
        name: "Finance",
        description: "",
        instruction: "",
        memoryPolicy: "GLOBAL_PLUS_PROJECT",
        autonomyCeiling: "L3",
        createdAt: "2026-09-19T00:00:00.000Z",
        updatedAt: "2026-09-19T00:01:00.000Z",
        archivedAt: "2026-09-19T00:01:00.000Z",
      });

    const res = await POST(
      new Request("http://ai.local/api/projects/prj_finance/archive", {
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal" }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(res.status).toBe(200);
  });

  it("rejects an invalid Project id before Hub egress", async () => {
    const res = await POST(
      new Request("http://ai.local/api/projects/bad/archive", {
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal" }),
      }),
      { params: Promise.resolve({ id: "bad" }) },
    );
    expect(res.status).toBe(400);
  });
});
