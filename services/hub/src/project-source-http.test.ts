import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;
let context: Interceptable;
let space: Interceptable;
let flow: Interceptable;
let connect: Interceptable;
let db: HubDatabase;
let app: ReturnType<typeof buildHubServer>;

const ARTIFACT_ID = `art_${"a".repeat(64)}`;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  context = agent.get("http://context.local");
  space = agent.get("http://space.local");
  flow = agent.get("http://flow.local");
  connect = agent.get("http://connect.local");
  db = openHubDatabase();
  app = buildHubServer(db, {
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
    spaceUrl: "http://space.local",
    flowUrl: "http://flow.local",
  });
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await app.close();
  await agent.close();
  db.close();
});

function sourceBody(
  resourceType: "artifact" | "space-page" | "flow-graph" | "mcp-server" | "url",
  resourceId: string,
) {
  return {
    workspaceId: "ws_personal",
    resourceType,
    resourceId,
    role: "source",
  };
}

describe("PE-02 Project Sources HTTP", () => {
  it("attaches/deduplicates/lists/detaches URL binding and records audit without content", async () => {
    const payload = sourceBody("url", "https://example.com/reference");

    const first = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload,
    });
    expect(first.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload,
    });
    expect(duplicate.statusCode).toBe(200);

    const list = await app.inject({
      method: "GET",
      url: "/v1/projects/prj_personal/sources?workspaceId=ws_personal",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().sources).toHaveLength(1);
    expect(list.json().sources[0]).toMatchObject({
      availability: "AVAILABLE",
      binding: {
        projectId: "prj_personal",
        workspaceId: "ws_personal",
        resourceType: "url",
        resourceId: "https://example.com/reference",
        owner: "Connect",
        role: "source",
      },
    });

    const detached = await app.inject({
      method: "DELETE",
      url: "/v1/projects/prj_personal/sources",
      payload,
    });
    expect(detached.statusCode).toBe(200);

    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    const projectEvents = (
      audit.json().events as Array<{
        type: string;
        detail: Record<string, unknown>;
      }>
    ).filter((event) => event.type.startsWith("PROJECT_SOURCE_"));
    expect(projectEvents.map((event) => event.type)).toEqual([
      "PROJECT_SOURCE_ATTACHED",
      "PROJECT_SOURCE_DETACHED",
    ]);
    expect(JSON.stringify(projectEvents)).not.toContain("reference content");
  });

  it("validates Artifact through Context and later reports unavailable without deleting binding", async () => {
    context
      .intercept({
        path: `/v1/artifacts/${ARTIFACT_ID}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, {
        id: ARTIFACT_ID,
        description: "Evidence",
        mimeType: "text/plain",
        sizeBytes: 12,
      });

    const attached = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload: sourceBody("artifact", ARTIFACT_ID),
    });
    expect(attached.statusCode).toBe(201);

    context
      .intercept({
        path: `/v1/artifacts/${ARTIFACT_ID}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(404, { error: { type: "NOT_FOUND", message: "gone" } });

    const list = await app.inject({
      method: "GET",
      url: "/v1/projects/prj_personal/sources?workspaceId=ws_personal",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().sources[0]).toMatchObject({
      availability: "UNAVAILABLE",
      binding: { resourceType: "artifact", resourceId: ARTIFACT_ID },
    });
  });

  it("validates Space, Flow and MCP references in the Project Workspace", async () => {
    space
      .intercept({
        path: "/v1/pages/page_source1?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        page: {
          id: "page_source1",
          workspaceId: "ws_personal",
          title: "Source page",
        },
      });
    flow
      .intercept({
        path: "/v1/graphs?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        graphs: [
          {
            graphId: "fg_source1",
            workspaceId: "ws_personal",
            projectId: "prj_personal",
            name: "Source flow",
            currentVersion: 1,
          },
        ],
      });
    connect
      .intercept({
        path: "/v1/mcp-outbound/servers?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, {
        servers: [
          {
            id: "docs-server",
            displayName: "Docs",
            enabled: true,
            workspaceIds: ["ws_personal"],
          },
        ],
      });

    for (const [resourceType, resourceId] of [
      ["space-page", "page_source1"],
      ["flow-graph", "fg_source1"],
      ["mcp-server", "docs-server"],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/projects/prj_personal/sources",
        payload: sourceBody(resourceType, resourceId),
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().availability).toBe("AVAILABLE");
    }
  });

  it("fails closed for invalid owner identity and archived Project", async () => {
    space
      .intercept({
        path: "/v1/pages/page_missing?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(404, { error: { type: "NOT_FOUND", message: "missing" } });

    const missing = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload: sourceBody("space-page", "page_missing"),
    });
    expect(missing.statusCode).toBe(404);

    const invalidUrl = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload: sourceBody("url", "http://example.com/not-allowed"),
    });
    expect(invalidUrl.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: "/v1/projects",
      payload: { workspaceId: "ws_personal", name: "Archived" },
    });
    expect(created.statusCode).toBe(201);
    const projectId = created.json().id as string;
    const archived = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/archive`,
      payload: { workspaceId: "ws_personal" },
    });
    expect(archived.statusCode).toBe(200);

    const blocked = await app.inject({
      method: "POST",
      url: `/v1/projects/${projectId}/sources`,
      payload: sourceBody("url", "https://example.com/archived"),
    });
    expect(blocked.statusCode).toBe(409);
  });

  it("rejects cross-Workspace binding before owner lookup", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload: {
        workspaceId: "ws_other",
        resourceType: "url",
        resourceId: "https://example.com/cross-workspace",
        role: "source",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(
      db.raw.prepare("SELECT COUNT(*) AS count FROM project_source_bindings").get(),
    ).toEqual({ count: 0 });
  });

  it("rejects Artifact binding when Context authorization denies access", async () => {
    context
      .intercept({
        path: `/v1/artifacts/${ARTIFACT_ID}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(403, { error: { type: "FORBIDDEN", message: "not authorized" } });

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload: sourceBody("artifact", ARTIFACT_ID),
    });

    expect(response.statusCode).toBe(404);
    expect(
      db.raw.prepare("SELECT COUNT(*) AS count FROM project_source_bindings").get(),
    ).toEqual({ count: 0 });
  });
});
