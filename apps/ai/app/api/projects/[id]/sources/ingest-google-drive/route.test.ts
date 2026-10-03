import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;
let hubPool: Interceptable;
let originalHubUrl: string | undefined;

const ARTIFACT_ID = `art_${"c".repeat(64)}`;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  hubPool = agent.get("http://hub.local");
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await agent.close();
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
});

describe("/api/projects/:id/sources/ingest-google-drive", () => {
  it("forwards validated Personal Workspace Drive ingestion to Hub", async () => {
    hubPool
      .intercept({
        path: "/v1/projects/prj_finance/sources/ingest-google-drive",
        method: "POST",
      })
      .reply(200, {
        operationId: "op_projectdriveproxy001",
        projectId: "prj_finance",
        workspaceId: "ws_personal",
        fileId: "file-123",
        fileName: "Quarterly plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        artifact: {
          id: ARTIFACT_ID,
          path: `cas/${ARTIFACT_ID}`,
          description: "Google Drive: Quarterly plan",
          mimeType: "text/markdown",
          sizeBytes: 12,
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
            createdAt: "2026-10-03T02:00:00.000Z",
          },
          availability: "AVAILABLE",
          metadata: { id: ARTIFACT_ID },
          unavailableReason: null,
        },
        state: "READY",
      });

    const response = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources/ingest-google-drive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          fileId: "file-123",
          role: "source",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      projectId: "prj_finance",
      workspaceId: "ws_personal",
      fileId: "file-123",
      artifact: { id: ARTIFACT_ID, sensitivity: "RESTRICTED" },
      state: "READY",
    });
  });

  it("rejects non-Personal Workspace before Hub", async () => {
    const response = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources/ingest-google-drive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_other",
          fileId: "file-123",
          role: "source",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(response.status).toBe(400);
  });
});
