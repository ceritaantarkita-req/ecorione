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
let artifact: Interceptable;
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
  artifact = agent.get("http://artifact.local");
  db = openHubDatabase();
  app = buildHubServer(db, {
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
    spaceUrl: "http://space.local",
    flowUrl: "http://flow.local",
    artifactUrl: "http://artifact.local",
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

  it("ingests a bound HTTPS URL into an Artifact snapshot without chat history", async () => {
    const sourceUrl = "https://example.com/source.txt";
    const snapshot = Buffer.from("url snapshot");
    const pointer = {
      id: ARTIFACT_ID,
      path: `cas/${ARTIFACT_ID}`,
      description: `URL snapshot: ${sourceUrl}`,
      mimeType: "text/plain",
      sizeBytes: snapshot.byteLength,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    };

    const attachedUrl = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources",
      payload: sourceBody("url", sourceUrl),
    });
    expect(attachedUrl.statusCode).toBe(201);

    connect
      .intercept({
        path: "/v1/source-fetch/url",
        method: "POST",
        body: JSON.stringify({ url: sourceUrl }),
      })
      .reply(200, {
        url: sourceUrl,
        mimeType: "text/plain",
        sizeBytes: snapshot.byteLength,
        contentBase64: snapshot.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
        body: JSON.stringify({
          contentBase64: snapshot.toString("base64"),
          mimeType: "text/plain",
          description: `URL snapshot: ${sourceUrl}`,
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
        }),
      })
      .reply(201, {
        pointer,
        deduplicated: false,
      });
    context
      .intercept({
        path: `/v1/artifacts/${ARTIFACT_ID}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, pointer);

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-url",
      payload: {
        operationId: "op_projecturlingest001",
        workspaceId: "ws_personal",
        url: sourceUrl,
        role: "source",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      operationId: "op_projecturlingest001",
      projectId: "prj_personal",
      workspaceId: "ws_personal",
      url: sourceUrl,
      artifact: { id: ARTIFACT_ID, syncClass: "LOCAL_ONLY" },
      source: {
        availability: "AVAILABLE",
        binding: {
          resourceType: "artifact",
          resourceId: ARTIFACT_ID,
          role: "source",
        },
      },
      state: "READY",
    });

    expect(
      db.raw
        .prepare(
          "SELECT COUNT(*) AS count FROM project_source_bindings WHERE project_id=? AND workspace_id=?",
        )
        .get("prj_personal", "ws_personal"),
    ).toEqual({ count: 2 });
    expect(
      db.raw
        .prepare("SELECT COUNT(*) AS count FROM history_events WHERE operation_id=?")
        .get("op_projecturlingest001"),
    ).toEqual({ count: 0 });

    const retry = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-url",
      payload: {
        operationId: "op_projecturlingest001",
        workspaceId: "ws_personal",
        url: sourceUrl,
        role: "source",
      },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().artifact.id).toBe(ARTIFACT_ID);

    const audit = await app.inject({
      method: "GET",
      url: "/v1/audit?operationId=op_projecturlingest001",
    });
    expect(audit.json().events.map((event: { type: string }) => event.type)).toEqual(
      expect.arrayContaining([
        "PROJECT_SOURCE_ATTACHED",
        "PROJECT_SOURCE_INGESTED",
        "ACTION_SKIPPED_IDEMPOTENT",
      ]),
    );
  });

  it("rejects URL ingestion when the URL is not already bound to the Project", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-url",
      payload: {
        operationId: "op_projecturlingest002",
        workspaceId: "ws_personal",
        url: "https://example.com/unbound",
        role: "source",
      },
    });
    expect(response.statusCode).toBe(404);
  });

  it("extracts an attached Artifact into Project-scoped Context without chat history", async () => {
    const sourceBytes = Buffer.from("Project source text");
    const pointer = {
      id: ARTIFACT_ID,
      path: `cas/${ARTIFACT_ID}`,
      description: "Project source",
      mimeType: "text/plain",
      sizeBytes: sourceBytes.byteLength,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    };

    context
      .intercept({
        path: `/v1/artifacts/${ARTIFACT_ID}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, pointer);
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
      .reply(200, pointer);
    artifact
      .intercept({
        path: `/v1/artifacts/${ARTIFACT_ID}/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, sourceBytes, { headers: { "content-type": "text/plain" } });
    connect.intercept({ path: "/v1/multimodal/infer", method: "POST" }).reply(200, {
      routeUsed: "local",
      adapter: "project-ocr-local-v1",
      provider: "local",
      model: "project-ocr-20260925",
      language: "id",
      text: "Isi dokumen Project",
      segments: [{ text: "Isi dokumen Project", page: 1, confidence: 0.99 }],
      actualUsd: 0,
      naiveUsd: 0,
    });
    context.intercept({ path: "/v1/episodes", method: "POST" }).reply(201, {
      id: "epi_projectsource001",
      ts: "2026-09-25T00:00:00.000Z",
      rawText: "Isi dokumen Project",
      projectId: "prj_personal",
      provenance: {
        sourceApp: "hub:project-source",
        toolCallId: "op_projectextract001",
        sourceUri: `artifact:${ARTIFACT_ID}`,
      },
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "LOCAL_AGENT",
      summary: null,
      consolidatedAt: null,
    });
    context
      .intercept({ path: "/v1/multimodal/derivations", method: "POST" })
      .reply(201, { ok: true });

    const response = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/extract",
      payload: {
        operationId: "op_projectextract001",
        workspaceId: "ws_personal",
        artifactId: ARTIFACT_ID,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      operationId: "op_projectextract001",
      projectId: "prj_personal",
      workspaceId: "ws_personal",
      sourceArtifactId: ARTIFACT_ID,
      task: "ocr",
      state: "READY",
      contextEpisodeId: "epi_projectsource001",
      result: {
        routeUsed: "local",
        text: "Isi dokumen Project",
      },
    });

    expect(
      db.raw
        .prepare("SELECT COUNT(*) AS count FROM history_events WHERE operation_id=?")
        .get("op_projectextract001"),
    ).toEqual({ count: 0 });

    const audit = await app.inject({
      method: "GET",
      url: "/v1/audit?operationId=op_projectextract001",
    });
    expect(audit.json().events.map((event: { type: string }) => event.type)).toContain(
      "PROJECT_SOURCE_EXTRACTED",
    );
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
