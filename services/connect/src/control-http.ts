import { HttpError, observabilityFor, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CREDENTIAL_PROVIDERS,
  CredentialVaultBusyError,
  type CredentialVaultAdmin,
} from "./credential-vault.js";
import { nowIso } from "./clock.js";
import {
  PROVIDER_CATALOG,
  credentialPurposeForProvider as purposeFor,
} from "./provider-catalog.js";
import {
  MutableLocalModelTagError,
  RuntimeSettingsPatchSchema,
  type RuntimeSettingsAdmin,
} from "./runtime-settings.js";

const CredentialParamsSchema = z.object({ provider: z.enum(CREDENTIAL_PROVIDERS) });
const CredentialBodySchema = z.object({ secret: z.string().min(1).max(32_768) }).strict();

export interface ConnectControlOptions {
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly credentialVault?: CredentialVaultAdmin | undefined;
}

function credentialMutation<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof CredentialVaultBusyError) {
      throw new HttpError(
        503,
        "CREDENTIAL_VAULT_BUSY",
        "Credential vault sedang dipakai; coba lagi.",
      );
    }
    throw error;
  }
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
    const patch = parseOrBadRequest(RuntimeSettingsPatchSchema, req.body);
    let result;
    try {
      result = runtime().update(patch);
    } catch (err) {
      // Alias model lokal yang mutable adalah input operator yang salah, bukan bug
      // Connect — 400 eksplisit, bukan 500 generik (ADR-14).
      if (err instanceof MutableLocalModelTagError)
        throw new HttpError(400, "MUTABLE_LOCAL_MODEL_TAG", err.message);
      throw err;
    }
    metrics.addCounter("ecorione_control_changes_total", 1, { surface: "runtime-settings" });
    return result;
  });

  app.get("/v1/settings/providers", async () => ({
    providers: PROVIDER_CATALOG,
  }));

  app.get("/v1/settings/credentials", async () => ({
    available: options.credentialVault !== undefined,
    credentials: options.credentialVault?.list() ?? [],
  }));
  app.put<{ Params: { provider: string } }>(
    "/v1/settings/credentials/:provider",
    async (req) => {
      const { provider } = parseOrBadRequest(CredentialParamsSchema, req.params);
      const { secret: value } = parseOrBadRequest(CredentialBodySchema, req.body);
      const metadata = credentialMutation(() =>
        vault().set(provider, purposeFor(provider), value, nowIso()),
      );
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
      const removed = credentialMutation(() => vault().remove(provider, purposeFor(provider)));
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "credential",
        provider,
        action: "remove",
      });
      return { removed };
    },
  );
}
