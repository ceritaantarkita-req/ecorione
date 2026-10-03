import { describe, expect, it } from "vitest";
import { GOOGLE_DRIVE_FILE_SCOPE } from "@ecorione/shared-schema";
import { GOOGLE_DRIVE_TOKEN_ENDPOINT } from "./google-drive-oauth.js";
import {
  GOOGLE_DRIVE_REVOKE_ENDPOINT,
  GoogleDriveOAuthClient,
  GoogleDriveOAuthUpstreamError,
  type GoogleDriveOAuthTransport,
} from "./google-drive-token.js";

const config = {
  clientId: "123456789012-example.apps.googleusercontent.com",
  clientSecret: "client-secret-value",
  redirectUri: "https://ecorione.example/api/integrations/google-drive/callback",
};

describe("GoogleDriveOAuthClient", () => {
  it("exchanges authorization code with PKCE and never places secret in URL", async () => {
    const calls: Array<{ url: string; form: URLSearchParams; timeoutMs: number }> = [];
    const transport: GoogleDriveOAuthTransport = async (url, form, timeoutMs) => {
      calls.push({ url, form, timeoutMs });
      return {
        statusCode: 200,
        bodyText: JSON.stringify({
          access_token: "access-token-private",
          refresh_token: "refresh-token-private-123456",
          expires_in: 3600,
          token_type: "Bearer",
          scope: GOOGLE_DRIVE_FILE_SCOPE,
        }),
      };
    };
    const client = new GoogleDriveOAuthClient(config, { transport, timeoutMs: 5000 });

    const result = await client.exchangeAuthorizationCode("auth-code", "v".repeat(64));

    expect(result).toEqual({
      accessToken: "access-token-private",
      refreshToken: "refresh-token-private-123456",
      expiresInSeconds: 3600,
      scope: GOOGLE_DRIVE_FILE_SCOPE,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(GOOGLE_DRIVE_TOKEN_ENDPOINT);
    expect(calls[0]?.timeoutMs).toBe(5000);
    expect(calls[0]?.form.get("grant_type")).toBe("authorization_code");
    expect(calls[0]?.form.get("code_verifier")).toBe("v".repeat(64));
    expect(calls[0]?.form.get("client_secret")).toBe("client-secret-value");
    expect(String(calls[0]?.url)).not.toContain("client-secret-value");
  });

  it("refreshes access tokens without requiring a replacement refresh token", async () => {
    const transport: GoogleDriveOAuthTransport = async (_url, form) => {
      expect(form.get("grant_type")).toBe("refresh_token");
      expect(form.get("refresh_token")).toBe("refresh-token-private-123456");
      return {
        statusCode: 200,
        bodyText: JSON.stringify({
          access_token: "next-access-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: GOOGLE_DRIVE_FILE_SCOPE,
        }),
      };
    };
    const client = new GoogleDriveOAuthClient(config, { transport });
    await expect(client.refreshAccessToken("refresh-token-private-123456")).resolves.toEqual({
      accessToken: "next-access-token",
      expiresInSeconds: 3600,
      scope: GOOGLE_DRIVE_FILE_SCOPE,
    });
  });

  it("fails closed when Google returns a scope outside drive.file", async () => {
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        access_token: "access-token-private",
        refresh_token: "refresh-token-private-123456",
        expires_in: 3600,
        token_type: "Bearer",
        scope: `${GOOGLE_DRIVE_FILE_SCOPE} openid`,
      }),
    });
    const client = new GoogleDriveOAuthClient(config, { transport });
    await expect(
      client.exchangeAuthorizationCode("auth-code", "v".repeat(64)),
    ).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
      statusCode: 502,
    });
  });

  it("fails closed when Google omits the required Drive scope", async () => {
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        access_token: "access-token-private",
        refresh_token: "refresh-token-private-123456",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid profile",
      }),
    });
    const client = new GoogleDriveOAuthClient(config, { transport });
    await expect(
      client.exchangeAuthorizationCode("auth-code", "v".repeat(64)),
    ).rejects.toMatchObject({
      code: "GOOGLE_DRIVE_OAUTH_INVALID_RESPONSE",
      statusCode: 502,
    });
  });

  it("maps upstream rejection without echoing token response details", async () => {
    const secretDescription = "private-upstream-detail";
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 400,
      bodyText: JSON.stringify({
        error: "invalid_grant",
        error_description: secretDescription,
      }),
    });
    const client = new GoogleDriveOAuthClient(config, { transport });

    let thrown: unknown;
    try {
      await client.exchangeAuthorizationCode("auth-code", "v".repeat(64));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GoogleDriveOAuthUpstreamError);
    expect(String((thrown as Error).message)).not.toContain(secretDescription);
  });

  it("revokes the refresh token through the fixed revoke endpoint", async () => {
    const calls: Array<{ url: string; token: string | null }> = [];
    const transport: GoogleDriveOAuthTransport = async (url, form) => {
      calls.push({ url, token: form.get("token") });
      return { statusCode: 200, bodyText: "" };
    };
    const client = new GoogleDriveOAuthClient(config, { transport });
    await client.revoke("refresh-token-private-123456");
    expect(calls).toEqual([
      { url: GOOGLE_DRIVE_REVOKE_ENDPOINT, token: "refresh-token-private-123456" },
    ]);
  });

  it("treats an already-invalid Google token as successfully disconnected", async () => {
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 400,
      bodyText: JSON.stringify({
        error: "invalid_token",
        error_description: "synthetic already revoked token",
      }),
    });
    const client = new GoogleDriveOAuthClient(config, { transport });

    await expect(client.revoke("refresh-token-private-123456")).resolves.toBeUndefined();
  });

  it("still fails closed for non-idempotent revoke errors", async () => {
    const privateDescription = "synthetic malformed revoke request detail";
    const transport: GoogleDriveOAuthTransport = async () => ({
      statusCode: 400,
      bodyText: JSON.stringify({
        error: "invalid_request",
        error_description: privateDescription,
      }),
    });
    const client = new GoogleDriveOAuthClient(config, { transport });

    let thrown: unknown;
    try {
      await client.revoke("refresh-token-private-123456");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GoogleDriveOAuthUpstreamError);
    expect(String((thrown as Error).message)).not.toContain(privateDescription);
  });

  it("rejects invalid timeout configuration deterministically", () => {
    expect(() => new GoogleDriveOAuthClient(config, { timeoutMs: 100 })).toThrow(
      GoogleDriveOAuthUpstreamError,
    );
  });
});
