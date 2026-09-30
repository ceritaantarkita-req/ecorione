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
import {
  OpenRouterModelDiscovery,
  OpenRouterModelDiscoveryError,
  type OpenRouterModelDiscoveryReader,
} from "./openrouter-model-discovery.js";
import { executableHostedModelRegistryEntry } from "./hosted-model-registry.js";

const CredentialParamsSchema = z.object({ provider: z.enum(CREDENTIAL_PROVIDERS) });
const CredentialBodySchema = z.object({ secret: z.string().min(1).max(32_768) }).strict();
const OpenRouterModelValidationBodySchema = z.object({ confirmed: z.literal(true) }).strict();
const OpenRouterModelSelectionBodySchema = z
  .object({ selectionId: z.string().trim().min(1).max(256) })
  .strict();
const OpenRouterDiscoveryQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    sourceProvider: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/u)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    refresh: z.enum(["0", "1"]).default("0"),
  })
  .strict();

export interface ConnectControlOptions {
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly credentialVault?: CredentialVaultAdmin | undefined;
  readonly openRouterModelDiscovery?: OpenRouterModelDiscoveryReader | undefined;
  /** Performs a bounded, explicitly confirmed provider test and records non-secret evidence. */
  readonly validateOpenRouterModel?: ((selectionId: string) => Promise<unknown>) | undefined;
  readonly spendStatus?:
    | (() => {
        policy: { dailyUsd: number | null; monthlyUsd: number | null; unlimited: boolean };
        budget: {
          dailyLimitUsd: number | null;
          monthlyLimitUsd: number | null;
          dailyCommittedUsd: number;
          monthlyCommittedUsd: number;
          unsettledReservations: number;
        } | null;
      })
    | undefined;
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
  const openRouterModelDiscovery =
    options.openRouterModelDiscovery ?? new OpenRouterModelDiscovery();
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

  app.get("/v1/settings/spend-status", async () => ({
    operatorGateOpen: runtime().get().settings.hostedCallsEnabled,
    ...(options.spendStatus?.() ?? {
      policy: { dailyUsd: null, monthlyUsd: null, unlimited: false },
      budget: null,
    }),
  }));
  app.get("/v1/settings/runtime", async () => runtime().get());
  app.put("/v1/settings/runtime", async (req) => {
    const patch = parseOrBadRequest(RuntimeSettingsPatchSchema, req.body);
    const currentSettings = runtime().get().settings;
    const currentOpenRouterSelection =
      currentSettings.openRouterModelSelection ??
      (currentSettings.hostedProvider === "openrouter"
        ? currentSettings.hostedModel
        : "governed");
    if (
      patch.openRouterModelSelection !== undefined &&
      patch.openRouterModelSelection !== currentOpenRouterSelection
    ) {
      throw new HttpError(
        400,
        "OPENROUTER_SELECTION_REQUIRES_ADMISSION",
        "OpenRouter model selection harus melewati admission endpoint.",
      );
    }
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

  app.get("/v1/settings/providers/openrouter/models", async (req) => {
    const query = parseOrBadRequest(OpenRouterDiscoveryQuerySchema, req.query);
    try {
      const result = await openRouterModelDiscovery.list({
        ...(query.q === undefined ? {} : { q: query.q }),
        ...(query.sourceProvider === undefined ? {} : { sourceProvider: query.sourceProvider }),
        limit: query.limit,
        forceRefresh: query.refresh === "1",
      });
      metrics.addCounter("ecorione_openrouter_model_discovery_total", 1, {
        outcome: "pass",
        cache: result.cache,
        stale: result.stale ? "true" : "false",
      });
      return result;
    } catch (error) {
      metrics.addCounter("ecorione_openrouter_model_discovery_total", 1, {
        outcome: "error",
      });
      if (error instanceof OpenRouterModelDiscoveryError) {
        throw new HttpError(
          error.kind === "unreachable" ? 503 : 502,
          error.kind === "unreachable"
            ? "OPENROUTER_CATALOG_UNAVAILABLE"
            : "OPENROUTER_CATALOG_INVALID",
          error.message,
        );
      }
      throw error;
    }
  });

  app.post<{ Params: { selectionId: string } }>(
    "/v1/settings/providers/openrouter/models/:selectionId/validate",
    async (req) => {
      parseOrBadRequest(OpenRouterModelValidationBodySchema, req.body);
      const selectionId = z.string().trim().min(1).max(256).parse(req.params.selectionId);
      if (options.validateOpenRouterModel === undefined) {
        throw new HttpError(
          503,
          "OPENROUTER_VALIDATION_UNAVAILABLE",
          "Validasi model OpenRouter belum dikonfigurasi.",
        );
      }
      return options.validateOpenRouterModel(selectionId);
    },
  );

  app.put("/v1/settings/providers/openrouter/model-selection", async (req) => {
    const { selectionId } = parseOrBadRequest(OpenRouterModelSelectionBodySchema, req.body);

    if (selectionId === "governed") {
      const result = runtime().update({
        hostedProvider: "openrouter",
        hostedModel: "governed",
        openRouterModelSelection: "governed",
        hostedCallsEnabled: true,
        defaultChatTarget: "hosted",
      });
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "openrouter-model-selection",
        admission: "governed",
        executable: "true",
      });
      return {
        runtime: result,
        selection: {
          id: selectionId,
          admission: "governed",
          executable: true,
          active:
            result.settings.hostedProvider === "openrouter" &&
            result.settings.hostedModel === "governed" &&
            result.settings.hostedCallsEnabled,
          unavailableReason: null,
        },
      };
    }

    const executable = executableHostedModelRegistryEntry("openrouter", selectionId);
    if (executable !== undefined) {
      const result = runtime().update({
        hostedProvider: "openrouter",
        hostedModel: selectionId,
        openRouterModelSelection: selectionId,
        hostedCallsEnabled: true,
        defaultChatTarget: "hosted",
      });
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "openrouter-model-selection",
        admission: "verified-executable",
        executable: "true",
      });
      return {
        runtime: result,
        selection: {
          id: selectionId,
          admission: "verified-executable",
          executable: true,
          active:
            result.settings.hostedProvider === "openrouter" &&
            result.settings.hostedModel === selectionId &&
            result.settings.hostedCallsEnabled,
          unavailableReason: null,
        },
      };
    }

