import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "@ecorione/shared-server";
import { FileCredentialVault } from "./credential-vault.js";
import { registerGoogleDriveOAuthRoutes } from "./google-drive-http.js";
import { GoogleDriveOAuthStateStore } from "./google-drive-oauth.js";
import { type GoogleDriveOAuthTransport } from "./google-drive-token.js";

const dirs: string[] = [];
const auth = { authorization: "Bearer internal-secret" };
const config = {
  clientId: "123456789012-example.apps.googleusercontent.com",
  clientSecret: "client-secret-value",
  redirectUri: "https://ecorione.example/api/integrations/google-drive/callback",
};
const pickerConfig = {
  developerKey: "AIzaPickerKey_1234567890",
  appId: "123456789012",
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture(
  transport?: GoogleDriveOAuthTransport,
  configured = true,
  pickerConfigured = configured,
) {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-drive-http-"));
  dirs.push(dir);
  const vaultPath = join(dir, "credentials.vault.json");
  const vault = new FileCredentialVault(vaultPath, Buffer.alloc(32, 22));
  let tick = 1;
  const stateStore = new GoogleDriveOAuthStateStore({
    now: () => Date.parse("2026-10-03T00:00:00.000Z"),
    randomBytes: (size) => Buffer.alloc(size, tick++),
  });
  const app = createServer({ name: "connect-drive-test", token: "internal-secret" });
  registerGoogleDriveOAuthRoutes(app, {
    credentialVault: vault,
    ...(configured ? { oauthConfig: config } : {}),
    ...(pickerConfigured ? { pickerConfig } : {}),
    oauthStateStore: stateStore,
    ...(transport === undefined ? {} : { oauthTransport: transport }),
    now: () => "2026-10-03T00:10:00.000Z",
  });
  return { app, vault, vaultPath };
}

async function start(app: ReturnType<typeof createServer>, workspaceId = "ws_personal") {
  const response = await app.inject({
    method: "POST",
    url: "/v1/integrations/google-drive/oauth/start",
    headers: { ...auth, "content-type": "application/json" },
    payload: {
      workspaceId,
      returnPath: "/projects/prj_personal",
    },
  });
  const body = response.json() as { authorizationUrl?: string };
  const state =
    body.authorizationUrl === undefined
      ? null
      : new URL(body.authorizationUrl).searchParams.get("state");
  return { response, state };
}

describe("Google Drive OAuth HTTP boundary", () => {
  it("requires the internal Connect bearer boundary", async () => {
    const { app } = fixture();
    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
    });
    expect(response.statusCode).toBe(401);
  });

  it("reports configured/disconnected status without credential material", async () => {
    const { app } = fixture();
    const response = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("token");
    expect(response.json()).toEqual({
      provider: "google-drive",
      workspaceId: "ws_personal",
      available: true,
      connected: false,
      pickerAvailable: true,
      scope: "https://www.googleapis.com/auth/drive.file",
      updatedAt: null,
    });
  });

  it("fails closed outside Personal Workspace", async () => {
    const { app } = fixture();
    const { response } = await start(app, "ws_other");
    expect(response.statusCode).toBe(409);
    expect(response.json().error.type).toBe("GOOGLE_DRIVE_PERSONAL_WORKSPACE_ONLY");
  });

  it("exchanges one-time state and stores only the refresh token encrypted", async () => {
    const transport: GoogleDriveOAuthTransport = async (_url, form) => {
      expect(form.get("grant_type")).toBe("authorization_code");
      expect(form.get("code")).toBe("authorization-code");
      expect(form.get("code_verifier")?.length).toBeGreaterThanOrEqual(43);
      return {
        statusCode: 200,
        bodyText: JSON.stringify({
          access_token: "access-token-private",
          refresh_token: "refresh-token-private-123456",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/drive.file",
        }),
      };
    };
    const { app, vault, vaultPath } = fixture(transport);
    const started = await start(app);
    expect(started.response.statusCode).toBe(200);
    if (started.state === null) throw new Error("fixture state missing");

    const callback = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/callback",
      headers: { ...auth, "content-type": "application/json" },
      payload: { code: "authorization-code", state: started.state },
    });
    expect(callback.statusCode).toBe(200);
    expect(callback.json()).toEqual({
      workspaceId: "ws_personal",
      connected: true,
      returnPath: "/projects/prj_personal",
    });
    expect(callback.body).not.toContain("access-token-private");
    expect(callback.body).not.toContain("refresh-token-private-123456");
    expect(vault.get("google-drive", "tokens")).toBe("refresh-token-private-123456");
    expect(readFileSync(vaultPath, "utf8")).not.toContain("refresh-token-private-123456");

    const replay = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/callback",
      headers: { ...auth, "content-type": "application/json" },
      payload: { code: "authorization-code", state: started.state },
    });
    expect(replay.statusCode).toBe(400);
    expect(replay.json().error.type).toBe("GOOGLE_DRIVE_OAUTH_STATE_INVALID");
  });

  it("consumes denied callback state and never performs token exchange", async () => {
    let calls = 0;
    const transport: GoogleDriveOAuthTransport = async () => {
      calls += 1;
      throw new Error("must not run");
    };
    const { app } = fixture(transport);
    const started = await start(app);
    if (started.state === null) throw new Error("fixture state missing");

    const denied = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/callback",
      headers: { ...auth, "content-type": "application/json" },
      payload: {
        error: "access_denied",
        errorDescription: "user cancelled",
        state: started.state,
      },
    });
    expect(denied.statusCode).toBe(200);
    expect(denied.json()).toEqual({
      workspaceId: "ws_personal",
      connected: false,
      returnPath: "/projects/prj_personal",
    });
    expect(denied.body).not.toContain("user cancelled");
    expect(calls).toBe(0);
  });

  it("requires a refresh token on first connection but preserves an existing one", async () => {
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        access_token: "access-token-only",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/drive.file",
      }),
    });

    const first = fixture(transport);
    const firstStart = await start(first.app);
    if (firstStart.state === null) throw new Error("fixture state missing");
    const missing = await first.app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/callback",
      headers: { ...auth, "content-type": "application/json" },
      payload: { code: "authorization-code", state: firstStart.state },
    });
    expect(missing.statusCode).toBe(409);
    expect(missing.json().error.type).toBe("GOOGLE_DRIVE_REFRESH_TOKEN_MISSING");

    const existing = fixture(transport);
    existing.vault.set(
      "google-drive",
      "tokens",
      "existing-refresh-token-private",
      "2026-10-03T00:00:00.000Z",
    );
    const existingStart = await start(existing.app);
    if (existingStart.state === null) throw new Error("fixture state missing");
    const preserved = await existing.app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/oauth/callback",
      headers: { ...auth, "content-type": "application/json" },
      payload: { code: "authorization-code", state: existingStart.state },
    });
    expect(preserved.statusCode).toBe(200);
    expect(existing.vault.get("google-drive", "tokens")).toBe("existing-refresh-token-private");
  });

  it("mints a no-refresh-token Picker session from encrypted custody", async () => {
    const transport: GoogleDriveOAuthTransport = async (_url, form) => {
      expect(form.get("grant_type")).toBe("refresh_token");
      expect(form.get("refresh_token")).toBe("refresh-token-private-123456");
      return {
        statusCode: 200,
        bodyText: JSON.stringify({
          access_token: "picker-access-token-private",
          expires_in: 1800,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/drive.file",
        }),
      };
    };
    const { app, vault } = fixture(transport);
    vault.set(
      "google-drive",
      "tokens",
      "refresh-token-private-123456",
      "2026-10-03T00:00:00.000Z",
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/picker-session",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      workspaceId: "ws_personal",
      scope: "https://www.googleapis.com/auth/drive.file",
      accessToken: "picker-access-token-private",
      expiresAt: "2026-10-03T00:40:00.000Z",
      developerKey: pickerConfig.developerKey,
      appId: pickerConfig.appId,
    });
    expect(response.body).not.toContain("refresh-token-private-123456");
  });

  it("requires Picker operator config and maps rejected refresh to reconnect", async () => {
    const noPicker = fixture(undefined, true, false);
    noPicker.vault.set(
      "google-drive",
      "tokens",
      "refresh-token-private-123456",
      "2026-10-03T00:00:00.000Z",
    );
    const missing = await noPicker.app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/picker-session",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal" },
    });
    expect(missing.statusCode).toBe(503);
    expect(missing.json().error.type).toBe("GOOGLE_DRIVE_PICKER_NOT_CONFIGURED");

    const rejected = fixture(async () => ({
      statusCode: 400,
      bodyText: JSON.stringify({
        error: "invalid_grant",
        error_description: "private-upstream-detail",
      }),
    }));
    rejected.vault.set(
      "google-drive",
      "tokens",
      "refresh-token-private-123456",
      "2026-10-03T00:00:00.000Z",
    );
    const reconnect = await rejected.app.inject({
      method: "POST",
      url: "/v1/integrations/google-drive/picker-session",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal" },
    });
    expect(reconnect.statusCode).toBe(409);
    expect(reconnect.json().error.type).toBe("GOOGLE_DRIVE_RECONNECT_REQUIRED");
    expect(reconnect.body).not.toContain("private-upstream-detail");
  });

  it("revokes remotely before deleting local credential", async () => {
    let revokeAllowed = false;
    const transport: GoogleDriveOAuthTransport = async (url) => ({
      statusCode: url.endsWith("/revoke") && revokeAllowed ? 200 : 503,
      bodyText: "",
    });
    const { app, vault } = fixture(transport);
    vault.set(
      "google-drive",
      "tokens",
      "refresh-token-private-123456",
      "2026-10-03T00:00:00.000Z",
    );

    const failed = await app.inject({
      method: "DELETE",
      url: "/v1/integrations/google-drive?workspaceId=ws_personal",
      headers: auth,
    });
    expect(failed.statusCode).toBe(502);
    expect(vault.get("google-drive", "tokens")).toBe("refresh-token-private-123456");

    revokeAllowed = true;
    const removed = await app.inject({
      method: "DELETE",
      url: "/v1/integrations/google-drive?workspaceId=ws_personal",
      headers: auth,
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ disconnected: true });
    expect(vault.get("google-drive", "tokens")).toBeUndefined();
  });

  it("stays dormant when operator OAuth config is absent", async () => {
    const { app } = fixture(undefined, false);
    const status = await app.inject({
      method: "GET",
      url: "/v1/integrations/google-drive/status?workspaceId=ws_personal",
      headers: auth,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ available: false, connected: false });

    const started = await start(app);
    expect(started.response.statusCode).toBe(503);
    expect(started.response.json().error.type).toBe("GOOGLE_DRIVE_NOT_CONFIGURED");
  });
});
