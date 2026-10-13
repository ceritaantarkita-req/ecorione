import {
  GoogleDriveOAuthConfigSchema,
  type GoogleDriveOAuthConfig,
} from "./google-drive-oauth.js";

/**
 * The example .env includes an illustrative localhost redirect URI even before
 * the operator supplies Google credentials. A redirect alone is an inert hint,
 * not a partially enabled Google Drive integration.
 *
 * Once a client ID or secret is present, require the complete OAuth pair and
 * continue to validate the redirect through the canonical schema.
 */
export function googleDriveOAuthConfigFromEnv(
  env: Record<string, string | undefined>,
): GoogleDriveOAuthConfig | undefined {
  const clientId = env.ECORIONE_GOOGLE_DRIVE_CLIENT_ID || undefined;
  const clientSecret = env.ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET || undefined;
  const redirectUri = env.ECORIONE_GOOGLE_DRIVE_REDIRECT_URI || undefined;

  if (clientId === undefined && clientSecret === undefined) return undefined;

  if (clientId === undefined || redirectUri === undefined) {
    throw new Error(
      "Google Drive OAuth config butuh ECORIONE_GOOGLE_DRIVE_CLIENT_ID dan ECORIONE_GOOGLE_DRIVE_REDIRECT_URI.",
    );
  }

  return GoogleDriveOAuthConfigSchema.parse({
    clientId,
    ...(clientSecret === undefined ? {} : { clientSecret }),
    redirectUri,
  });
}
