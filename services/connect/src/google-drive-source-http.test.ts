import { describe, expect, it } from "vitest";
import { createServer } from "@ecorione/shared-server";
import { GoogleDriveSource } from "./google-drive-source.js";
import { registerGoogleDriveSourceFetchRoutes } from "./source-fetch-http.js";

const auth = { authorization: "Bearer internal-secret" };

function source(): GoogleDriveSource {
  let call = 0;
  return new GoogleDriveSource({
    vault: {
      get() {
        return "refresh-token-private-123456";
      },
    },
    oauthClient: {
      async refreshAccessToken() {
        return {
          accessToken: "access-token-ephemeral",
          expiresInSeconds: 3600,
          scope: "https://www.googleapis.com/auth/drive.file",
        };
      },
    },
    transport: async () => {
      call += 1;
      if (call === 1) {
        return {
          statusCode: 200,
          body: Buffer.from(
            JSON.stringify({
              id: "file-123",
              name: "Plan.md",
              mimeType: "text/markdown",
              size: "5",
              capabilities: { canDownload: true },
            }),
          ),
        };
      }
      return { statusCode: 200, body: Buffer.from("hello") };
    },
  });
}

describe("Google Drive source-fetch HTTP boundary", () => {
  it("requires the internal Connect bearer token", async () => {
    const app = createServer({ name: "drive-source-http-test", token: "internal-secret" });
    registerGoogleDriveSourceFetchRoutes(app, source());
    const response = await app.inject({
      method: "POST",
      url: "/v1/source-fetch/google-drive",
      payload: { workspaceId: "ws_personal", fileId: "file-123" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns explicit not-configured instead of silently falling back", async () => {
    const app = createServer({ name: "drive-source-http-test", token: "internal-secret" });
    registerGoogleDriveSourceFetchRoutes(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/source-fetch/google-drive",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal", fileId: "file-123" },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.type).toBe("GOOGLE_DRIVE_NOT_CONFIGURED");
  });

  it("returns only bounded snapshot metadata and bytes, never credentials", async () => {
    const app = createServer({ name: "drive-source-http-test", token: "internal-secret" });
    registerGoogleDriveSourceFetchRoutes(app, source());
    const response = await app.inject({
      method: "POST",
      url: "/v1/source-fetch/google-drive",
      headers: { ...auth, "content-type": "application/json" },
      payload: { workspaceId: "ws_personal", fileId: "file-123" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fileId: "file-123",
      name: "Plan.md",
      sourceMimeType: "text/markdown",
      snapshotMimeType: "text/markdown",
      sizeBytes: 5,
    });
    expect(response.body).not.toContain("access-token-ephemeral");
    expect(response.body).not.toContain("refresh-token-private-123456");
  });
});
