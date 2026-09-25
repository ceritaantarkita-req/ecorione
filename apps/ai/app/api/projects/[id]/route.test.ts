import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { PATCH } from "./route";

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

describe("PATCH /api/projects/:id", () => {
  it("updates editable Project settings through Hub", async () => {
    const body = {
      workspaceId: "ws_personal",
      name: "Finance desk",
      description: "Market research",
      instruction: "Prioritize primary sources.",
      autonomyCeiling: "L2",
    };

    pool
      .intercept({
        path: "/v1/projects/prj_finance",
        method: "PATCH",
        body: JSON.stringify(body),
      })
      .reply(200, {
        id: "prj_finance",
        workspaceId: "ws_personal",
        ...body,
        memoryPolicy: "GLOBAL_PLUS_PROJECT",
        createdAt: "2026-09-19T00:00:00.000Z",
        updatedAt: "2026-09-25T03:00:00.000Z",
        archivedAt: null,
      });

    const response = await PATCH(
      new Request("http://ai.local/api/projects/prj_finance", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );

    expect(response.status).toBe(200);
    expect((await response.json()) as { autonomyCeiling: string }).toMatchObject({
      autonomyCeiling: "L2",
    });
  });

  it("rejects an invalid Project id before Hub egress", async () => {
    const response = await PATCH(
      new Request("http://ai.local/api/projects/bad", {
        method: "PATCH",
        body: JSON.stringify({ workspaceId: "ws_personal", name: "Finance" }),
      }),
      { params: Promise.resolve({ id: "bad" }) },
    );
    expect(response.status).toBe(400);
  });

  it("rejects unsupported memory-policy edits and empty patches", async () => {
    const unsupported = await PATCH(
      new Request("http://ai.local/api/projects/prj_finance", {
        method: "PATCH",
        body: JSON.stringify({
          workspaceId: "ws_personal",
          memoryPolicy: "PROJECT_ONLY",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(unsupported.status).toBe(400);

    const empty = await PATCH(
      new Request("http://ai.local/api/projects/prj_finance", {
        method: "PATCH",
        body: JSON.stringify({ workspaceId: "ws_personal" }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(empty.status).toBe(400);
  });
});
