import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID, GOOGLE_DRIVE_FILE_SCOPE } from "@ecorione/shared-schema";
import { FileCredentialVault } from "./credential-vault.js";
import {
  GoogleDriveOAuthStateError,
  GoogleDriveOAuthStateStore,
  disconnectGoogleDrive,
  googleDriveConnectionStatus,
  storeGoogleDriveRefreshToken,
} from "./google-drive-oauth.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixtureVault(): { vault: FileCredentialVault; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-drive-oauth-"));
  dirs.push(dir);
  const path = join(dir, "credentials.vault.json");
  return {
    vault: new FileCredentialVault(path, Buffer.alloc(32, 21)),
    path,
  };
}

describe("Google Drive OAuth foundation", () => {
  it("membuat request drive.file + offline + PKCE dan state one-time", () => {
    let tick = 1;
    const store = new GoogleDriveOAuthStateStore({
      now: () => Date.parse("2026-10-03T00:00:00.000Z"),
      randomBytes: (size) => Buffer.alloc(size, tick++),
    });

    const started = store.begin(
      {
        clientId: "123456789012-example.apps.googleusercontent.com",
        redirectUri: "https://ecorione.example/api/integrations/google-drive/callback",
      },
      {
        workspaceId: DEFAULT_WORKSPACE_ID,
        returnPath: "/projects/prj_personal",
      },
    );

    const url = new URL(started.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_DRIVE_FILE_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/u);

    const state = url.searchParams.get("state");
    if (state === null) throw new Error("fixture state missing");
    const consumed = store.consume(state);
    expect(consumed).toMatchObject({
      workspaceId: DEFAULT_WORKSPACE_ID,
      returnPath: "/projects/prj_personal",
    });
    expect(consumed.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(() => store.consume(state)).toThrow(GoogleDriveOAuthStateError);
  });

  it("menolak state expired dan redirect non-HTTPS non-localhost", () => {
    let nowMs = Date.parse("2026-10-03T00:00:00.000Z");
    let tick = 1;
    const store = new GoogleDriveOAuthStateStore({
      ttlMs: 60_000,
      now: () => nowMs,
      randomBytes: (size) => Buffer.alloc(size, tick++),
    });

    expect(() =>
      store.begin(
        {
          clientId: "123456789012-example.apps.googleusercontent.com",
          redirectUri: "http://example.com/oauth/callback",
        },
        { workspaceId: DEFAULT_WORKSPACE_ID, returnPath: "/projects" },
      ),
    ).toThrow();

    const started = store.begin(
      {
        clientId: "123456789012-example.apps.googleusercontent.com",
        redirectUri: "http://localhost:3000/api/integrations/google-drive/callback",
      },
      { workspaceId: DEFAULT_WORKSPACE_ID, returnPath: "/projects" },
    );
    const state = new URL(started.authorizationUrl).searchParams.get("state");
    if (state === null) throw new Error("fixture state missing");
    nowMs += 60_001;
    expect(() => store.consume(state)).toThrow("kedaluwarsa");
    expect(() => store.consume(state)).toThrow("tidak ditemukan atau sudah dipakai");
  });

  it("menyimpan hanya refresh token secara terenkripsi dan mengekspos metadata status", () => {
    const { vault, path } = fixtureVault();
    const token = "refresh-token-private-value-123456789";
    const updatedAt = "2026-10-03T00:10:00.000Z";

    expect(googleDriveConnectionStatus(vault)).toEqual({
      provider: "google-drive",
      workspaceId: DEFAULT_WORKSPACE_ID,
      available: true,
      connected: false,
      scope: GOOGLE_DRIVE_FILE_SCOPE,
      updatedAt: null,
    });

    const metadata = storeGoogleDriveRefreshToken(vault, token, updatedAt);
    expect(metadata).toMatchObject({
      provider: "google-drive",
      purpose: "tokens",
      generation: 1,
      updatedAt,
    });
    expect(readFileSync(path, "utf8")).not.toContain(token);
    expect(vault.get("google-drive", "tokens")).toBe(token);
    expect(googleDriveConnectionStatus(vault)).toEqual({
      provider: "google-drive",
      workspaceId: DEFAULT_WORKSPACE_ID,
      available: true,
      connected: true,
      scope: GOOGLE_DRIVE_FILE_SCOPE,
      updatedAt,
    });

    expect(disconnectGoogleDrive(vault)).toBe(true);
    expect(vault.get("google-drive", "tokens")).toBeUndefined();
    expect(googleDriveConnectionStatus(vault).connected).toBe(false);
  });
});
