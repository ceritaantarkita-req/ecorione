/** Route HTTP Connect — provider gateway and local runtime boundary. */
import { ToolDefinitionSchema } from "@ecorione/context-assembly";
import {
  CoreMemorySchema,
  MultimodalInferRequestSchema,
  OperationIdSchema,
  SensitivitySchema,
  makeId,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  createServer,
  HttpError,
  observabilityFor,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ExactMatchCache } from "./cache.js";
import { nowIso } from "./clock.js";
import { complete, type CompleteDeps } from "./complete.js";
import {
  CredentialVaultError,
  type CredentialVaultAdmin,
  type ProviderCredentialReader,
} from "./credential-vault.js";
import { registerConnectControlRoutes } from "./control-http.js";
import {
  registerGoogleDriveOAuthRoutes,
  type GoogleDriveOAuthHttpOptions,
} from "./google-drive-http.js";
import {
  GoogleDriveSource,
  type GoogleDriveApiTransport,
} from "./google-drive-source.js";
import { GoogleDriveOAuthClient } from "./google-drive-token.js";
import {
  OpenRouterModelDiscovery,
  OpenRouterModelDiscoveryError,
  type OpenRouterModelDiscoveryReader,
} from "./openrouter-model-discovery.js";
import type {
  OpenRouterCertificationAdmin,
  OpenRouterCertificationReader,
} from "./openrouter-certification-store.js";
import { registerOutboundMcpRoutes } from "./mcp-client/http.js";
import type { McpManager } from "./mcp-client/manager.js";
import { GOVERNED_HOSTED_MODEL, type HostedModelPreference } from "./hosted-model-catalog.js";
import { discoverLocalRuntime } from "./local-runtime-discovery.js";
import { LocalModelDigestSchema, type LocalModelDigest } from "./local-model-identity.js";
import { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";
import {
  DEFAULT_HOSTED_PROVIDER,
  HostedProviderIdSchema,
  type HostedProviderId,
} from "./provider-types.js";
import { NVIDIA_PROVIDER_PROBE_MAX_OUTPUT_TOKENS } from "./providers/nvidia.js";
import type { OpenAiCompatibleTransport } from "./providers/openai-compatible.js";
import {
  createPublicHttpsOpenAiTransport,
  PublicHttpsEndpointError,
  resolvePublicHttpsEndpoint,
  type PublicHttpsResolveHost,
} from "./providers/public-https-transport.js";
import {
  CustomOpenAiBaseUrlSchema,
  CustomOpenAiConfigSchema,
  CustomOpenAiModelSchema,
  LocalBaseUrlSchema,
  type ChatTargetPreference,
  type RuntimeSettings,
  type RuntimeSettingsAdmin,
} from "./runtime-settings.js";
import { MutableLocalModelTagError } from "./runtime-settings.js";
import {
  CostKillSwitchError,
  CustomProviderPolicyError,
  MissingCredentialError,
  ProviderError,
  SpendBudgetNotConfiguredError,
} from "./providers/errors.js";
import { LocalModelDigestMismatchError } from "./providers/local-model-provenance.js";
import { LocalRuntimeIdSchema, type LocalRuntimeId } from "./providers/local-runtime.js";
import { FileSpendBudget, SpendBudgetError, SpendBudgetExceededError } from "./spend-budget.js";
import {
  registerExternalSourceFetchRoutes,
  registerGoogleDriveSourceFetchRoutes,
  registerMcpResourceSourceFetchRoutes,
} from "./source-fetch-http.js";
import { registerConnectWebhookRoutes } from "./webhook-http.js";

export const DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES = 32 * 1024 * 1024;
export const DEFAULT_CREDENTIAL_TEST_TIMEOUT_MS = 60_000;

function toHttpError(err: unknown, detailedProviderHealth = false): unknown {
  if (err instanceof CostKillSwitchError)
    return new HttpError(503, "COST_KILL_SWITCH_ACTIVE", err.message);
  if (err instanceof CustomProviderPolicyError)
    return new HttpError(403, "CUSTOM_PROVIDER_POLICY_DENIED", err.message);
  if (err instanceof SpendBudgetNotConfiguredError)
    return new HttpError(503, "SPEND_BUDGET_NOT_CONFIGURED", err.message);
  if (err instanceof MutableLocalModelTagError)
    return new HttpError(400, "MUTABLE_LOCAL_MODEL_TAG", err.message);
  // Runtime melayani model yang berbeda dari yang dideklarasikan operator: fail-closed,
  // karena hasilnya akan masuk evidence dengan atribusi yang keliru (ADR-14).
  if (err instanceof LocalModelDigestMismatchError)
    return new HttpError(409, "LOCAL_MODEL_DIGEST_MISMATCH", err.message);
  if (err instanceof CredentialVaultError)
    return new HttpError(503, "CREDENTIAL_VAULT_UNAVAILABLE", err.message);
  if (err instanceof SpendBudgetExceededError)
    return new HttpError(429, "SPEND_BUDGET_EXCEEDED", err.message);
  if (err instanceof SpendBudgetError)
    return new HttpError(503, "SPEND_BUDGET_UNAVAILABLE", err.message);
  if (err instanceof MissingCredentialError) {
    return detailedProviderHealth
      ? new HttpError(502, "PROVIDER_CREDENTIAL_MISSING", err.message)
      : new BadGatewayError(err.message);
  }
  if (err instanceof ProviderError) {
    if (!detailedProviderHealth) return new BadGatewayError(err.message);
    if (err.kind === "invalid-credential")
      return new HttpError(502, "PROVIDER_INVALID_CREDENTIAL", err.message);
    if (err.kind === "unreachable")
      return new HttpError(503, "PROVIDER_UNREACHABLE", err.message);
    return new HttpError(502, "PROVIDER_UPSTREAM_ERROR", err.message);
  }
  return err;
}

const StablePrefixBodySchema = z.object({
  systemPrompt: z.string(),
  toolDefinitions: z.array(ToolDefinitionSchema),
  coreMemory: CoreMemorySchema,
});

const CompleteBodySchema = z.object({
  target: z.enum(["hosted", "local"]),
  prefix: StablePrefixBodySchema,
  dynamicText: z.string(),
  userMessage: z.string().min(1),
  sensitivity: SensitivitySchema,
  operationId: OperationIdSchema,
  now: z.string().datetime({ offset: false }),
});

const ProviderCanaryBodySchema = z
  .object({
    target: z.enum(["hosted", "local"]).default("local"),
    prompt: z.string().min(1).max(2_000).default("Reply exactly ECORIONE_CANARY_OK"),
    expectedSubstring: z.string().min(1).max(256).default("ECORIONE_CANARY_OK"),
    minOutputChars: z.number().int().min(1).max(10_000).default(10),
    maxLatencyMs: z.number().int().min(100).max(120_000).default(60_000),
  })
  .strict();

const CredentialTestParamsSchema = z.object({ provider: HostedProviderIdSchema });
const CredentialTestBodySchema = z.object({ secret: z.string().min(1).max(32_768) }).strict();
const CustomOpenAiConnectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    baseUrl: CustomOpenAiBaseUrlSchema,
    model: CustomOpenAiModelSchema,
    secret: z.string().min(1).max(32_768),
    inputUsdPerMTok: z.number().finite().nonnegative().max(1_000_000),
    outputUsdPerMTok: z.number().finite().nonnegative().max(1_000_000),
  })
  .strict();
