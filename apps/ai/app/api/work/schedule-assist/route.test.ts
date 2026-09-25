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

describe("POST /api/work/schedule-assist", () => {
  it("validates then forwards a bounded draft request to Hub", async () => {
    const body = {
      workspaceId: "ws_personal",
      projectId: "prj_personal",
      intent: "weekdays at 08:30 Jakarta time",
      current: null,
    };
    pool
      .intercept({
        path: "/v1/work/schedule/assist",
        method: "POST",
        body: JSON.stringify(body),
      })
      .reply(200, {
        draft: {
          name: "Weekday brief",
          graphId: "fg_brief",
          graphVersion: 3,
          requestedAutonomy: "L2",
          enabled: true,
          configuration: {
            cronExpression: "30 8 * * 1-5",
            timezone: "Asia/Jakarta",
            catchupWindowMs: 60000,
            overlap: "SKIP",
          },
        },
        summary: "Runs the selected Flow on weekdays at 08:30 WIB.",
        source: "local-model",
      });

    const response = await POST(
      new Request("http://ai.local/api/work/schedule-assist", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()) as { source: string }).toMatchObject({
      source: "local-model",
    });
  });

  it("rejects malformed intent before Hub egress", async () => {
    const response = await POST(
      new Request("http://ai.local/api/work/schedule-assist", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: "ws_personal",
          projectId: "prj_personal",
          intent: "x",
          current: null,
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
