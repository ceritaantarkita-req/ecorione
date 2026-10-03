import {
  DEFAULT_WORKSPACE_ID,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_PROVIDER_ID,
  GoogleDriveConnectionStatusSchema,
  GoogleDriveOAuthCallbackRequestSchema,
  GoogleDriveOAuthCallbackResponseSchema,
  GoogleDriveOAuthStartRequestSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { HttpError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CredentialVaultError,
  type CredentialVaultAdmin,
} from "./credential-vault.js";
import {
  GoogleDriveOAuthStateError,
  GoogleDriveOAuthStateStore,
  disconnectGoogleDrive,
  googleDriveConnectionStatus,
  storeGoogleDriveRefreshToken,
  type GoogleDriveOAuthConfig,
} from "./google-drive-oauth.js";
import {
  GoogleDriveOAuthClient,
  GoogleDriveOAuthUpstreamError,
  type GoogleDriveOAuthTransport,
} from "./google-drive-token.js";
import { nowIso } from "./clock.js";

const StatusQuerySchema = z.object({ workspaceId: WorkspaceIdSchema }).strict();
const DisconnectResponseSchema = z.object({ disconnected: z.boolean() }).strict();

export interface GoogleDriveOAuthHttpOptions {
  readonly credentialVault?: CredentialVaultAdmin | undefined;
  readonly oauthConfig?: GoogleDriveOAuthConfig | undefined;
  readonly oauthStateStore?: GoogleDriveOAuthStateStore | undefined;
  readonly oauthTransport?: GoogleDriveOAuthTransport | undefined;
  readonly now?: (() => string) | undefined;
}

function requirePersonalWorkspace(workspaceId: string): void {
  if (workspaceId !== DEFAULT_WORKSPACE_ID) {
    throw new HttpError(
      409,
      "GOOGLE_DRIVE_PERSONAL_WORKSPACE_ONLY",
      "Native Google Drive V1 hanya tersedia untuk Personal Workspace.",
    );
  }
}

function mapGoogleDriveError(error: unknown): unknown {
  if (error instanceof GoogleDriveOAuthStateError) {
    return new HttpError(400, "GOOGLE_DRIVE_OAUTH_STATE_INVALID", error.message);
  }
  if (error instanceof GoogleDriveOAuthUpstreamError) {
    return new HttpError(error.statusCode, error.code, error.message);
  }
  if (error instanceof CredentialVaultError) {
    return new HttpError(
      503,
      "GOOGLE_DRIVE_CREDENTIAL_VAULT_UNAVAILABLE",
      "Google Drive credential vault tidak tersedia.",
    );
  }
  return error;
}

export function registerGoogleDriveOAuthRoutes(
  app: FastifyInstance,
  options: GoogleDriveOAuthHttpOptions,
): void {
  const stateStore = options.oauthStateStore ?? new GoogleDriveOAuthStateStore();
  const now = options.now ?? nowIso;

  const available = (): boolean =>
    options.oauthConfig !== undefined && options.credentialVault !== undefined;

  const runtime = (): {
    readonly vault: CredentialVaultAdmin;
    readonly client: GoogleDriveOAuthClient;
    readonly config: GoogleDriveOAuthConfig;
  } => {
    if (options.oauthConfig === undefined || options.credentialVault === undefined) {
      throw new HttpError(
        503,
        "GOOGLE_DRIVE_NOT_CONFIGURED",
        "Native Google Drive belum dikonfigurasi operator.",
      );
    }
    return {
      vault: options.credentialVault,
      config: options.oauthConfig,
      client: new GoogleDriveOAuthClient(options.oauthConfig, {
        ...(options.oauthTransport === undefined ? {} : { transport: options.oauthTransport }),
      }),
    };
  };

  app.get("/v1/integrations/google-drive/status", async (req) => {
    const { workspaceId } = parseOrBadRequest(StatusQuerySchema, req.query);
    requirePersonalWorkspace(workspaceId);
    if (options.credentialVault === undefined) {
      return GoogleDriveConnectionStatusSchema.parse({
        provider: GOOGLE_DRIVE_PROVIDER_ID,
        workspaceId: DEFAULT_WORKSPACE_ID,
        available: false,
        connected: false,
        scope: GOOGLE_DRIVE_FILE_SCOPE,
        updatedAt: null,
      });
    }
    try {
      return googleDriveConnectionStatus(options.credentialVault, available());
    } catch (error) {
      throw mapGoogleDriveError(error);
    }
  });

  app.post("/v1/integrations/google-drive/oauth/start", async (req) => {
    const body = parseOrBadRequest(GoogleDriveOAuthStartRequestSchema, req.body);
    requirePersonalWorkspace(body.workspaceId);
    const { config } = runtime();
    try {
      return stateStore.begin(config, body);
    } catch (error) {
      throw mapGoogleDriveError(error);
    }
  });

  app.post("/v1/integrations/google-drive/oauth/callback", async (req) => {
    const body = parseOrBadRequest(GoogleDriveOAuthCallbackRequestSchema, req.body);
    const { vault, client } = runtime();

    let consumed;
    try {
      consumed = stateStore.consume(body.state);
    } catch (error) {
      throw mapGoogleDriveError(error);
    }
    requirePersonalWorkspace(consumed.workspaceId);

    if (body.error !== undefined) {
      throw new HttpError(
        400,
        "GOOGLE_DRIVE_OAUTH_DENIED",
        "Otorisasi Google Drive tidak diselesaikan.",
      );
    }

    try {
      const token = await client.exchangeAuthorizationCode(body.code!, consumed.codeVerifier);
      if (token.refreshToken !== undefined) {
        storeGoogleDriveRefreshToken(vault, token.refreshToken, now());
      } else if (vault.get(GOOGLE_DRIVE_PROVIDER_ID, "tokens") === undefined) {
        throw new HttpError(
          409,
          "GOOGLE_DRIVE_REFRESH_TOKEN_MISSING",
          "Google tidak mengembalikan refresh token. Putuskan consent lama lalu hubungkan ulang.",
        );
      }

      return GoogleDriveOAuthCallbackResponseSchema.parse({
        workspaceId: DEFAULT_WORKSPACE_ID,
        connected: true,
        returnPath: consumed.returnPath,
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw mapGoogleDriveError(error);
    }
  });

  app.delete("/v1/integrations/google-drive", async (req) => {
    const { workspaceId } = parseOrBadRequest(StatusQuerySchema, req.query);
    requirePersonalWorkspace(workspaceId);
    const { vault, client } = runtime();

    try {
      const refreshToken = vault.get(GOOGLE_DRIVE_PROVIDER_ID, "tokens");
      if (refreshToken === undefined) {
        return DisconnectResponseSchema.parse({ disconnected: false });
      }
      await client.revoke(refreshToken);
      disconnectGoogleDrive(vault);
      return DisconnectResponseSchema.parse({ disconnected: true });
    } catch (error) {
      throw mapGoogleDriveError(error);
    }
  });
}