const LocalRuntimeDiscoveryBodySchema = z
  .object({
    localRuntime: LocalRuntimeIdSchema.default("openai-compatible"),
    localBaseUrl: LocalBaseUrlSchema,
    localModelTag: z.string().min(1).max(256),
    localModelDigest: LocalModelDigestSchema.nullable().optional(),
  })
  .strict();

export interface BuildConnectServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly credentialVault?: ProviderCredentialReader | undefined;
  readonly credentialVaultAdmin?: CredentialVaultAdmin | undefined;
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly hostedProvider?: HostedProviderId | undefined;
  readonly hostedModel?: HostedModelPreference | undefined;
  /** Development-only fallbacks when no credential vault is configured. */
  readonly anthropicApiKey?: string | undefined;
  readonly openrouterApiKey?: string | undefined;
  readonly openaiApiKey?: string | undefined;
  readonly nvidiaApiKey?: string | undefined;
  readonly localRuntime?: LocalRuntimeId | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  readonly localModelDigest?: LocalModelDigest | null | undefined;
  readonly hostedCallsEnabled?: boolean | undefined;
  readonly spendDailyUsd?: number | null | undefined;
  readonly spendMonthlyUsd?: number | null | undefined;
  readonly defaultChatTarget?: ChatTargetPreference | undefined;
  readonly spendBudget?: CompleteDeps["spendBudget"] | undefined;
  readonly spendBudgetFactory?:
    ((runtime: RuntimeSettings) => CompleteDeps["spendBudget"]) | undefined;
  readonly hostedSpendUnlimited?: boolean | undefined;
  readonly hostedSpendUnlimitedResolver?: ((runtime: RuntimeSettings) => boolean) | undefined;
  readonly resolveLocalProvenance?: CompleteDeps["resolveLocalProvenance"] | undefined;
  readonly cache?: ExactMatchCache | undefined;
  readonly mcpManager?: McpManager | undefined;
  readonly localMultimodalAdapter?: MultimodalAdapter | undefined;
  readonly hostedMultimodalAdapter?: MultimodalAdapter | undefined;
  readonly multimodalBodyLimitBytes?: number | undefined;
  readonly flowUrl?: string | undefined;
  /** Development-only fallback when the encrypted vault is not configured. */
  readonly webhookRootSecret?: string | undefined;
  readonly webhookForwardTimeoutMs?: number | undefined;
  /** Test-only override; production defaults to a bounded 60-second credential probe. */
  readonly credentialTestTimeoutMs?: number | undefined;
  readonly openRouterModelDiscovery?: OpenRouterModelDiscoveryReader | undefined;
  readonly openRouterCertificationReader?: OpenRouterCertificationReader | undefined;
  readonly openRouterCertificationAdmin?: OpenRouterCertificationAdmin | undefined;
  /** Test seams; production custom providers use DNS-pinned public HTTPS. */
  readonly customOpenAiTransport?: OpenAiCompatibleTransport | undefined;
  readonly customOpenAiResolveHost?: PublicHttpsResolveHost | undefined;
  readonly googleDriveOAuthConfig?: GoogleDriveOAuthHttpOptions["oauthConfig"] | undefined;
  readonly googleDriveOAuthTransport?:
    GoogleDriveOAuthHttpOptions["oauthTransport"] | undefined;
  readonly googleDriveOAuthStateStore?:
    GoogleDriveOAuthHttpOptions["oauthStateStore"] | undefined;
  readonly googleDriveApiTransport?: GoogleDriveApiTransport | undefined;
}

