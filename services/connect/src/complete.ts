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
import { callAnthropic, estimateAnthropicReservationUsd } from "./providers/anthropic.js";
import { CostKillSwitchError, MissingCredentialError } from "./providers/errors.js";
import { callLocal } from "./providers/local.js";
import { route, type RouteTarget } from "./routing.js";
import type { FileSpendBudget, SpendEntry } from "./spend-budget.js";

type SpendBudgetController = Pick<FileSpendBudget, "reserve" | "settle" | "markUncertain">;

export interface CompleteDeps {
  /** Production source. If configured, env fallback is intentionally ignored. */
  readonly credentialVault?: ProviderCredentialReader | undefined;
  /** Development-only compatibility fallback when no vault is configured. */
  readonly anthropicApiKey: string | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  readonly cache: ExactMatchCache;
  /** Emergency operator control. Defaults true at HTTP construction boundary. */
  readonly hostedCallsEnabled: boolean;
  /** Optional durable cumulative budget. If absent, hosted budget admission is disabled. */
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
const POLICY_VERSION = "2";

export async function complete(
  deps: CompleteDeps,
  input: CompleteInput,
): Promise<CompleteResult> {
  // Connect enforces the invariant itself; callers cannot bypass Hub/context-assembly.
  assertPrefixCacheable(input.prefix);
  const overheadStart = performance.now();
  const decision = route({ target: input.target, sensitivity: input.sensitivity });

  // Fase 6 cost kill switch lives at the provider boundary so Hub, Flow, MCP, or any
  // future caller cannot bypass it. No silent reroute to local is allowed.
  if (decision.routeReason !== "local-consolidation" && !deps.hostedCallsEnabled) {
    throw new CostKillSwitchError();
  }

  const key = cacheKey({
    model: decision.model,
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

  if (cached !== null) {
    reply = cached.reply;
    responseModel = cached.model;
    // Internal exact-cache hit performs no provider call: actual tokens/cost are zero.
    usage = tokenUsage();
    baselineUsage = cached.usage;
    cacheHit = true;
  } else if (decision.routeReason === "local-consolidation") {
    const result = await callLocal({
      baseUrl: deps.localBaseUrl,
      modelTag: deps.localModelTag,
      prefix: input.prefix,
      dynamicText: input.dynamicText,
      userMessage: input.userMessage,
    });
    reply = result.reply;
    responseModel = result.model;
    usage = result.usage;
    baselineUsage = usage;
    deps.cache.set(key, { reply, model: responseModel, usage }, nowMs);
    cacheHit = false;
  } else {
    const apiKey =
      deps.credentialVault === undefined
        ? deps.anthropicApiKey
        : deps.credentialVault.get("anthropic", "messages");
    if (apiKey === undefined) {
      throw new MissingCredentialError(
        deps.credentialVault === undefined
          ? "ANTHROPIC_API_KEY (dev fallback)"
          : "Connect vault anthropic/messages",
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
        provider: "anthropic",
        model: decision.model,
        reservedUsd: estimateAnthropicReservationUsd(providerInput),
        now: input.now,
      });
    }

    try {
      const result = await callAnthropic({ apiKey, ...providerInput });
      reply = result.reply;
      responseModel = result.model;
      usage = result.usage;
      baselineUsage = usage;
      deps.cache.set(key, { reply, model: responseModel, usage }, nowMs);
      cacheHit = false;
    } catch (error) {
      if (spendReservation !== undefined && deps.spendBudget !== undefined) {
        try {
          deps.spendBudget.markUncertain(spendReservation.reservationId);
        } catch {
          // Reservation itself was durably committed before dispatch. If uncertain marking
          // fails, retaining it as `reserved` is still conservative and must not hide the
          // original provider failure.
        }
      }
      throw error;
    }
  }

  const cost = recordCall({
    model: decision.model,
    usage,
    baselineUsage,
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
      // Provider success must not become retryable solely because post-provider budget
      // finalization failed. The durable pre-dispatch reservation remains counted.
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
    model: decision.model,
    responseModel,
    cacheHit,
    usage,
    cost,
    routeReason: decision.routeReason,
    ...(budget === undefined ? {} : { budget }),
  };
}
