/**
 * Orkestrasi `POST /v1/complete` — `docs/api-fase1.md` §Connect. Menyatukan routing
 * deterministik, cache exact-match, adapter provider, dan cost ledger (ADR-13) dalam satu
 * jalur, supaya `http.ts` cuma memvalidasi body dan meneruskan.
 */

import { prefixDigest, type StablePrefix } from "@ecorione/context-assembly";
import type { OperationId, Sensitivity, Timestamp } from "@ecorione/shared-schema";
import { recordCall, type CallCostRecord, type TokenUsage } from "@ecorione/shared-telemetry";
import { cacheKey, type ExactMatchCache } from "./cache.js";
import { callAnthropic } from "./providers/anthropic.js";
import { MissingCredentialError } from "./providers/errors.js";
import { callLocal } from "./providers/local.js";
import { route, type RouteTarget } from "./routing.js";

export interface CompleteDeps {
  /** `undefined` kalau `ANTHROPIC_API_KEY` kosong — gerbang di bawah, bukan di caller. */
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
  readonly model: string;
  readonly cacheHit: boolean;
  readonly usage: TokenUsage;
  readonly cost: CallCostRecord;
  readonly routeReason: string;
}

const POLICY_VERSION = "1";

export async function complete(
  deps: CompleteDeps,
  input: CompleteInput,
): Promise<CompleteResult> {
  const overheadStart = performance.now();
  const decision = route({ target: input.target, sensitivity: input.sensitivity });
  const digest = prefixDigest(input.prefix);
  const key = cacheKey({
    model: decision.model,
    prefixDigest: digest,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
  });
  const nowMs = Date.parse(input.now);
  const cached = deps.cache.get(key, nowMs);
  const optimizerOverheadMs = performance.now() - overheadStart;

  let reply: string;
  let usage: TokenUsage;
  let cacheHit: boolean;

  if (cached !== null) {
    reply = cached.reply;
    usage = cached.usage;
    cacheHit = true;
  } else {
    if (decision.routeReason === "local-consolidation") {
      const result = await callLocal({
        baseUrl: deps.localBaseUrl,
        modelTag: deps.localModelTag,
        prefix: input.prefix,
        dynamicText: input.dynamicText,
        userMessage: input.userMessage,
      });
      reply = result.reply;
      usage = result.usage;
    } else {
      if (deps.anthropicApiKey === undefined) {
        throw new MissingCredentialError("ANTHROPIC_API_KEY");
      }
      const result = await callAnthropic({
        apiKey: deps.anthropicApiKey,
        model: decision.model,
        prefix: input.prefix,
        dynamicText: input.dynamicText,
        userMessage: input.userMessage,
      });
      reply = result.reply;
      usage = result.usage;
    }
    deps.cache.set(key, { reply, model: decision.model, usage }, nowMs);
    cacheHit = false;
  }

  const cost = recordCall({
    model: decision.model,
    usage,
    routeReason: decision.routeReason,
    policyVersion: POLICY_VERSION,
    optimizerOverheadMs,
    operationId: input.operationId,
  });

  return {
    reply,
    model: decision.model,
    cacheHit,
    usage,
    cost,
    routeReason: decision.routeReason,
  };
}
