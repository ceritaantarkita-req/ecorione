import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "@ecorione/shared-server";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { FileCredentialVault } from "../services/connect/src/credential-vault.js";
import { registerGoogleDriveOAuthRoutes } from "../services/connect/src/google-drive-http.js";
import { GoogleDriveOAuthStateStore } from "../services/connect/src/google-drive-oauth.js";
import {
  GoogleDriveSource,
  type GoogleDriveApiTransport,
} from "../services/connect/src/google-drive-source.js";
import type { GoogleDriveOAuthTransport } from "../services/connect/src/google-drive-token.js";
import { openHubDatabase, type HubDatabase } from "../services/hub/src/db.js";
import { buildHubServer } from "../services/hub/src/http.js";

const INTERNAL_TOKEN = "synthetic-internal-token";
const REFRESH_TOKEN = "synthetic-refresh-token-for-mock-acceptance";
const ACCESS_TOKEN = "synthetic-access-token-for-mock-acceptance";
const PICKER_ACCESS_TOKEN = "synthetic-picker-token-for-mock-acceptance";
const auth = { authorization: `Bearer ${INTERNAL_TOKEN}` };
const oauthConfig = {
  clientId: "synthetic-client-id.apps.example.test",
  clientSecret: "synthetic-client-secret",
  redirectUri: "https://ecorione.example/api/integrations/google-drive/callback",
};
const pickerConfig = {
  developerKey: "synthetic_picker_key_123456",
  appId: "123456789012",
};

const dirs: string[] = [];
let originalDispatcher: ReturnType<typeof getGlobalDispatcher> | undefined;