    let discovery;
    try {
      discovery = await openRouterModelDiscovery.list({ q: selectionId, limit: 100 });
    } catch (error) {
      if (error instanceof OpenRouterModelDiscoveryError) {
        throw new HttpError(
          error.kind === "unreachable" ? 503 : 502,
          error.kind === "unreachable"
            ? "OPENROUTER_CATALOG_UNAVAILABLE"
            : "OPENROUTER_CATALOG_INVALID",
          error.message,
        );
      }
      throw error;
    }

    const candidate = discovery.models.find(
      (model) => model.selectionId === selectionId && model.selectable,
    );
    if (candidate === undefined) {
      const rejected = discovery.models.find(
        (model) => model.id === selectionId || model.selectionId === selectionId,
      );
      const reason = rejected?.unavailableReason ?? "not-admitted";
      throw new HttpError(
        409,
        "OPENROUTER_MODEL_NOT_SELECTABLE",
        `Model ${selectionId} tidak selectable pada snapshot OpenRouter saat ini (${reason}).`,
      );
    }

    if (candidate.executable) {
      const settingsAdmin = runtime();
      if (settingsAdmin.certifyOpenRouterModel === undefined) {
        throw new HttpError(
          503,
          "OPENROUTER_VALIDATION_UNAVAILABLE",
          "Penyimpanan status Ready OpenRouter belum dikonfigurasi.",
        );
      }
      const result = settingsAdmin.certifyOpenRouterModel(candidate.id);
      metrics.addCounter("ecorione_control_changes_total", 1, {
        surface: "openrouter-model-selection",
        admission: "validated-executable",
        executable: "true",
      });
      return {
        runtime: result,
        selection: {
          id: candidate.id,
          admission: "validated-executable",
          executable: true,
          active: result.settings.hostedCallsEnabled,
          unavailableReason: null,
        },
      };
    }

    const result = runtime().update({
      hostedProvider: "openrouter",
      hostedModel: "governed",
      openRouterModelSelection: selectionId,
      hostedCallsEnabled: false,
      defaultChatTarget: "local",
    });
    metrics.addCounter("ecorione_control_changes_total", 1, {
      surface: "openrouter-model-selection",
      admission: candidate.admission,
      executable: "false",
    });
    return {
      runtime: result,
      selection: {
        id: selectionId,
        admission: candidate.admission,
        executable: false,
        active: false,
        unavailableReason: null,
      },
    };
  });

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
