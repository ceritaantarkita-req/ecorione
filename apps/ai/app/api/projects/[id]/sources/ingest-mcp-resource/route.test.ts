import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let hubPool: Interceptable;
let originalHubUrl: string | undefined;

const ARTIFACT_ID = `art_${"c".repeat(64)}`;

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

describe("/api/projects/:id/sources/ingest-mcp-resource", () => {
  it("forwards a validated MCP resource ingestion to Hub", async () => {
    hubPool
      .intercept({
        path: "/v1/projects/prj_finance/sources/ingest-mcp-resource",
        method: "POST",
      })
      .reply(200, {
        operationId: "op_projectmcpproxy001",
        projectId: "prj_finance",
        workspaceId: "ws_personal",
        serverId: "drive",
        resourceUri: "gdrive://file/1",
        artifact: {
          id: ARTIFACT_ID,
          path: `cas/${ARTIFACT_ID}`,
          description: "MCP drive: gdrive://file/1",
          mimeType: "application/pdf",
          sizeBytes: 5,
          scope: "personal",
          sensitivity: "RESTRICTED",
          syncClass: "LOCAL_ONLY",
        },
        source: {
          binding: {
            projectId: "prj_finance",
            workspaceId: "ws_personal",
            resourceType: "artifact",
            resourceId: ARTIFACT_ID,
            owner: "Artifact",
            role: "source",
            createdAt: "2026-09-25T00:00:00.000Z",
          },
          availability: "AVAILABLE",
          metadata: { id: ARTIFACT_ID },
          unavailableReason: null,
        },
        state: "READY",
      });

    const response = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources/ingest-mcp-resource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          serverId: "drive",
          resourceUri: "gdrive://file/1",
          role: "source",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      projectId: "prj_finance",
      serverId: "drive",
      resourceUri: "gdrive://file/1",
      artifact: { id: ARTIFACT_ID, sensitivity: "RESTRICTED" },
      state: "READY",
    });
  });

  it("rejects invalid MCP ingestion input before Hub", async () => {
    const response = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources/ingest-mcp-resource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          serverId: "INVALID SERVER",
          resourceUri: "",
          role: "source",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(response.status).toBe(400);
  });
});
