import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { openHubDatabase, type HubDatabase } from "../services/hub/src/db.js";
import { buildHubServer } from "../services/hub/src/http.js";

const INTERNAL_TOKEN = "synthetic-internal-token";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;
let connect: Interceptable;
let artifact: Interceptable;
let context: Interceptable;
let db: HubDatabase;
let app: ReturnType<typeof buildHubServer>;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  connect = agent.get("http://connect.local");
  artifact = agent.get("http://artifact.local");
  context = agent.get("http://context.local");
  db = openHubDatabase();
  app = buildHubServer(db, {
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
    spaceUrl: "http://space.local",
    flowUrl: "http://flow.local",
    artifactUrl: "http://artifact.local",
    internalToken: INTERNAL_TOKEN,
  });
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await app.close();
  await agent.close();
  db.close();
});

describe("Session 12D Google Drive mock acceptance — Hub lifecycle", () => {
  it("refreshes one Drive origin to a new Artifact and resets indexed state", async () => {
    const fileId = "drive-file-refresh-1";
    const artifactA = `art_${"a".repeat(64)}`;
    const artifactB = `art_${"b".repeat(64)}`;
    const snapshotA = Buffer.from("# Version A\n");
    const snapshotB = Buffer.from("# Version B\n");

    const pointerA = {
      id: artifactA,
      path: `cas/${artifactA}`,
      description: "Google Drive: Refresh plan",
      mimeType: "text/markdown",
      sizeBytes: snapshotA.byteLength,
      scope: "personal",
      sensitivity: "RESTRICTED",
      syncClass: "LOCAL_ONLY",
    };
    const pointerB = {
      ...pointerA,
      id: artifactB,
      path: `cas/${artifactB}`,
      sizeBytes: snapshotB.byteLength,
    };

    connect
      .intercept({
        path: "/v1/source-fetch/google-drive",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal", fileId }),
      })
      .reply(200, {
        fileId,
        name: "Refresh plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T06:00:00.000Z",
        sizeBytes: snapshotA.byteLength,
        contentBase64: snapshotA.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
        body: JSON.stringify({
          contentBase64: snapshotA.toString("base64"),
          mimeType: "text/markdown",
          description: "Google Drive: Refresh plan",
          scope: "personal",
          sensitivity: "RESTRICTED",
          syncClass: "LOCAL_ONLY",
        }),
      })
      .reply(201, { pointer: pointerA, deduplicated: false });
    context
      .intercept({
        path: `/v1/artifacts/${artifactA}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, pointerA);

    const first = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: "op_drive_mock_acceptance_first",
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().artifact.id).toBe(artifactA);

    db.raw
      .prepare(
        `UPDATE project_external_source_lifecycle
         SET latest_context_episode_id=?, state='INDEXED', last_indexed_at=?, updated_at=?
         WHERE project_id=? AND workspace_id=? AND source_type='google-drive'
           AND source_key=? AND role='source'`,
      )
      .run(
        "epi_drive_mock_acceptance",
        "2026-10-03T06:15:00.000Z",
        "2026-10-03T06:15:00.000Z",
        "prj_personal",
        "ws_personal",
        fileId,
      );

    connect
      .intercept({
        path: "/v1/source-fetch/google-drive",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal", fileId }),
      })
      .reply(200, {
        fileId,
        name: "Refresh plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T06:20:00.000Z",
        sizeBytes: snapshotB.byteLength,
        contentBase64: snapshotB.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
        body: JSON.stringify({
          contentBase64: snapshotB.toString("base64"),
          mimeType: "text/markdown",
          description: "Google Drive: Refresh plan",
          scope: "personal",
          sensitivity: "RESTRICTED",
          syncClass: "LOCAL_ONLY",
        }),
      })
      .reply(201, { pointer: pointerB, deduplicated: false });
    context
      .intercept({
        path: `/v1/artifacts/${artifactB}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, pointerB);

    const refreshed = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: "op_drive_mock_acceptance_refresh",
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().artifact.id).toBe(artifactB);

    const lifecycle = await app.inject({
      method: "GET",
      url: "/v1/projects/prj_personal/sources/lifecycle?workspaceId=ws_personal",
    });
    expect(lifecycle.statusCode).toBe(200);
    expect(lifecycle.json()).toMatchObject({
      lifecycles: [
        {
          sourceType: "google-drive",
          sourceKey: fileId,
          role: "source",
          latestArtifactId: artifactB,
          latestContextEpisodeId: null,
          state: "SNAPSHOT_READY",
          lastIndexedAt: null,
        },
      ],
    });

    const retry = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: "op_drive_mock_acceptance_refresh",
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().artifact.id).toBe(artifactB);

    const rows = db.raw
      .prepare(
        `SELECT resource_id
         FROM project_source_bindings
         WHERE project_id=? AND workspace_id=? AND resource_type='artifact'
         ORDER BY resource_id`,
      )
      .all("prj_personal", "ws_personal") as Array<{ resource_id: string }>;
    expect(rows.map((row) => row.resource_id)).toEqual([artifactA, artifactB]);
  });
});
