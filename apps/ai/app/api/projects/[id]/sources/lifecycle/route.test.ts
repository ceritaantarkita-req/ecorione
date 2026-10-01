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

describe("/api/projects/:id/sources/lifecycle", () => {
  it("lists lifecycle state from Hub", async () => {
    pool
      .intercept({
        path: "/v1/projects/prj_finance/sources/lifecycle?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        lifecycles: [
          {
            projectId: "prj_finance",
            workspaceId: "ws_personal",
            sourceType: "url",
            sourceKey: "https://example.com/report",
            role: "source",
            latestArtifactId: `art_${"a".repeat(64)}`,
            latestContextEpisodeId: null,
            state: "SNAPSHOT_READY",
            lastRefreshedAt: "2026-10-01T00:00:00.000Z",
            lastIndexedAt: null,
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
      });

    const res = await GET(
      new Request(
        "http://ai.local/api/projects/prj_finance/sources/lifecycle?workspaceId=ws_personal",
      ),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      lifecycles: [{ sourceType: "url", state: "SNAPSHOT_READY" }],
    });
  });

  it("rejects invalid workspace before Hub egress", async () => {
    const res = await GET(
      new Request("http://ai.local/api/projects/prj_finance/sources/lifecycle?workspaceId=bad"),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(res.status).toBe(400);
  });
});
