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

const ARTIFACT_ID = `art_${"a".repeat(64)}`;

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

describe("/api/projects/:id/sources/extract", () => {
  it("forwards a validated Project Artifact extraction to Hub", async () => {
    hubPool
      .intercept({
        path: "/v1/projects/prj_finance/sources/extract",
        method: "POST",
      })
      .reply(200, {
        operationId: "op_projectextractproxy001",
        projectId: "prj_finance",
        workspaceId: "ws_personal",
        sourceArtifactId: ARTIFACT_ID,
        task: "ocr",
        state: "READY",
        result: {
          routeUsed: "local",
          adapter: "test",
          provider: "local",
          model: "test-local",
          language: "id",
          text: "Project context",
          segments: [],
          actualUsd: 0,
          naiveUsd: 0,
        },
        contextEpisodeId: "epi_projectextractproxy001",
      });

    const response = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          artifactId: ARTIFACT_ID,
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      projectId: "prj_finance",
      sourceArtifactId: ARTIFACT_ID,
      state: "READY",
    });
  });

  it("rejects invalid extraction input before Hub", async () => {
    const response = await POST(
      new Request("http://ai.local/api/projects/prj_finance/sources/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: "ws_personal",
          artifactId: "not-an-artifact",
        }),
      }),
      { params: Promise.resolve({ id: "prj_finance" }) },
    );
    expect(response.status).toBe(400);
  });
});