function cleanupDirs(): void {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

afterEach(() => {
  if (originalDispatcher !== undefined) {
    setGlobalDispatcher(originalDispatcher);
    originalDispatcher = undefined;
  }
  cleanupDirs();
});

function oauthFixture(transport: GoogleDriveOAuthTransport) {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-drive-mock-acceptance-"));
  dirs.push(dir);
  const vaultPath = join(dir, "credentials.vault.json");
  const vault = new FileCredentialVault(vaultPath, Buffer.alloc(32, 31));
  let tick = 1;
  const stateStore = new GoogleDriveOAuthStateStore({
    now: () => Date.parse("2026-10-03T06:00:00.000Z"),
    randomBytes: (size) => Buffer.alloc(size, tick++),
  });
  const app = createServer({
    name: "session12d-google-drive-mock-acceptance",
    token: INTERNAL_TOKEN,
  });
  registerGoogleDriveOAuthRoutes(app, {
    credentialVault: vault,
    oauthConfig,
    pickerConfig,
    oauthStateStore: stateStore,
    oauthTransport: transport,
    now: () => "2026-10-03T06:10:00.000Z",
  });
  return { app, vault, vaultPath };
}

describe("Session 12D Google Drive mock acceptance", () => {
  it("runs disconnected -> OAuth -> Picker -> disconnect without credential leakage", async () => {
    const transport: GoogleDriveOAuthTransport = async (url, form) => {
      if (url.endsWith("/revoke")) {
        expect(form.get("token")).toBe(REFRESH_TOKEN);
        return { statusCode: 200, bodyText: "" };
      }

      const grantType = form.get("grant_type");
      if (grantType === "authorization_code") {
        expect(form.get("code")).toBe("synthetic-authorization-code");
        expect(form.get("code_verifier")?.length).toBeGreaterThanOrEqual(43);
        return {
          statusCode: 200,
          bodyText: JSON.stringify({
            access_token: ACCESS_TOKEN,
            refresh_token: REFRESH_TOKEN,
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/drive.file",
          }),
        };
      }
      if (grantType === "refresh_token") {
        expect(form.get("refresh_token")).toBe(REFRESH_TOKEN);
        return {
          statusCode: 200,
          bodyText: JSON.stringify({
            access_token: PICKER_ACCESS_TOKEN,
            expires_in: 1800,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/drive.file",
          }),
        };
      }
      return {
        statusCode: 400,
        bodyText: JSON.stringify({ error: "unsupported_grant_type" }),
      };
    };

    const { app, vault, vaultPath } = oauthFixture(transport);

    const disconnected = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
      headers: auth,
    });
    expect(disconnected.statusCode).toBe(200);
    expect(disconnected.json()).toMatchObject({
      available: true,
      connected: false,
      pickerAvailable: true,
    });

    const started = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/start",
      headers: { ...auth, "content-type": "application/json" },
      payload: {
        workspaceId: "ws_personal",
        returnPath: "/projects/prj_personal",
      },
    });
    expect(started.statusCode).toBe(200);
    const authorizationUrl = new URL(
      (started.json() as { authorizationUrl: string }).authorizationUrl,
    );
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(authorizationUrl.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/drive.file",
    );
    const state = authorizationUrl.searchParams.get("state");
    expect(state).not.toBeNull();

    const callback = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/callback",
      headers: { ...auth, "content-type": "application/json" },
      payload: {
        code: "synthetic-authorization-code",
        state,
      },
    });
    expect(callback.statusCode).toBe(200);
    expect(callback.json()).toEqual({
      workspaceId: "ws_personal",
      connected: true,
      returnPath: "/projects/prj_personal",
    });
    expect(callback.body).not.toContain(ACCESS_TOKEN);
    expect(callback.body).not.toContain(REFRESH_TOKEN);
    expect(vault.get("google-drive", "tokens")).toBe(REFRESH_TOKEN);
    expect(readFileSync(vaultPath, "utf8")).not.toContain(REFRESH_TOKEN);

    const connected = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
      headers: auth,
    });
    expect(connected.statusCode).toBe(200);
    expect(connected.json()).toMatchObject({
      available: true,
      connected: true,
      pickerAvailable: true,
    });
    expect(connected.body).not.toContain(REFRESH_TOKEN);

    const picker = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/picker-session",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal" },
    });
    expect(picker.statusCode).toBe(200);
    expect(picker.json()).toMatchObject({
      workspaceId: "ws_personal",
      accessToken: PICKER_ACCESS_TOKEN,
      scope: "https://www.googleapis.com/auth/drive.file",
      developerKey: pickerConfig.developerKey,
      appId: pickerConfig.appId,
    });
    expect(picker.body).not.toContain(REFRESH_TOKEN);

    const removed = await app.inject({
      method: "DELETE",
      url: "/v1/integrations/google-drive?workspaceId=ws_personal",
      headers: auth,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ disconnected: true });
    expect(vault.get("google-drive", "tokens")).toBeUndefined();

    const finalStatus = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
      headers: auth,
    });
    expect(finalStatus.json()).toMatchObject({ connected: false });

    await app.close();
  });

  it("surfaces reconnect-required when Google rejects the stored refresh token", async () => {
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 400,
      bodyText: JSON.stringify({
        error: "invalid_grant",
        error_description: "synthetic-private-upstream-detail",
      }),
    });
    const { app, vault } = oauthFixture(transport);
    vault.set("google-drive", "tokens", REFRESH_TOKEN, "2026-10-03T06:00:00.000Z");

    const picker = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/picker-session",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal" },
    });

    expect(picker.statusCode).toBe(409);
    expect(picker.json().error.type).toBe("GOOGLE_DRIVE_RECONNECT_REQUIRED");
    expect(picker.body).not.toContain("synthetic-private-upstream-detail");
    expect(picker.body).not.toContain(REFRESH_TOKEN);
    await app.close();
  });

  it("fetches an explicit blob and exports a Google-native document without leaking tokens", async () => {
    const calls: Array<{ url: string; accessToken: string }> = [];
    const transport: GoogleDriveApiTransport = async (url, accessToken) => {
      calls.push({ url: url.toString(), accessToken });
      const fileId = url.pathname.split("/").at(-1) ?? "";
      const isExport = url.pathname.endsWith("/export");

      if (fileId === "blob-file-1" && !isExport && url.searchParams.has("fields")) {
        return {
          statusCode: 200,
          body: Buffer.from(
            JSON.stringify({
              id: "blob-file-1",
              name: "notes.txt",
              mimeType: "text/plain",
              size: "11",
              modifiedTime: "2026-10-03T06:00:00.000Z",
              capabilities: { canDownload: true },
            }),
          ),
        };
      }
      if (
        fileId === "blob-file-1" &&
        !isExport &&
        url.searchParams.get("alt") === "media"
      ) {
        return { statusCode: 200, body: Buffer.from("hello blob!") };
      }
      if (
        url.pathname.endsWith("/drive/v3/files/native-doc-1") &&
        url.searchParams.has("fields")
      ) {
        return {
          statusCode: 200,
          body: Buffer.from(
            JSON.stringify({
              id: "native-doc-1",
              name: "Native plan",
              mimeType: "application/vnd.google-apps.document",
              modifiedTime: "2026-10-03T06:05:00.000Z",
              capabilities: { canDownload: true },
            }),
          ),
        };
      }
      if (url.pathname.endsWith("/drive/v3/files/native-doc-1/export")) {
        expect(url.searchParams.get("mimeType")).toBe("text/markdown");
        return { statusCode: 200, body: Buffer.from("# Native plan\n") };
      }
      return { statusCode: 404, body: Buffer.from("{}") };
    };

    const source = new GoogleDriveSource({
      vault: { get: () => REFRESH_TOKEN },
      oauthClient: {
        async refreshAccessToken(refreshToken) {
          expect(refreshToken).toBe(REFRESH_TOKEN);
          return {
            accessToken: ACCESS_TOKEN,
            expiresInSeconds: 3600,
            scope: "https://www.googleapis.com/auth/drive.file",
          };
        },
      },
      transport,
    });

    const blob = await source.fetchSelectedFile("ws_personal", "blob-file-1");
    expect(blob).toMatchObject({
      fileId: "blob-file-1",
      sourceMimeType: "text/plain",
      snapshotMimeType: "text/plain",
      sizeBytes: 11,
    });
    expect(Buffer.from(blob.contentBase64, "base64").toString("utf8")).toBe("hello blob!");

    const native = await source.fetchSelectedFile("ws_personal", "native-doc-1");
    expect(native).toMatchObject({
      fileId: "native-doc-1",
      sourceMimeType: "application/vnd.google-apps.document",
      snapshotMimeType: "text/markdown",
    });
    expect(Buffer.from(native.contentBase64, "base64").toString("utf8")).toBe(
      "# Native plan\n",
    );

    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.accessToken === ACCESS_TOKEN)).toBe(true);
    expect(calls.every((call) => !call.url.includes(ACCESS_TOKEN))).toBe(true);
    expect(calls.every((call) => !call.url.includes(REFRESH_TOKEN))).toBe(true);
  });

  it("refreshes the same Drive origin to a new Artifact and resets indexed lifecycle state", async () => {
    originalDispatcher = getGlobalDispatcher();
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);

    const connect: Interceptable = agent.get("http://connect.local");
    const artifact: Interceptable = agent.get("http://artifact.local");
    const context: Interceptable = agent.get("http://context.local");

    const db: HubDatabase = openHubDatabase();
    const app = buildHubServer(db, {
      contextUrl: "http://context.local",
      connectUrl: "http://connect.local",
      rndUrl: "http://rnd.local",
      spaceUrl: "http://space.local",
      flowUrl: "http://flow.local",
      artifactUrl: "http://artifact.local",
      internalToken: INTERNAL_TOKEN,
    });

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

    await app.close();
    db.close();
    await agent.close();
    setGlobalDispatcher(originalDispatcher);
    originalDispatcher = undefined;
  });
});