export function buildConnectServer(options: BuildConnectServerOptions): FastifyInstance {
  const app = createServer({
    name: "connect",
    token: options.token,
    logger: options.logger,
    bodyLimit: options.multimodalBodyLimitBytes ?? DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES,
    authExemptRoutes: ["/v1/webhooks/:hookId"],
  });
  const metrics = observabilityFor(app);
  const cache = options.cache ?? new ExactMatchCache();
  const openRouterModelDiscovery =
    options.openRouterModelDiscovery ??
    new OpenRouterModelDiscovery({
      certificationReader: options.openRouterCertificationReader,
    });
  const credentialTestTimeoutMs =
    options.credentialTestTimeoutMs ?? DEFAULT_CREDENTIAL_TEST_TIMEOUT_MS;
  const defaults: RuntimeSettings = {
    hostedProvider: options.hostedProvider ?? DEFAULT_HOSTED_PROVIDER,
    hostedModel: options.hostedModel ?? GOVERNED_HOSTED_MODEL,
    localRuntime: options.localRuntime ?? "openai-compatible",
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    localModelDigest: options.localModelDigest ?? null,
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
    spendDailyUsd: options.spendDailyUsd ?? null,
    spendMonthlyUsd: options.spendMonthlyUsd ?? null,
    spendUnlimited: options.hostedSpendUnlimited ?? false,
    defaultChatTarget: options.defaultChatTarget ?? "local",
  };
  const currentRuntime = (): RuntimeSettings =>
    options.runtimeSettings?.get().settings ?? defaults;
  const currentDeps = (runtime = currentRuntime()): CompleteDeps => {
    const selection = runtime.openRouterModelSelection;
    const certification =
      runtime.hostedProvider === "openrouter" &&
      selection !== undefined &&
      runtime.openRouterCertifiedModelId === selection
        ? options.openRouterCertificationReader?.get(selection)
        : undefined;
    return {
      credentialVault: options.credentialVault,
      hostedProvider: runtime.hostedProvider,
      hostedModel: runtime.hostedModel,
      ...(certification === undefined
        ? {}
        : {
            certifiedOpenRouterModel: {
              id: certification.modelId,
              promptPricePerToken: certification.promptPricePerToken,
              completionPricePerToken: certification.completionPricePerToken,
            },
          }),
      anthropicApiKey: options.anthropicApiKey,
      openrouterApiKey: options.openrouterApiKey,
      openaiApiKey: options.openaiApiKey,
      nvidiaApiKey: options.nvidiaApiKey,
      ...(runtime.customOpenAi === undefined
        ? {}
        : { customOpenAiConfig: runtime.customOpenAi }),
      customOpenAiTransport:
        options.customOpenAiTransport ??
        createPublicHttpsOpenAiTransport({
          ...(options.customOpenAiResolveHost === undefined
            ? {}
            : { resolveHost: options.customOpenAiResolveHost }),
        }),
      localRuntime: runtime.localRuntime,
      localBaseUrl: runtime.localBaseUrl,
      localModelTag: runtime.localModelTag,
      localModelDigest: runtime.localModelDigest,
      cache,
      hostedCallsEnabled: runtime.hostedCallsEnabled,
      spendBudget: options.spendBudgetFactory?.(runtime) ?? options.spendBudget,
      hostedSpendUnlimited:
        options.hostedSpendUnlimitedResolver?.(runtime) ?? options.hostedSpendUnlimited,
      resolveLocalProvenance: options.resolveLocalProvenance,
    };
  };

  // Session 4E dynamic OpenRouter execution binds to a fresh compatible catalog
  // snapshot on every paid completion. The persisted trusted marker only proves that
  // Connect admitted this exact selection; catalog freshness/capability/pricing are
  // re-checked here so stale metadata can never become execution authority.
  const currentCompletionDeps = async (): Promise<CompleteDeps> => {
    const runtime = currentRuntime();
    const selection = runtime.openRouterModelSelection;
    const hasDynamicSelectionAuthority =
      runtime.hostedProvider === "openrouter" &&
      selection !== undefined &&
      selection !== GOVERNED_HOSTED_MODEL &&
      runtime.openRouterCertifiedModelId === selection;
    if (!hasDynamicSelectionAuthority) return currentDeps(runtime);

    let discovery;
    try {
      discovery = await openRouterModelDiscovery.list({ q: selection, limit: 100 });
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
    const model = discovery.models.find(
      (candidate) =>
        candidate.id === selection &&
        candidate.selectionId === selection &&
        candidate.selectable,
    );
    const promptPricePerToken = model?.promptPricePerToken;
    const completionPricePerToken = model?.completionPricePerToken;
    if (
      discovery.stale ||
      model === undefined ||
      promptPricePerToken === null ||
      promptPricePerToken === undefined ||
      completionPricePerToken === null ||
      completionPricePerToken === undefined
    ) {
      throw new HttpError(
        409,
        "OPENROUTER_SELECTION_STALE_OR_INVALID",
        "Model OpenRouter yang dipilih tidak lagi punya katalog segar, capability yang kompatibel, dan harga valid. Refresh katalog lalu pilih model lagi.",
      );
    }
    return {
      ...currentDeps(runtime),
      // Legacy CompleteDeps field name retained for compatibility. At this boundary it
      // carries fresh Connect-resolved execution metadata, not user certification.
      certifiedOpenRouterModel: {
        id: model.id,
        promptPricePerToken,
        completionPricePerToken,
      },
    };
  };

  if (options.mcpManager !== undefined) {
    registerOutboundMcpRoutes(app, options.mcpManager);
    registerMcpResourceSourceFetchRoutes(app, options.mcpManager);
  }
  registerExternalSourceFetchRoutes(app);
  const googleDriveSource =
    options.googleDriveOAuthConfig === undefined || options.credentialVaultAdmin === undefined
      ? undefined
      : new GoogleDriveSource({
          vault: options.credentialVaultAdmin,
          oauthClient: new GoogleDriveOAuthClient(options.googleDriveOAuthConfig, {
            ...(options.googleDriveOAuthTransport === undefined
              ? {}
              : { transport: options.googleDriveOAuthTransport }),
          }),
          ...(options.googleDriveApiTransport === undefined
            ? {}
            : { transport: options.googleDriveApiTransport }),
        });
  registerGoogleDriveSourceFetchRoutes(app, googleDriveSource);
  registerGoogleDriveOAuthRoutes(app, {
    credentialVault: options.credentialVaultAdmin,
    oauthConfig: options.googleDriveOAuthConfig,
    oauthStateStore: options.googleDriveOAuthStateStore,
    oauthTransport: options.googleDriveOAuthTransport,
  });
  async function validateOpenRouterModel(selectionId: string): Promise<unknown> {
    if (
      options.openRouterCertificationAdmin === undefined ||
      options.runtimeSettings?.certifyOpenRouterModel === undefined
    ) {
      throw new HttpError(
        503,
        "OPENROUTER_VALIDATION_UNAVAILABLE",
        "Penyimpanan bukti validasi OpenRouter belum dikonfigurasi.",
      );
    }
    let discovery;
    try {
      discovery = await openRouterModelDiscovery.list({
        q: selectionId,
        limit: 100,
        forceRefresh: true,
      });
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
    if (
      candidate === undefined ||
      candidate.validationPlan === null ||
      candidate.validationPlan === undefined
    ) {
      throw new HttpError(
        409,
        "OPENROUTER_MODEL_NOT_VALIDATABLE",
        "Model tidak memiliki harga atau kontrak text yang cukup untuk test aman saat ini.",
      );
    }
    const runtime = currentRuntime();
    const body = probeBody("hosted", "Reply exactly ECORIONE_MODEL_VALIDATION_OK");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), credentialTestTimeoutMs);
    const started = performance.now();
    try {
      const result = await complete(
        {
          ...currentDeps({
            ...runtime,
            hostedProvider: "openrouter",
            hostedModel: GOVERNED_HOSTED_MODEL,
            openRouterModelSelection: selectionId,
            openRouterCertifiedModelId: undefined,
          }),
          certifiedOpenRouterModel: {
            id: candidate.id,
            promptPricePerToken: candidate.promptPricePerToken!,
            completionPricePerToken: candidate.completionPricePerToken!,
          },
          cache: new ExactMatchCache(),
          hostedMaxOutputTokens: candidate.validationPlan.maxOutputTokens,
          hostedReservationUsdOverride: candidate.validationPlan.reservationUsd,
        },
        body,
        controller.signal,
      );
      if (
        result.responseModel !== candidate.id ||
        !result.reply.includes("ECORIONE_MODEL_VALIDATION_OK")
      ) {
        throw new HttpError(
          502,
          "OPENROUTER_MODEL_VALIDATION_FAILED",
          "Respons test tidak membuktikan model yang dipilih; model tidak diaktifkan.",
        );
      }
      options.openRouterCertificationAdmin.record({
        modelId: candidate.id,
        certifiedAt: nowIso(),
        catalogFetchedAt: discovery.fetchedAt,
        responseModel: result.responseModel,
        ...(result.routingProvider === undefined
          ? {}
          : { routingProvider: result.routingProvider }),
        latencyMs: performance.now() - started,
        billedCostUsd: result.cost.actualUsd,
        promptPricePerToken: candidate.promptPricePerToken!,
        completionPricePerToken: candidate.completionPricePerToken!,
      });
      const activeRuntime = options.runtimeSettings.certifyOpenRouterModel(candidate.id);
      recordCompletion(body, result);
      metrics.addCounter("ecorione_openrouter_model_validation_total", 1, { outcome: "pass" });
      return {
        pass: true,
        selectionId: candidate.id,
        ready: true,
        test: {
          capUsd: candidate.validationPlan.capUsd,
          reservedUsd: result.budget?.reservedUsd ?? candidate.validationPlan.reservationUsd,
          actualUsd: result.cost.actualUsd,
          latencyMs: performance.now() - started,
          responseModel: result.responseModel,
        },
        ...(activeRuntime === undefined ? {} : { runtime: activeRuntime }),
      };
    } catch (error) {
      metrics.addCounter("ecorione_openrouter_model_validation_total", 1, {
        outcome: controller.signal.aborted ? "timeout" : "error",
      });
      if (controller.signal.aborted) {
        throw new HttpError(
          504,
          "PROVIDER_TEST_TIMEOUT",
          `Test model OpenRouter timeout setelah ${String(credentialTestTimeoutMs)}ms; model belum diaktifkan.`,
        );
      }
      throw toHttpError(error, true);
    } finally {
      clearTimeout(timeout);
    }
  }

  registerConnectControlRoutes(app, {
    runtimeSettings: options.runtimeSettings,
    credentialVault: options.credentialVaultAdmin,
    openRouterModelDiscovery,
    validateOpenRouterModel,
    spendStatus: () => {
      const runtime = currentRuntime();
      const budget = options.spendBudgetFactory?.(runtime) ?? options.spendBudget;
      return {
        policy: {
          dailyUsd:
            budget instanceof FileSpendBudget
              ? (budget.policy.dailyUsd ?? null)
              : (runtime.spendDailyUsd ?? null),
          monthlyUsd:
            budget instanceof FileSpendBudget
              ? (budget.policy.monthlyUsd ?? null)
              : (runtime.spendMonthlyUsd ?? null),
          unlimited:
            options.hostedSpendUnlimitedResolver?.(runtime) ??
            runtime.spendUnlimited ??
            options.hostedSpendUnlimited ??
            false,
        },
        budget: budget instanceof FileSpendBudget ? budget.summary(nowIso()) : null,
      };
    },
  });
  registerConnectWebhookRoutes(app, {
    flowUrl: options.flowUrl ?? "http://127.0.0.1:17028",
    internalToken: options.token,
    credentialVault: options.credentialVault,
    developmentRootSecret: options.webhookRootSecret,
    forwardTimeoutMs: options.webhookForwardTimeoutMs,
  });

  const recordLocalDiscovery = (result: Awaited<ReturnType<typeof discoverLocalRuntime>>) => {
    metrics.addCounter("ecorione_local_runtime_discovery_total", 1, {
      runtime: result.runtime,
      state: result.state,
    });
    return result;
  };

  app.get("/v1/settings/local-runtime/status", async () => {
    const runtime = currentRuntime();
    return recordLocalDiscovery(
      await discoverLocalRuntime({
        runtime: runtime.localRuntime,
        baseUrl: runtime.localBaseUrl,
        modelTag: runtime.localModelTag,
        declaredDigest: runtime.localModelDigest ?? null,
      }),
    );
  });

  app.post("/v1/settings/local-runtime/status", async (req) => {
    const candidate = parseOrBadRequest(LocalRuntimeDiscoveryBodySchema, req.body);
    return recordLocalDiscovery(
      await discoverLocalRuntime({
        runtime: candidate.localRuntime,
        baseUrl: candidate.localBaseUrl,
        modelTag: candidate.localModelTag,
        declaredDigest: candidate.localModelDigest ?? null,
      }),
    );
  });

  function recordCompletion(
    body: z.infer<typeof CompleteBodySchema>,
    result: Awaited<ReturnType<typeof complete>>,
  ): void {
    const labels = {
      provider: result.provider,
      model: result.model,
      pricingModel: result.pricingModel,
      target: body.target,
      cache: result.cacheHit ? "hit" : "miss",
      modelIdentityPinned: result.modelIdentityPinned ? "true" : "false",
    };
    metrics.addCounter("ecorione_model_calls_total", 1, labels);
    metrics.addCounter("ecorione_model_input_tokens_total", result.usage.inputTokens, labels);
    metrics.addCounter("ecorione_model_output_tokens_total", result.usage.outputTokens, labels);
    metrics.addCounter(
      "ecorione_model_cache_read_tokens_total",
      result.usage.cacheReadTokens,
      labels,
    );
    metrics.addCounter(
      "ecorione_model_cache_write_tokens_total",
      result.usage.cacheWriteTokens,
      labels,
    );
    metrics.addCounter("ecorione_model_cost_usd_total", result.cost.actualUsd, labels);
  }

  function probeBody(target: "hosted" | "local", prompt: string) {
    return CompleteBodySchema.parse({
      target,
      prefix: {
        systemPrompt:
          "You are a deterministic provider health canary. Follow the user instruction exactly.",
        toolDefinitions: [],
        coreMemory: { blocks: [] },
      },
      dynamicText: "",
      userMessage: prompt,
      sensitivity: "PUBLIC",
      operationId: makeId("operation"),
      now: nowIso(),
    });
  }

  app.post("/v1/complete", async (req) => {
    const body = parseOrBadRequest(CompleteBodySchema, req.body);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    req.raw.once("aborted", abort);
    try {
      const result = await complete(await currentCompletionDeps(), body, controller.signal);
      recordCompletion(body, result);
      return result;
    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  app.post("/v1/settings/providers/custom-openai/connect", async (req) => {
    const body = parseOrBadRequest(CustomOpenAiConnectBodySchema, req.body);
    if (
      options.credentialVaultAdmin === undefined ||
      options.runtimeSettings?.activateCustomOpenAi === undefined
    ) {
      throw new HttpError(
        503,
        "CUSTOM_PROVIDER_ONBOARDING_UNAVAILABLE",
        "Custom provider onboarding membutuhkan Connect Vault dan runtime settings.",
      );
    }

    const existingRuntime = currentRuntime();
    const existingConfig = existingRuntime.customOpenAi;
    const existingConnections = options.credentialVaultAdmin
      .list()
      .filter((entry) => entry.provider === "custom-openai" && entry.purpose === "messages");
    if (
      existingConfig !== undefined &&
      existingConnections.length > 0 &&
      (existingConfig.name !== body.name ||
        existingConfig.baseUrl !== body.baseUrl ||
        existingConfig.model !== body.model ||
        existingConfig.inputUsdPerMTok !== body.inputUsdPerMTok ||
        existingConfig.outputUsdPerMTok !== body.outputUsdPerMTok)
    ) {
      throw new HttpError(
        409,
        "CUSTOM_PROVIDER_RECONFIG_REQUIRES_MANAGEMENT",
        "Custom provider yang sudah punya AI Connection tidak boleh diganti diam-diam. Kelola koneksi/config existing dulu.",
      );
    }

    try {
      await resolvePublicHttpsEndpoint(body.baseUrl, options.customOpenAiResolveHost);
    } catch (error) {
      if (error instanceof PublicHttpsEndpointError) {
        throw new HttpError(
          error.code === "CUSTOM_PROVIDER_DNS_UNAVAILABLE" ? 502 : 400,
          error.code,
          error.message,
        );
      }
      throw error;
    }

    const validatedAt = nowIso();
    const config = CustomOpenAiConfigSchema.parse({
      name: body.name,
      baseUrl: body.baseUrl.replace(/\/+$/u, ""),
      model: body.model,
      inputUsdPerMTok: body.inputUsdPerMTok,
      outputUsdPerMTok: body.outputUsdPerMTok,
      validatedAt,
    });
    const transientCredential: ProviderCredentialReader = {
      get(provider, purpose) {
        return provider === "custom-openai" && purpose === "messages" ? body.secret : undefined;
      },
    };
    const probe = probeBody("hosted", "Reply exactly ECORIONE_CUSTOM_PROVIDER_OK");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), credentialTestTimeoutMs);
    const started = performance.now();

    try {
      const result = await complete(
        {
          ...currentDeps({
            ...existingRuntime,
            hostedProvider: "custom-openai",
            hostedModel: config.model,
            customOpenAi: config,
            hostedCallsEnabled:
              options.hostedCallsEnabled ?? existingRuntime.hostedCallsEnabled,
          }),
          credentialVault: transientCredential,
          customOpenAiConfig: config,
          cache: new ExactMatchCache(),
          hostedMaxOutputTokens: 256,
        },
        probe,
        controller.signal,
      );
      if (
        result.responseModel !== config.model ||
        !result.reply.includes("ECORIONE_CUSTOM_PROVIDER_OK")
      ) {
        throw new HttpError(
          502,
          "CUSTOM_PROVIDER_VALIDATION_FAILED",
          "Custom provider tidak membuktikan model dan response contract yang diminta.",
        );
      }

      const metadata = options.credentialVaultAdmin.addConnection(
        "custom-openai",
        "messages",
        body.secret,
        validatedAt,
      );
      try {
        const runtime = options.runtimeSettings.activateCustomOpenAi(config);
        recordCompletion(probe, result);
        metrics.addCounter("ecorione_custom_provider_onboarding_total", 1, {
          outcome: "pass",
        });
        return {
          pass: true,
          provider: "custom-openai",
          connection: metadata,
          runtime,
          config: {
            name: config.name,
            baseUrl: config.baseUrl,
            model: config.model,
            inputUsdPerMTok: config.inputUsdPerMTok,
            outputUsdPerMTok: config.outputUsdPerMTok,
            validatedAt: config.validatedAt,
          },
          latencyMs: performance.now() - started,
          cost: result.cost,
        };
      } catch (error) {
        try {
          options.credentialVaultAdmin.removeConnection(
            "custom-openai",
            "messages",
            metadata.connectionId,
          );
        } catch {
          // Preserve the activation failure. The rollback is best-effort and secrets
          // remain encrypted even if the Vault itself became unavailable.
        }
        throw error;
      }
    } catch (error) {
      metrics.addCounter("ecorione_custom_provider_onboarding_total", 1, {
        outcome: controller.signal.aborted ? "timeout" : "error",
      });
      if (controller.signal.aborted) {
        throw new HttpError(
          504,
          "PROVIDER_TEST_TIMEOUT",
          `Custom provider timeout setelah ${String(credentialTestTimeoutMs)}ms; credential belum disimpan.`,
        );
      }
      throw toHttpError(error, true);
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post<{ Params: { provider: string } }>(
    "/v1/settings/credentials/:provider/test",
    async (req) => {
      const { provider } = parseOrBadRequest(CredentialTestParamsSchema, req.params);
      const { secret } = parseOrBadRequest(CredentialTestBodySchema, req.body);
      if (provider === "custom-openai") {
        throw new HttpError(
          400,
          "CUSTOM_PROVIDER_REQUIRES_CONFIG",
          "Gunakan endpoint custom provider yang menyertakan Name, Base URL, Model, dan pricing.",
        );
      }
      const runtime = currentRuntime();
      const transientCredential: ProviderCredentialReader = {
        get(candidate, purpose) {
          return candidate === provider && purpose === "messages" ? secret : undefined;
        },
      };
      const body = probeBody("hosted", "Reply exactly ECORIONE_CREDENTIAL_OK");
      const started = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), credentialTestTimeoutMs);
      try {
        const result = await complete(
          {
            ...currentDeps({
              ...runtime,
              hostedProvider: provider,
              hostedModel: GOVERNED_HOSTED_MODEL,
              hostedCallsEnabled: options.hostedCallsEnabled ?? runtime.hostedCallsEnabled,
            }),
            credentialVault: transientCredential,
            cache: new ExactMatchCache(),
            // Credential verification has a strict small-output cap so low spend budgets work.
            hostedMaxOutputTokens:
              provider === "nvidia" ? NVIDIA_PROVIDER_PROBE_MAX_OUTPUT_TOKENS : 512,
            ...(provider === "nvidia" ? { hostedReasoningEffort: "low" } : {}),
          },
          body,
          controller.signal,
        );
        const latencyMs = performance.now() - started;
        recordCompletion(body, result);
        metrics.addCounter("ecorione_provider_credential_test_total", 1, {
          provider,
          outcome: "pass",
        });
        return {
          pass: true,
          persisted: false,
          provider: result.provider,
          model: result.model,
          pricingModel: result.pricingModel,
          responseModel: result.responseModel,
          modelIdentity: result.modelIdentity,
          modelIdentityPinned: result.modelIdentityPinned,
          modelIdentityProvenance: result.modelIdentityProvenance,
          cacheHit: result.cacheHit,
          latencyMs,
          usage: result.usage,
          cost: result.cost,
        };
      } catch (err) {
        if (controller.signal.aborted) {
          metrics.addCounter("ecorione_provider_credential_test_total", 1, {
            provider,
            outcome: "timeout",
          });
          throw new HttpError(
            504,
            "PROVIDER_TEST_TIMEOUT",
            `Test ${provider} timeout setelah ${String(credentialTestTimeoutMs)}ms. API key belum disimpan; coba lagi.`,
          );
        }
        metrics.addCounter("ecorione_provider_credential_test_total", 1, {
          provider,
          outcome: "error",
        });
        throw toHttpError(err, true);
      } finally {
        clearTimeout(timeout);
      }
    },
  );

  app.post("/v1/ops/provider-canary", async (req) => {
    const body = parseOrBadRequest(ProviderCanaryBodySchema, req.body ?? {});
    const runtime = currentRuntime();
    const started = performance.now();
    const completeBody = probeBody(body.target, body.prompt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), body.maxLatencyMs);
    try {
      const canaryDeps =
        body.target === "hosted" ? await currentCompletionDeps() : currentDeps(runtime);
      const result = await complete(
        {
          ...canaryDeps,
          cache: new ExactMatchCache(),
          ...(body.target === "hosted" && runtime.hostedProvider === "nvidia"
            ? {
                hostedMaxOutputTokens: NVIDIA_PROVIDER_PROBE_MAX_OUTPUT_TOKENS,
                hostedReasoningEffort: "low",
              }
            : {}),
        },
        completeBody,
        controller.signal,
      );
      const latencyMs = performance.now() - started;
      recordCompletion(completeBody, result);
      const pass =
        result.reply.includes(body.expectedSubstring) &&
        result.reply.length >= body.minOutputChars &&
        latencyMs <= body.maxLatencyMs;
      metrics.addCounter("ecorione_provider_canary_total", 1, {
        provider: result.provider,
        model: result.model,
        outcome: pass ? "pass" : "quality_fail",
      });
      metrics.observe("ecorione_provider_canary_duration_ms", latencyMs, {
        provider: result.provider,
        model: result.model,
      });
      return {
        pass,
        target: body.target,
        provider: result.provider,
        model: result.model,
        pricingModel: result.pricingModel,
        responseModel: result.responseModel,
        modelIdentity: result.modelIdentity,
        modelIdentityPinned: result.modelIdentityPinned,
        modelIdentityProvenance: result.modelIdentityProvenance,
        cacheHit: result.cacheHit,
        latencyMs,
        outputChars: result.reply.length,
        expectedSubstringMatched: result.reply.includes(body.expectedSubstring),
        usage: result.usage,
        cost: result.cost,
      };
    } catch (err) {
      if (controller.signal.aborted) {
        metrics.addCounter("ecorione_provider_canary_total", 1, {
          provider: body.target === "local" ? "local" : runtime.hostedProvider,
          model: body.target === "local" ? runtime.localModelTag : "configured",
          outcome: "timeout",
        });
        throw new HttpError(
          504,
          "PROVIDER_TEST_TIMEOUT",
          `Provider canary timeout setelah ${String(body.maxLatencyMs)}ms.`,
        );
      }
      metrics.addCounter("ecorione_provider_canary_total", 1, {
        provider: body.target === "local" ? "local" : runtime.hostedProvider,
        model: body.target === "local" ? runtime.localModelTag : "configured",
        outcome: "error",
      });
      throw toHttpError(err, true);
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post("/v1/multimodal/infer", async (req) => {
    const body = parseOrBadRequest(MultimodalInferRequestSchema, req.body);
    const runtime = currentRuntime();
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    req.raw.once("aborted", abort);
    try {
      return await inferMultimodal(
        {
          localAdapter: options.localMultimodalAdapter,
          hostedAdapter: options.hostedMultimodalAdapter,
          hostedProvider: runtime.hostedProvider,
          hostedCallsEnabled: runtime.hostedCallsEnabled,
          spendBudget: options.spendBudgetFactory?.(runtime) ?? options.spendBudget,
          hostedSpendUnlimited:
            options.hostedSpendUnlimitedResolver?.(runtime) ?? options.hostedSpendUnlimited,
        },
        body,
        nowIso(),
        controller.signal,
      );
    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  return app;
}
