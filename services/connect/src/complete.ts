/** Connect completion pipeline: routing, bounded exact cache, provider, honest cost. */
import {
  assertPrefixCacheable,
  prefixDigest,
  type StablePrefix,
} from "@ecorione/context-assembly";
import type { OperationId, Sensitivity, Timestamp } from "@ecorione/shared-schema";
import {
  recordCall,
  tokenUsage,
  type CallCostRecord,
  type TokenUsage,
} from "@ecorione/shared-telemetry";
import { cacheKey, type ExactMatchCache } from "./cache.js";
import type { ProviderCredentialReader } from "./credential-vault.js";
import {
  DEFAULT_HOSTED_PROVIDER,
  providerCredentialLabel,
  type HostedProviderId,
} from "./provider-types.js";
import { CostKillSwitchError, MissingCredentialError } from "./providers/errors.js";
import { callHostedProvider, estimateHostedReservationUsd } from "./providers/hosted.js";
import { callLocalRuntime, type LocalRuntimeId } from "./providers/local-runtime.js";
import { route, type RouteTarget } from "./routing.js";
import type { FileSpendBudget, SpendEntry } from "./spend-budget.js";

type SpendBudgetController = Pick<FileSpendBudget, "reserve" | "settle" | "markUncertain">;

export interface CompleteDeps {
  /** Production source. If configured, all raw provider env fallbacks are ignored. */
  readonly credentialVault?: ProviderCredentialReader | undefined;
  /** Hosted provider is process configuration, never chosen by model output. */
  readonly hostedProvider?: HostedProviderId | undefined;
  /** Development-only compatibility fallbacks when no vault is configured. */
  readonly anthropicApiKey: string | undefined;
  readonly openrouterApiKey?: string | undefined;
  readonly openaiApiKey?: string | undefined;
  /** Local inference is protocol-based; Ollama is only one possible implementation. */
  readonly localRuntime?: LocalRuntimeId | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  readonly cache: ExactMatchCache;
  readonly hostedCallsEnabled: boolean;
  readonly spendBudget?: SpendBudgetController | undefined;
}
export interface CompleteInput {
  readonly target: RouteTarget;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
  readonly sensitivity: Sensitivity;
  readonly operationId: OperationId;
  readonly now: Timestamp;
}
export interface CompleteBudgetResult {
  readonly reservationId: string;
  readonly reservedUsd: number;
  readonly actualUsd: number;
  readonly overrunUsd: number;
  readonly settlement: "settled" | "reservation-retained";
}
export interface CompleteResult {
  readonly reply: string;
  readonly provider: HostedProviderId | "local";
  /** Pinned cost/routing identity. */
  readonly model: string;
  /** Runtime identity reported by provider/runtime. */
  readonly responseModel: string;
  readonly cacheHit: boolean;
  readonly usage: TokenUsage;
  readonly cost: CallCostRecord;
  readonly routeReason: string;
  readonly budget?: CompleteBudgetResult | undefined;
}
const POLICY_VERSION = "3";

function developmentApiKey(deps: CompleteDeps, provider: HostedProviderId): string | undefined {
  switch (provider) {
    case "anthropic":
      return deps.anthropicApiKey;
    case "openrouter":
      return deps.openrouterApiKey;
    case "openai":
      return deps.openaiApiKey;
  }
}

