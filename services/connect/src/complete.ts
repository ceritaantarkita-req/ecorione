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
import { callAnthropic } from "./providers/anthropic.js";
import { MissingCredentialError } from "./providers/errors.js";
import { callLocal } from "./providers/local.js";
import { route, type RouteTarget } from "./routing.js";

export interface CompleteDeps {
  readonly anthropicApiKey: string | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  readonly cache: ExactMatchCache;
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
    if (deps.anthropicApiKey === undefined)
      throw new MissingCredentialError("ANTHROPIC_API_KEY");
    const result = await callAnthropic({
      apiKey: deps.anthropicApiKey,
      model: decision.model,
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
  return {
    reply,
    model: decision.model,
    responseModel,
    cacheHit,
    usage,
    cost,
    routeReason: decision.routeReason,
  };
}
