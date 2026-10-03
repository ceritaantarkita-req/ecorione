import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "@ecorione/shared-server";
import { FileCredentialVault } from "./credential-vault.js";
import { registerGoogleDriveOAuthRoutes } from "./google-drive-http.js";
import { GoogleDriveOAuthStateStore } from "./google-drive-oauth.js";
import { GoogleDriveSource, type GoogleDriveApiTransport } from "./google-drive-source.js";
import {
  GoogleDriveOAuthUpstreamError,
  type GoogleDriveOAuthTransport,
} from "./google-drive-token.js";

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

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
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

describe("Session 12D Google Drive mock acceptance — Connect", () => {
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
    expect(vault.get("google-drive", "tokens")).toBeUndefined();

    const status = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
      headers: auth,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ connected: false, updatedAt: null });
    await app.close();
  });

  it("clears stale source authorization but preserves transient refresh failures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-drive-source-reconnect-"));
    dirs.push(dir);
    const vault = new FileCredentialVault(
      join(dir, "credentials.vault.json"),
      Buffer.alloc(32, 23),
    );
    vault.set("google-drive", "tokens", REFRESH_TOKEN, "2026-10-03T06:00:00.000Z");

    const rejected = new GoogleDriveSource({
      vault,
      oauthClient: {
        async refreshAccessToken() {
          throw new GoogleDriveOAuthUpstreamError(
            502,
            "GOOGLE_DRIVE_OAUTH_REJECTED",
            "synthetic rejected refresh",
          );
        },
      },
      onAuthorizationRejected: () => {
        vault.remove("google-drive", "tokens");
      },
      transport: async () => {
        throw new Error("must not run");
      },
    });

    await expect(
      rejected.fetchSelectedFile("ws_personal", "file-123"),
    ).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_NOT_CONNECTED",
      statusCode: 409,
    });
    expect(vault.get("google-drive", "tokens")).toBeUndefined();

    vault.set("google-drive", "tokens", REFRESH_TOKEN, "2026-10-03T06:05:00.000Z");
    const transient = new GoogleDriveSource({
      vault,
      oauthClient: {
        async refreshAccessToken() {
          throw new GoogleDriveOAuthUpstreamError(
            504,
            "GOOGLE_DRIVE_OAUTH_TIMEOUT",
            "synthetic timeout",
          );
        },
      },
      onAuthorizationRejected: () => {
        vault.remove("google-drive", "tokens");
      },
      transport: async () => {
        throw new Error("must not run");
      },
    });

    await expect(
      transient.fetchSelectedFile("ws_personal", "file-123"),
    ).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_API_TIMEOUT",
      statusCode: 504,
    });
    expect(vault.get("google-drive", "tokens")).toBe(REFRESH_TOKEN);
  });

  it("fetches a blob and exports a Google-native document without leaking tokens", async () => {
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
      if (fileId === "blob-file-1" && !isExport && url.searchParams.get("alt") === "media") {
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
});
