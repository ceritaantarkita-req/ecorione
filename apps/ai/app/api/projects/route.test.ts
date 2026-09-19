import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { GET, POST } from "./route";

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

describe("Ai Projects API", () => {
  it("lists the Personal Workspace Projects through Hub", async () => {
    pool
      .intercept({
        path: "/v1/projects?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        projects: [
          {
            id: "prj_personal",
            workspaceId: "ws_personal",
            name: "Personal",
            description: "",
            instruction: "",
            memoryPolicy: "GLOBAL_PLUS_PROJECT",
            autonomyCeiling: "L3",
            createdAt: "2026-09-19T00:00:00.000Z",
            updatedAt: "2026-09-19T00:00:00.000Z",
            archivedAt: null,
          },
        ],
      });

    const res = await GET(new Request("http://ai.local/api/projects"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { projects: unknown[] }).projects).toHaveLength(1);
  });

  it("creates a Project with schema defaults before forwarding to Hub", async () => {
    pool
      .intercept({
        path: "/v1/projects",
        method: "POST",
        body: JSON.stringify({
          workspaceId: "ws_personal",
          name: "Finance",
          description: "",
          instruction: "",
          memoryPolicy: "GLOBAL_PLUS_PROJECT",
          autonomyCeiling: "L3",
        }),
      })
      .reply(201, {
        id: "prj_finance",
        workspaceId: "ws_personal",
        name: "Finance",
        description: "",
        instruction: "",
        memoryPolicy: "GLOBAL_PLUS_PROJECT",
        autonomyCeiling: "L3",
        createdAt: "2026-09-19T00:00:00.000Z",
        updatedAt: "2026-09-19T00:00:00.000Z",
        archivedAt: null,
      });

    const res = await POST(
      new Request("http://ai.local/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Finance" }),
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()) as { id: string }).toMatchObject({ id: "prj_finance" });
  });

  it("rejects invalid Workspace input before Hub egress", async () => {
    const res = await GET(
      new Request("http://ai.local/api/projects?workspaceId=not-a-workspace"),
    );
    expect(res.status).toBe(400);
  });
});
