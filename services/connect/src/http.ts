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
import { registerOutboundMcpRoutes } from "./mcp-client/http.js";
import type { McpManager } from "./mcp-client/manager.js";
import type { LocalModelDigest } from "./local-model-identity.js";
import { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";
import {
  DEFAULT_HOSTED_PROVIDER,
  HostedProviderIdSchema,
  type HostedProviderId,
} from "./provider-types.js";
import type {
  ChatTargetPreference,
  RuntimeSettings,
  RuntimeSettingsAdmin,
} from "./runtime-settings.js";
import { MutableLocalModelTagError } from "./runtime-settings.js";
import {
  CostKillSwitchError,
  MissingCredentialError,
  ProviderError,
  SpendBudgetNotConfiguredError,
} from "./providers/errors.js";
import { LocalModelDigestMismatchError } from "./providers/local-model-provenance.js";
import type { LocalRuntimeId } from "./providers/local-runtime.js";
import { SpendBudgetError, SpendBudgetExceededError } from "./spend-budget.js";

export const DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES = 32 * 1024 * 1024;

function toHttpError(err: unknown, detailedProviderHealth = false): unknown {
  if (err instanceof CostKillSwitchError)
    return new HttpError(503, "COST_KILL_SWITCH_ACTIVE", err.message);
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
    maxLatencyMs: z.number().int().min(100).max(120_000).default(15_000),
  })
  .strict();

const CredentialTestParamsSchema = z.object({ provider: HostedProviderIdSchema });
const CredentialTestBodySchema = z.object({ secret: z.string().min(1).max(32_768) }).strict();

export interface BuildConnectServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly credentialVault?: ProviderCredentialReader | undefined;
  readonly credentialVaultAdmin?: CredentialVaultAdmin | undefined;
  readonly runtimeSettings?: RuntimeSettingsAdmin | undefined;
  readonly hostedProvider?: HostedProviderId | undefined;
  /** Development-only fallbacks when no credential vault is configured. */
  readonly anthropicApiKey?: string | undefined;
  readonly openrouterApiKey?: string | undefined;
  readonly openaiApiKey?: string | undefined;
  readonly localRuntime?: LocalRuntimeId | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  readonly localModelDigest?: LocalModelDigest | null | undefined;
  readonly hostedCallsEnabled?: boolean | undefined;
  readonly defaultChatTarget?: ChatTargetPreference | undefined;
  readonly spendBudget?: CompleteDeps["spendBudget"] | undefined;
  readonly hostedSpendUnlimited?: boolean | undefined;
  readonly resolveLocalProvenance?: CompleteDeps["resolveLocalProvenance"] | undefined;
  readonly cache?: ExactMatchCache | undefined;
  readonly mcpManager?: McpManager | undefined;
  readonly localMultimodalAdapter?: MultimodalAdapter | undefined;
  readonly hostedMultimodalAdapter?: MultimodalAdapter | undefined;
  readonly multimodalBodyLimitBytes?: number | undefined;
}

export function buildConnectServer(options: BuildConnectServerOptions): FastifyInstance {
  const app = createServer({
    name: "connect",
    token: options.token,
    logger: options.logger,
    bodyLimit: options.multimodalBodyLimitBytes ?? DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES,
  });
  const metrics = observabilityFor(app);
  const cache = options.cache ?? new ExactMatchCache();
  const defaults: RuntimeSettings = {
    hostedProvider: options.hostedProvider ?? DEFAULT_HOSTED_PROVIDER,
    localRuntime: options.localRuntime ?? "openai-compatible",
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    localModelDigest: options.localModelDigest ?? null,
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
    defaultChatTarget: options.defaultChatTarget ?? "local",
  };
  const currentRuntime = (): RuntimeSettings =>
    options.runtimeSettings?.get().settings ?? defaults;
  const currentDeps = (runtime = currentRuntime()): CompleteDeps => ({
    credentialVault: options.credentialVault,
    hostedProvider: runtime.hostedProvider,
    anthropicApiKey: options.anthropicApiKey,
    openrouterApiKey: options.openrouterApiKey,
    openaiApiKey: options.openaiApiKey,
    localRuntime: runtime.localRuntime,
    localBaseUrl: runtime.localBaseUrl,
    localModelTag: runtime.localModelTag,
    localModelDigest: runtime.localModelDigest,
    cache,
    hostedCallsEnabled: runtime.hostedCallsEnabled,
    spendBudget: options.spendBudget,
    hostedSpendUnlimited: options.hostedSpendUnlimited,
    resolveLocalProvenance: options.resolveLocalProvenance,
  });

  if (options.mcpManager !== undefined) registerOutboundMcpRoutes(app, options.mcpManager);
  registerConnectControlRoutes(app, {
    runtimeSettings: options.runtimeSettings,
    credentialVault: options.credentialVaultAdmin,
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
      const result = await complete(currentDeps(), body, controller.signal);
      recordCompletion(body, result);
      return result;
    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  app.post<{ Params: { provider: string } }>(
    "/v1/settings/credentials/:provider/test",
    async (req) => {
      const { provider } = parseOrBadRequest(CredentialTestParamsSchema, req.params);
      const { secret } = parseOrBadRequest(CredentialTestBodySchema, req.body);
      const runtime = currentRuntime();
      const transientCredential: ProviderCredentialReader = {
        get(candidate, purpose) {
          return candidate === provider && purpose === "messages" ? secret : undefined;
        },
      };
      const body = probeBody("hosted", "Reply exactly ECORIONE_CREDENTIAL_OK");
      const started = performance.now();
      try {
        const result = await complete(
          {
            ...currentDeps({ ...runtime, hostedProvider: provider }),
            credentialVault: transientCredential,
            cache: new ExactMatchCache(),
          },
          body,
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
        metrics.addCounter("ecorione_provider_credential_test_total", 1, {
          provider,
          outcome: "error",
        });
        throw toHttpError(err, true);
      }
    },
  );

  app.post("/v1/ops/provider-canary", async (req) => {
    const body = parseOrBadRequest(ProviderCanaryBodySchema, req.body ?? {});
    const runtime = currentRuntime();
    const started = performance.now();
    const completeBody = probeBody(body.target, body.prompt);
    try {
      const result = await complete(
        { ...currentDeps(runtime), cache: new ExactMatchCache() },
        completeBody,
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
      metrics.addCounter("ecorione_provider_canary_total", 1, {
        provider: body.target === "local" ? "local" : runtime.hostedProvider,
        model: body.target === "local" ? runtime.localModelTag : "configured",
        outcome: "error",
      });
      throw toHttpError(err, true);
    }
  });

  app.post("/v1/multimodal/infer", async (req) => {
    const body = parseOrBadRequest(MultimodalInferRequestSchema, req.body);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    req.raw.once("aborted", abort);
    try {
      return await inferMultimodal(
        {
          localAdapter: options.localMultimodalAdapter,
          hostedAdapter: options.hostedMultimodalAdapter,
          hostedProvider: currentRuntime().hostedProvider,
          hostedCallsEnabled: currentRuntime().hostedCallsEnabled,
          spendBudget: options.spendBudget,
          hostedSpendUnlimited: options.hostedSpendUnlimited,
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