export async function complete(
  deps: CompleteDeps,
  input: CompleteInput,
  signal?: AbortSignal,
): Promise<CompleteResult> {
  assertPrefixCacheable(input.prefix);
  const overheadStart = performance.now();
  const hostedProvider = deps.hostedProvider ?? DEFAULT_HOSTED_PROVIDER;
  const decision = route({
    target: input.target,
    sensitivity: input.sensitivity,
    hostedProvider,
  });

  if (decision.routeReason !== "local-consolidation" && !deps.hostedCallsEnabled) {
    throw new CostKillSwitchError();
  }

  const providerIdentity =
    decision.routeReason === "local-consolidation" ? "local" : hostedProvider;
  const key = cacheKey({
    model: `${providerIdentity}:${decision.model}`,
    prefixDigest: prefixDigest(input.prefix),
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
  });
  const nowMs = Date.parse(input.now);
  const cached = deps.cache.get(key, nowMs);
  const optimizerOverheadMs = performance.now() - overheadStart;

  let reply: string;
  let responseModel: string;
  let usage: TokenUsage;
  let baselineUsage: TokenUsage;
  let cacheHit: boolean;
  let spendReservation: SpendEntry | undefined;
  let providerReportedActualUsd: number | undefined;

  if (cached !== null) {
    reply = cached.reply;
    responseModel = cached.model;
    usage = tokenUsage();
    baselineUsage = cached.usage;
    cacheHit = true;
  } else if (decision.routeReason === "local-consolidation") {
    const result = await callLocalRuntime(
      {
        runtime: deps.localRuntime ?? "openai-compatible",
        baseUrl: deps.localBaseUrl,
        modelTag: deps.localModelTag,
        prefix: input.prefix,
        dynamicText: input.dynamicText,
        userMessage: input.userMessage,
      },
      signal,
    );
    reply = result.reply;
    responseModel = result.model;
    usage = result.usage;
    baselineUsage = usage;
    deps.cache.set(key, { reply, model: responseModel, usage }, nowMs);
    cacheHit = false;
  } else {
    const apiKey =
      deps.credentialVault === undefined
        ? developmentApiKey(deps, hostedProvider)
        : deps.credentialVault.get(hostedProvider, "messages");
    if (apiKey === undefined) {
      const label = providerCredentialLabel(hostedProvider);
      throw new MissingCredentialError(
        deps.credentialVault === undefined
          ? `${label} (dev fallback)`
          : `Connect vault ${hostedProvider}/messages`,
      );
    }

    const providerInput = {
      model: decision.model,
      prefix: input.prefix,
      dynamicText: input.dynamicText,
      userMessage: input.userMessage,
    };
    if (deps.spendBudget !== undefined) {
      spendReservation = deps.spendBudget.reserve({
        operationId: input.operationId,
        provider: hostedProvider,
        model: decision.model,
        reservedUsd: estimateHostedReservationUsd(hostedProvider, providerInput),
        now: input.now,
      });
    }

    try {
      const result = await callHostedProvider(
        {
          provider: hostedProvider,
          apiKey,
          ...providerInput,
        },
        signal,
      );
      reply = result.reply;
      responseModel = result.model;
      usage = result.usage;
      baselineUsage = usage;
      providerReportedActualUsd = result.providerReportedActualUsd;
      deps.cache.set(key, { reply, model: responseModel, usage }, nowMs);
      cacheHit = false;
    } catch (error) {
      if (spendReservation !== undefined && deps.spendBudget !== undefined) {
        try {
          deps.spendBudget.markUncertain(spendReservation.reservationId);
        } catch {
          // Pre-dispatch reservation is already durable. Retaining `reserved` remains
          // conservative and must not hide the original provider failure.
        }
      }
      throw error;
    }
  }

  const cost = recordCall({
    model: decision.model,
    usage,
    baselineUsage,
    ...(providerReportedActualUsd === undefined
      ? {}
      : { actualUsdOverride: providerReportedActualUsd }),
    routeReason: decision.routeReason,
    policyVersion: POLICY_VERSION,
    optimizerOverheadMs,
    operationId: input.operationId,
  });

  let budget: CompleteBudgetResult | undefined;
  if (spendReservation !== undefined && deps.spendBudget !== undefined) {
    let settlement: CompleteBudgetResult["settlement"] = "settled";
    try {
      deps.spendBudget.settle(spendReservation.reservationId, cost.actualUsd, input.now);
    } catch {
      settlement = "reservation-retained";
    }
    budget = {
      reservationId: spendReservation.reservationId,
      reservedUsd: spendReservation.reservedUsd,
      actualUsd: cost.actualUsd,
      overrunUsd: Math.max(0, cost.actualUsd - spendReservation.reservedUsd),
      settlement,
    };
  }

  return {
    reply,
    provider: providerIdentity,
    model: decision.model,
    responseModel,
    cacheHit,
    usage,
    cost,
    routeReason: decision.routeReason,
    ...(budget === undefined ? {} : { budget }),
  };
}
