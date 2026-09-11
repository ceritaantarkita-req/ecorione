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
import { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";
import { DEFAULT_HOSTED_PROVIDER, type HostedProviderId } from "./provider-types.js";
import type { RuntimeSettings, RuntimeSettingsAdmin } from "./runtime-settings.js";
import {
  CostKillSwitchError,
  MissingCredentialError,
  ProviderError,
} from "./providers/errors.js";
import type { LocalRuntimeId } from "./providers/local-runtime.js";
import { SpendBudgetError, SpendBudgetExceededError } from "./spend-budget.js";

export const DEFAULT_MULTIMODAL_BODY_LIMIT_BYTES = 32 * 1024 * 1024;

function toHttpError(err: unknown): unknown {
  if (err instanceof CostKillSwitchError)
    return new HttpError(503, "COST_KILL_SWITCH_ACTIVE", err.message);
  if (err instanceof CredentialVaultError)
    return new HttpError(503, "CREDENTIAL_VAULT_UNAVAILABLE", err.message);
  if (err instanceof SpendBudgetExceededError)
    return new HttpError(429, "SPEND_BUDGET_EXCEEDED", err.message);
  if (err instanceof SpendBudgetError)
    return new HttpError(503, "SPEND_BUDGET_UNAVAILABLE", err.message);
  if (err instanceof MissingCredentialError) return new BadGatewayError(err.message);
  if (err instanceof ProviderError) return new BadGatewayError(err.message);
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
  readonly hostedCallsEnabled?: boolean | undefined;
  readonly spendBudget?: CompleteDeps["spendBudget"] | undefined;
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
    hostedCallsEnabled: options.hostedCallsEnabled ?? true,
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
    cache,
    hostedCallsEnabled: runtime.hostedCallsEnabled,
    spendBudget: options.spendBudget,
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

  app.post("/v1/ops/provider-canary", async (req) => {
    const body = parseOrBadRequest(ProviderCanaryBodySchema, req.body ?? {});
    const runtime = currentRuntime();
    const started = performance.now();
    const completeBody = CompleteBodySchema.parse({
      target: body.target,
      prefix: {
        systemPrompt:
          "You are a deterministic provider health canary. Follow the user instruction exactly.",
        toolDefinitions: [],
        coreMemory: { blocks: [] },
      },
      dynamicText: "",
      userMessage: body.prompt,
      sensitivity: "PUBLIC",
      operationId: makeId("operation"),
      now: nowIso(),
    });
    try {
      const result = await complete(currentDeps(runtime), completeBody);
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
      throw toHttpError(err);
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
