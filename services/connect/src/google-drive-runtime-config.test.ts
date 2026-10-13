import { describe, expect, it } from "vitest";
import { googleDriveOAuthConfigFromEnv } from "./google-drive-runtime-config.js";

const redirectUri = "http://localhost:3000/api/integrations/google-drive/callback";
const clientId = "123456789012-example.apps.googleusercontent.com";

describe("Google Drive runtime OAuth config", () => {
  it("keeps Google Drive disabled with an empty example env", () => {
    expect(googleDriveOAuthConfigFromEnv({})).toBeUndefined();
    expect(
      googleDriveOAuthConfigFromEnv({
        ECORIONE_GOOGLE_DRIVE_CLIENT_ID: "",
        ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET: "",
        ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: redirectUri,
      }),
    ).toBeUndefined();
  });

  it("fails closed when Google credentials are partially configured", () => {
    expect(() =>
      googleDriveOAuthConfigFromEnv({ ECORIONE_GOOGLE_DRIVE_CLIENT_ID: clientId }),
    ).toThrow(/ECORIONE_GOOGLE_DRIVE_REDIRECT_URI/);
    expect(() =>
      googleDriveOAuthConfigFromEnv({ ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET: "secret-value" }),
    ).toThrow(/ECORIONE_GOOGLE_DRIVE_CLIENT_ID/);
    expect(() =>
      googleDriveOAuthConfigFromEnv({
        ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET: "secret-value",
        ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: redirectUri,
      }),
    ).toThrow(/ECORIONE_GOOGLE_DRIVE_CLIENT_ID/);
  });

  it("keeps canonical validation and enabled config for real credentials", () => {
    expect(
      googleDriveOAuthConfigFromEnv({
        ECORIONE_GOOGLE_DRIVE_CLIENT_ID: clientId,
        ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: redirectUri,
      }),
    ).toEqual({ clientId, redirectUri });
    expect(
      googleDriveOAuthConfigFromEnv({
        ECORIONE_GOOGLE_DRIVE_CLIENT_ID: clientId,
        ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET: "secret-value",
        ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: redirectUri,
      }),
    ).toEqual({ clientId, clientSecret: "secret-value", redirectUri });
    expect(() =>
      googleDriveOAuthConfigFromEnv({
        ECORIONE_GOOGLE_DRIVE_CLIENT_ID: clientId,
        ECORIONE_GOOGLE_DRIVE_REDIRECT_URI: "http://example.com/callback",
      }),
    ).toThrow();
  });
});
