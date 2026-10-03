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

function mockDirectTextIndex(input: {
  artifactId: string;
  pointer: Record<string, unknown>;
  bytes: Buffer;
  operationId: string;
  episodeId: string;
  rawText: string;
  ts: string;
}): void {
  context
    .intercept({
      path: `/v1/artifacts/${input.artifactId}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
      method: "GET",
    })
    .reply(200, input.pointer);

  artifact
    .intercept({
      path: `/v1/artifacts/${input.artifactId}/content?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
      method: "GET",
    })
    .reply(200, input.bytes, {
      headers: { "content-type": "text/markdown" },
    });

  context.intercept({ path: "/v1/episodes", method: "POST" }).reply(201, {
    id: input.episodeId,
    ts: input.ts,
    rawText: input.rawText,
    projectId: "prj_personal",
    provenance: {
      sourceApp: "hub:project-source",
      toolCallId: input.operationId,
      sourceUri: `artifact:${input.artifactId}`,
    },
    scope: "personal",
    sensitivity: "RESTRICTED",
    syncClass: "LOCAL_ONLY",
    trust: "THIRD_PARTY",
    summary: null,
    consolidatedAt: null,
  });

  context
    .intercept({ path: "/v1/multimodal/derivations", method: "POST" })
    .reply(201, { ok: true });
}

async function lifecycleFor(fileId: string) {
  const response = await app.inject({
    method: "GET",
    url: "/v1/projects/prj_personal/sources/lifecycle?workspaceId=ws_personal",
  });
  expect(response.statusCode).toBe(200);
  const lifecycle = response
    .json()
    .lifecycles.find(
      (item: { sourceType: string; sourceKey: string }) =>
        item.sourceType === "google-drive" && item.sourceKey === fileId,
    );
  expect(lifecycle).toBeDefined();
  return lifecycle as Record<string, unknown>;
}

