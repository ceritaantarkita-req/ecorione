import { HttpError, observabilityFor, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CREDENTIAL_PROVIDERS,
  type CredentialProvider,
  type CredentialPurpose,
  type CredentialVaultAdmin,
} from "./credential-vault.js";
import { nowIso } from "./clock.js";
import { RuntimeSettingsPatchSchema, type RuntimeSettingsAdmin } from "./runtime-settings.js";

const CredentialParamsSchema = z.object({ provider: z.enum(CREDENTIAL_PROVIDERS) });
const CredentialBodySchema = z.object({ secret: z.string().min(1).max(32_768) }).strict();

function credentialPurpose(provider: CredentialProvider): CredentialPurpose {
  return provider === "mcp" ? "tokens" : "messages";
}

export interface ConnectControlOptions {
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly credentialVault?: CredentialVaultAdmin | undefined;
}

export function registerConnectControlRoutes(
  app: FastifyInstance,
  options: ConnectControlOptions,
): void {
  const metrics = observabilityFor(app);
  const runtime = (): RuntimeSettingsAdmin => {
    if (options.runtimeSettings === undefined)
      throw new HttpError(
        503,
        "SETTINGS_UNAVAILABLE",
        "Runtime settings store tidak tersedia.",
      );
    return options.runtimeSettings;
  };
  const vault = (): CredentialVaultAdmin => {
    if (options.credentialVault === undefined)
      throw new HttpError(
        503,
        "CREDENTIAL_VAULT_UNAVAILABLE",
        "Credential vault admin tidak tersedia.",
      );
    return options.credentialVault;
  };

  app.get("/v1/settings/runtime", async () => runtime().get());
  app.put("/v1/settings/runtime", async (req) => {
    const result = runtime().update(parseOrBadRequest(RuntimeSettingsPatchSchema, req.body));
    metrics.addCounter("ecorione_control_changes_total", 1, { surface: "runtime-settings" });
    return result;
  });

  app.get("/v1/settings/credentials", async () => ({
    available: options.credentialVault !== undefined,
    credentials: options.credentialVault?.list() ?? [],
  }));
  app.put<{ Params: { provider: string } }>(
    "/v1/settings/credentials/:provider",
    async (req) => {
      const { provider } = parseOrBadRequest(CredentialParamsSchema, req.params);
      const { secret } = parseOrBadRequest(CredentialBodySchema, req.body);
      const metadata = vault().set(provider, credentialPurpose(provider), secret, nowIso());
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "credential",
        provider,
        action: "set",
      });
      return metadata;
    },
  );
  app.delete<{ Params: { provider: string } }>(
    "/v1/settings/credentials/:provider",
    async (req) => {
      const { provider } = parseOrBadRequest(CredentialParamsSchema, req.params);
      const removed = vault().remove(provider, credentialPurpose(provider));
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "credential",
        provider,
        action: "remove",
      });
      return { removed };
    },
  );
}