describe("Session 12D Google Drive mock acceptance — Hub lifecycle", () => {
  it("runs Index -> refresh -> Re-index -> idempotent retry -> Detach through public routes", async () => {
    const fileId = "drive-file-refresh-1";
    const artifactA = `art_${"a".repeat(64)}`;
    const artifactB = `art_${"b".repeat(64)}`;
    const snapshotA = Buffer.from("# Version A\n");
    const snapshotB = Buffer.from("# Version B\n");
    const indexAOperation = "op_drive_mock_acceptance_index_a";
    const indexBOperation = "op_drive_mock_acceptance_index_b";
    const episodeA = "epi_drive_mock_acceptance_a";
    const episodeB = "epi_drive_mock_acceptance_b";

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
    expect(await lifecycleFor(fileId)).toMatchObject({
      latestArtifactId: artifactA,
      latestContextEpisodeId: null,
      state: "SNAPSHOT_READY",
      lastIndexedAt: null,
    });

    mockDirectTextIndex({
      artifactId: artifactA,
      pointer: pointerA,
      bytes: snapshotA,
      operationId: indexAOperation,
      episodeId: episodeA,
      rawText: "# Version A\n",
      ts: "2026-10-03T06:10:00.000Z",
    });

    const indexedA = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/extract",
      payload: {
        operationId: indexAOperation,
        workspaceId: "ws_personal",
        artifactId: artifactA,
      },
    });
    expect(indexedA.statusCode).toBe(200);
    expect(indexedA.json()).toMatchObject({
      sourceArtifactId: artifactA,
      task: "ocr",
      state: "READY",
      contextEpisodeId: episodeA,
      result: {
        routeUsed: "local",
        adapter: "direct-text",
        provider: "artifact",
        model: "utf-8",
        text: "# Version A\n",
      },
    });
    expect(await lifecycleFor(fileId)).toMatchObject({
      latestArtifactId: artifactA,
      latestContextEpisodeId: episodeA,
      state: "INDEXED",
      lastIndexedAt: expect.any(String),
    });

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
    expect(await lifecycleFor(fileId)).toMatchObject({
      latestArtifactId: artifactB,
      latestContextEpisodeId: null,
      state: "SNAPSHOT_READY",
      lastIndexedAt: null,
    });

    mockDirectTextIndex({
      artifactId: artifactB,
      pointer: pointerB,
      bytes: snapshotB,
      operationId: indexBOperation,
      episodeId: episodeB,
      rawText: "# Version B\n",
      ts: "2026-10-03T06:30:00.000Z",
    });

    const indexedB = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/extract",
      payload: {
        operationId: indexBOperation,
        workspaceId: "ws_personal",
        artifactId: artifactB,
      },
    });
    expect(indexedB.statusCode).toBe(200);
    expect(indexedB.json()).toMatchObject({
      sourceArtifactId: artifactB,
      contextEpisodeId: episodeB,
      result: { routeUsed: "local", text: "# Version B\n" },
    });
    expect(await lifecycleFor(fileId)).toMatchObject({
      latestArtifactId: artifactB,
      latestContextEpisodeId: episodeB,
      state: "INDEXED",
      lastIndexedAt: expect.any(String),
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
    expect(await lifecycleFor(fileId)).toMatchObject({
      latestArtifactId: artifactB,
      latestContextEpisodeId: episodeB,
      state: "INDEXED",
    });

    const detached = await app.inject({
      method: "DELETE",
      url: "/v1/projects/prj_personal/sources",
      payload: {
        workspaceId: "ws_personal",
        resourceType: "artifact",
        resourceId: artifactB,
        role: "source",
      },
    });
    expect(detached.statusCode).toBe(200);
    expect(detached.json()).toMatchObject({
      detached: true,
      binding: { resourceType: "artifact", resourceId: artifactB, role: "source" },
    });
    expect(await lifecycleFor(fileId)).toMatchObject({
      latestArtifactId: artifactB,
      latestContextEpisodeId: episodeB,
      state: "DETACHED",
    });

    const rows = db.raw
      .prepare(
        `SELECT resource_id
         FROM project_source_bindings
         WHERE project_id=? AND workspace_id=? AND resource_type='artifact'
         ORDER BY resource_id`,
      )
      .all("prj_personal", "ws_personal") as Array<{ resource_id: string }>;
    expect(rows.map((row) => row.resource_id)).toEqual([artifactA]);

    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    const eventTypes = (audit.json().events as Array<{ type: string }>).map(
      (event) => event.type,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        "PROJECT_SOURCE_INGESTED",
        "PROJECT_SOURCE_EXTRACTED",
        "ACTION_SKIPPED_IDEMPOTENT",
        "PROJECT_SOURCE_DETACHED",
      ]),
    );
  });

  it("preserves the last indexed Drive snapshot when refresh fails", async () => {
    const fileId = "drive-file-preserve-on-refresh-failure";
    const artifactId = `art_${"c".repeat(64)}`;
    const snapshot = Buffer.from("# Stable indexed snapshot\n");
    const indexOperation = "op_drive_refresh_failure_baseline_index";
    const episodeId = "epi_drive_refresh_failure_baseline";
    const pointer = {
      id: artifactId,
      path: `cas/${artifactId}`,
      description: "Google Drive: Stable plan",
      mimeType: "text/markdown",
      sizeBytes: snapshot.byteLength,
      scope: "personal",
      sensitivity: "RESTRICTED",
      syncClass: "LOCAL_ONLY",
    };

    connect
      .intercept({
        path: "/v1/source-fetch/google-drive",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal", fileId }),
      })
      .reply(200, {
        fileId,
        name: "Stable plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T07:00:00.000Z",
        sizeBytes: snapshot.byteLength,
        contentBase64: snapshot.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
        body: JSON.stringify({
          contentBase64: snapshot.toString("base64"),
          mimeType: "text/markdown",
          description: "Google Drive: Stable plan",
          scope: "personal",
          sensitivity: "RESTRICTED",
          syncClass: "LOCAL_ONLY",
        }),
      })
      .reply(201, { pointer, deduplicated: false });
    context
      .intercept({
        path: `/v1/artifacts/${artifactId}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, pointer);

    const ingested = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: "op_drive_refresh_failure_baseline_ingest",
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(ingested.statusCode).toBe(200);
    expect(ingested.json().artifact.id).toBe(artifactId);

    mockDirectTextIndex({
      artifactId,
      pointer,
      bytes: snapshot,
      operationId: indexOperation,
      episodeId,
      rawText: "# Stable indexed snapshot\n",
      ts: "2026-10-03T07:10:00.000Z",
    });

    const indexed = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/extract",
      payload: {
        operationId: indexOperation,
        workspaceId: "ws_personal",
        artifactId,
      },
    });
    expect(indexed.statusCode).toBe(200);

    const baseline = await lifecycleFor(fileId);
    expect(baseline).toMatchObject({
      latestArtifactId: artifactId,
      latestContextEpisodeId: episodeId,
      state: "INDEXED",
      lastRefreshedAt: expect.any(String),
      lastIndexedAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const failures = [
      {
        suffix: "reconnect",
        upstreamStatus: 409,
        upstreamType: "GOOGLE_DRIVE_NOT_CONNECTED",
        expectedStatus: 409,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        suffix: "permission",
        upstreamStatus: 403,
        upstreamType: "GOOGLE_DRIVE_FILE_DOWNLOAD_DENIED",
        expectedStatus: 403,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        suffix: "missing",
        upstreamStatus: 404,
        upstreamType: "GOOGLE_DRIVE_FILE_NOT_FOUND",
        expectedStatus: 404,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        suffix: "rate",
        upstreamStatus: 429,
        upstreamType: "GOOGLE_DRIVE_RATE_LIMITED",
        expectedStatus: 429,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        suffix: "timeout",
        upstreamStatus: 504,
        upstreamType: "GOOGLE_DRIVE_API_TIMEOUT",
        expectedStatus: 504,
        expectedType: "GOOGLE_DRIVE_SOURCE_TIMEOUT",
      },
      {
        suffix: "upstream",
        upstreamStatus: 502,
        upstreamType: "GOOGLE_DRIVE_API_UPSTREAM",
        expectedStatus: 502,
        expectedType: "UPSTREAM_UNAVAILABLE",
      },
    ] as const;

    for (const failure of failures) {
      connect
        .intercept({
          path: "/v1/source-fetch/google-drive",
          method: "POST",
          body: JSON.stringify({ workspaceId: "ws_personal", fileId }),
        })
        .reply(failure.upstreamStatus, {
          error: {
            type: failure.upstreamType,
            message: "synthetic refresh failure detail",
          },
        });

      const operationId = `op_drive_refresh_failure_${failure.suffix}`;
      const response = await app.inject({
        method: "POST",
        url: "/v1/projects/prj_personal/sources/ingest-google-drive",
        payload: {
          operationId,
          workspaceId: "ws_personal",
          fileId,
          role: "source",
        },
      });

      expect(response.statusCode).toBe(failure.expectedStatus);
      expect(response.json().error.type).toBe(failure.expectedType);

      expect(await lifecycleFor(fileId)).toMatchObject({
        latestArtifactId: artifactId,
        latestContextEpisodeId: episodeId,
        state: "INDEXED",
        lastRefreshedAt: baseline.lastRefreshedAt,
        lastIndexedAt: baseline.lastIndexedAt,
        updatedAt: baseline.updatedAt,
      });

      const bindings = db.raw
        .prepare(
          `SELECT resource_id
           FROM project_source_bindings
           WHERE project_id=? AND workspace_id=? AND resource_type='artifact'
           ORDER BY resource_id`,
        )
        .all("prj_personal", "ws_personal") as Array<{ resource_id: string }>;
      expect(bindings.map((row) => row.resource_id)).toEqual([artifactId]);

      const failedAudit = await app.inject({
        method: "GET",
        url: `/v1/audit?operationId=${operationId}`,
      });
      const failedEventTypes = (failedAudit.json().events as Array<{ type: string }>).map(
        (event) => event.type,
      );
      expect(failedEventTypes).not.toContain("PROJECT_SOURCE_INGESTED");
      expect(failedEventTypes).not.toContain("PROJECT_SOURCE_ATTACHED");
    }

    const lifecycleCount = db.raw
      .prepare(
        `SELECT COUNT(*) AS count
         FROM project_external_source_lifecycle
         WHERE project_id=? AND workspace_id=? AND source_type='google-drive'`,
      )
      .get("prj_personal", "ws_personal") as { count: number };
    expect(lifecycleCount.count).toBe(1);

    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    const eventTypes = (audit.json().events as Array<{ type: string }>).map(
      (event) => event.type,
    );
    expect(eventTypes.filter((type) => type === "PROJECT_SOURCE_INGESTED")).toHaveLength(1);
    expect(eventTypes.filter((type) => type === "PROJECT_SOURCE_EXTRACTED")).toHaveLength(1);
  });

  it("preserves indexed Drive state when downstream snapshot materialization fails", async () => {
    const fileId = "drive-file-preserve-on-downstream-failure";
    const artifactA = `art_${"d".repeat(64)}`;
    const artifactB = `art_${"e".repeat(64)}`;
    const snapshotA = Buffer.from("# Last good indexed snapshot\n");
    const snapshotB = Buffer.from("# Candidate refresh snapshot\n");
    const episodeId = "epi_drive_downstream_failure_baseline";
    const pointerA = {
      id: artifactA,
      path: `cas/${artifactA}`,
      description: "Google Drive: Durable plan",
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
        name: "Durable plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T08:00:00.000Z",
        sizeBytes: snapshotA.byteLength,
        contentBase64: snapshotA.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
      })
      .reply(201, { pointer: pointerA, deduplicated: false });
    context
      .intercept({
        path: `/v1/artifacts/${artifactA}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(200, pointerA);

    const initial = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: "op_drive_downstream_failure_initial",
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(initial.statusCode).toBe(200);

    mockDirectTextIndex({
      artifactId: artifactA,
      pointer: pointerA,
      bytes: snapshotA,
      operationId: "op_drive_downstream_failure_index",
      episodeId,
      rawText: "# Last good indexed snapshot\n",
      ts: "2026-10-03T08:10:00.000Z",
    });

    const indexed = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/extract",
      payload: {
        operationId: "op_drive_downstream_failure_index",
        workspaceId: "ws_personal",
        artifactId: artifactA,
      },
    });
    expect(indexed.statusCode).toBe(200);

    const baseline = await lifecycleFor(fileId);
    expect(baseline).toMatchObject({
      latestArtifactId: artifactA,
      latestContextEpisodeId: episodeId,
      state: "INDEXED",
      lastRefreshedAt: expect.any(String),
      lastIndexedAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    async function expectBaselinePreserved(operationId: string): Promise<void> {
      expect(await lifecycleFor(fileId)).toMatchObject({
        latestArtifactId: artifactA,
        latestContextEpisodeId: episodeId,
        state: "INDEXED",
        lastRefreshedAt: baseline.lastRefreshedAt,
        lastIndexedAt: baseline.lastIndexedAt,
        updatedAt: baseline.updatedAt,
      });

      const bindings = db.raw
        .prepare(
          `SELECT resource_id
           FROM project_source_bindings
           WHERE project_id=? AND workspace_id=? AND resource_type='artifact'
           ORDER BY resource_id`,
        )
        .all("prj_personal", "ws_personal") as Array<{ resource_id: string }>;
      expect(bindings.map((row) => row.resource_id)).toEqual([artifactA]);

      const audit = await app.inject({
        method: "GET",
        url: `/v1/audit?operationId=${operationId}`,
      });
      const eventTypes = (audit.json().events as Array<{ type: string }>).map(
        (event) => event.type,
      );
      expect(eventTypes).not.toContain("PROJECT_SOURCE_INGESTED");
      expect(eventTypes).not.toContain("PROJECT_SOURCE_ATTACHED");
    }

    connect
      .intercept({
        path: "/v1/source-fetch/google-drive",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal", fileId }),
      })
      .reply(200, {
        fileId,
        name: "Durable plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T08:20:00.000Z",
        sizeBytes: snapshotB.byteLength,
        contentBase64: snapshotB.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
      })
      .reply(503, {
        error: {
          type: "UPSTREAM_UNAVAILABLE",
          message: "synthetic artifact outage",
        },
      });

    const artifactFailureOperation = "op_drive_downstream_artifact_failure";
    const artifactFailure = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: artifactFailureOperation,
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(artifactFailure.statusCode).toBe(502);
    expect(artifactFailure.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
    await expectBaselinePreserved(artifactFailureOperation);

    connect
      .intercept({
        path: "/v1/source-fetch/google-drive",
        method: "POST",
        body: JSON.stringify({ workspaceId: "ws_personal", fileId }),
      })
      .reply(200, {
        fileId,
        name: "Durable plan",
        sourceMimeType: "application/vnd.google-apps.document",
        snapshotMimeType: "text/markdown",
        modifiedTime: "2026-10-03T08:30:00.000Z",
        sizeBytes: snapshotB.byteLength,
        contentBase64: snapshotB.toString("base64"),
      });
    artifact
      .intercept({
        path: "/v1/artifacts",
        method: "POST",
      })
      .reply(201, { pointer: pointerB, deduplicated: false });
    context
      .intercept({
        path: `/v1/artifacts/${artifactB}/authorize?scope=personal&maxSensitivity=RESTRICTED&hostedEligible=0`,
        method: "GET",
      })
      .reply(503, {
        error: {
          type: "UPSTREAM_UNAVAILABLE",
          message: "synthetic context authorization outage",
        },
      });

    const ownerFailureOperation = "op_drive_downstream_owner_failure";
    const ownerFailure = await app.inject({
      method: "POST",
      url: "/v1/projects/prj_personal/sources/ingest-google-drive",
      payload: {
        operationId: ownerFailureOperation,
        workspaceId: "ws_personal",
        fileId,
        role: "source",
      },
    });
    expect(ownerFailure.statusCode).toBe(502);
    expect(ownerFailure.json().error.type).toBe("UPSTREAM_UNAVAILABLE");
    await expectBaselinePreserved(ownerFailureOperation);

    const lifecycleRows = db.raw
      .prepare(
        `SELECT latest_artifact_id,latest_context_episode_id,state
         FROM project_external_source_lifecycle
         WHERE project_id=? AND workspace_id=? AND source_type='google-drive' AND source_key=?`,
      )
      .all("prj_personal", "ws_personal", fileId);
    expect(lifecycleRows).toEqual([
      {
        latest_artifact_id: artifactA,
        latest_context_episode_id: episodeId,
        state: "INDEXED",
      },
    ]);
  });

  it("fails closed on Drive source errors without partial Project state", async () => {
    const cases = [
      {
        fileId: "drive-too-large",
        upstreamStatus: 413,
        upstreamType: "GOOGLE_DRIVE_FILE_TOO_LARGE",
        expectedStatus: 413,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        fileId: "drive-unsupported",
        upstreamStatus: 415,
        upstreamType: "GOOGLE_DRIVE_FILE_UNSUPPORTED",
        expectedStatus: 415,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        fileId: "drive-rate-limited",
        upstreamStatus: 429,
        upstreamType: "GOOGLE_DRIVE_RATE_LIMITED",
        expectedStatus: 429,
        expectedType: "GOOGLE_DRIVE_SOURCE_REJECTED",
      },
      {
        fileId: "drive-timeout",
        upstreamStatus: 504,
        upstreamType: "GOOGLE_DRIVE_API_TIMEOUT",
        expectedStatus: 504,
        expectedType: "GOOGLE_DRIVE_SOURCE_TIMEOUT",
      },
      {
        fileId: "drive-upstream-down",
        upstreamStatus: 502,
        upstreamType: "GOOGLE_DRIVE_API_UPSTREAM",
        expectedStatus: 502,
        expectedType: "UPSTREAM_UNAVAILABLE",
      },
    ] as const;

    for (const candidate of cases) {
      connect
        .intercept({
          path: "/v1/source-fetch/google-drive",
          method: "POST",
          body: JSON.stringify({
            workspaceId: "ws_personal",
            fileId: candidate.fileId,
          }),
        })
        .reply(candidate.upstreamStatus, {
          error: {
            type: candidate.upstreamType,
            message: "synthetic upstream detail",
          },
        });

      const response = await app.inject({
        method: "POST",
        url: "/v1/projects/prj_personal/sources/ingest-google-drive",
        payload: {
          operationId: `op_drive_failure_${candidate.fileId.replaceAll("-", "_")}`,
          workspaceId: "ws_personal",
          fileId: candidate.fileId,
          role: "source",
        },
      });

      expect(response.statusCode).toBe(candidate.expectedStatus);
      expect(response.json().error.type).toBe(candidate.expectedType);
    }

    const lifecycleCount = db.raw
      .prepare(
        `SELECT COUNT(*) AS count
         FROM project_external_source_lifecycle
         WHERE project_id=? AND workspace_id=? AND source_type='google-drive'`,
      )
      .get("prj_personal", "ws_personal") as { count: number };
    expect(lifecycleCount.count).toBe(0);

    const artifactBindingCount = db.raw
      .prepare(
        `SELECT COUNT(*) AS count
         FROM project_source_bindings
         WHERE project_id=? AND workspace_id=? AND resource_type='artifact'`,
      )
      .get("prj_personal", "ws_personal") as { count: number };
    expect(artifactBindingCount.count).toBe(0);

    const audit = await app.inject({ method: "GET", url: "/v1/audit" });
    const eventTypes = (audit.json().events as Array<{ type: string }>).map(
      (event) => event.type,
    );
    expect(eventTypes).not.toContain("PROJECT_SOURCE_INGESTED");
    expect(eventTypes).not.toContain("PROJECT_SOURCE_ATTACHED");
  });
});
