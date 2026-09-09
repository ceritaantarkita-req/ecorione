/** Counterfactual cost accounting — ADR-13. */
import { z } from "zod";
import type { OperationId, PolicyRule } from "@ecorione/shared-schema";
import { priceFor, TOKENS_PER_PRICE_UNIT } from "./pricing.js";

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
});
const NonNegativeUsdSchema = z.number().finite().nonnegative();
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export function tokenUsage(partial: Partial<TokenUsage> = {}): TokenUsage {
  return TokenUsageSchema.parse({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...partial,
  });
}
export const DEFAULT_NAIVE_MODEL = "claude-sonnet-4-5-20250929";
export function computeCost(model: string, usage: TokenUsage): number {
  const p = priceFor(model);
  const u = TokenUsageSchema.parse(usage);
  return (
    (u.inputTokens * p.inputPerMTok +
      u.cacheWriteTokens * p.cacheWritePerMTok +
      u.cacheReadTokens * p.cacheReadPerMTok +
      u.outputTokens * p.outputPerMTok) /
    TOKENS_PER_PRICE_UNIT
  );
}
export function computeNaiveCost(naiveModel: string, usage: TokenUsage): number {
  const p = priceFor(naiveModel);
  const u = TokenUsageSchema.parse(usage);
  const promptTokens = u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens;
  return (
    (promptTokens * p.inputPerMTok + u.outputTokens * p.outputPerMTok) / TOKENS_PER_PRICE_UNIT
  );
}

export interface CallCostRecord {
  readonly model: string;
  readonly naiveModel: string;
  /** Actual provider usage for this call. Internal exact-cache hits are zero. */
  readonly usage: TokenUsage;
  /** Tokens the request would have consumed under the naive no-cache baseline. */
  readonly baselineUsage: TokenUsage;
  readonly actualUsd: number;
  readonly naiveUsd: number;
  readonly savedUsd: number;
  readonly savedPct: number;
  readonly routeReason: PolicyRule["id"];
  readonly policyVersion: PolicyRule["version"];
  readonly optimizerOverheadMs: number;
  readonly escalatedFrom?: string;
  readonly operationId?: OperationId;
}
export interface CallCostInput {
  readonly model: string;
  readonly usage: TokenUsage;
  readonly baselineUsage?: TokenUsage;
  /** Provider-reported billed cost wins when the provider exposes an authoritative value. */
  readonly actualUsdOverride?: number;
  readonly routeReason: PolicyRule["id"];
  readonly policyVersion: PolicyRule["version"];
  readonly optimizerOverheadMs: number;
  readonly naiveModel?: string;
  readonly escalatedFrom?: string;
  readonly operationId?: OperationId;
}
type MutableCallCostRecord = { -readonly [K in keyof CallCostRecord]: CallCostRecord[K] };
export function recordCall(input: CallCostInput): CallCostRecord {
  const naiveModel = input.naiveModel ?? DEFAULT_NAIVE_MODEL;
  const usage = TokenUsageSchema.parse(input.usage);
  const baselineUsage = TokenUsageSchema.parse(input.baselineUsage ?? usage);
  const actualUsd =
    input.actualUsdOverride === undefined
      ? computeCost(input.model, usage)
      : NonNegativeUsdSchema.parse(input.actualUsdOverride);
  const naiveUsd = computeNaiveCost(naiveModel, baselineUsage);
  const savedUsd = naiveUsd - actualUsd;
  const record: MutableCallCostRecord = {
    model: input.model,
    naiveModel,
    usage,
    baselineUsage,
    actualUsd,
    naiveUsd,
    savedUsd,
    savedPct: savedPercent(savedUsd, naiveUsd),
    routeReason: input.routeReason,
    policyVersion: input.policyVersion,
    optimizerOverheadMs: input.optimizerOverheadMs,
  };
  if (input.escalatedFrom !== undefined) record.escalatedFrom = input.escalatedFrom;
  if (input.operationId !== undefined) record.operationId = input.operationId;
  return record;
}
function savedPercent(savedUsd: number, naiveUsd: number): number {
  return naiveUsd === 0 ? 0 : (savedUsd / naiveUsd) * 100;
}

export interface SavingsSummary {
  readonly actualUsd: number;
  readonly naiveUsd: number;
  readonly savedUsd: number;
  readonly savedPct: number;
  readonly callCount: number;
  readonly escalatedCallCount: number;
}
export type CostLedgerSink = (record: CallCostRecord) => void;
export class CostLedger {
  readonly #records: CallCostRecord[] = [];
  readonly #sink: CostLedgerSink | undefined;
  constructor(sink?: CostLedgerSink) {
    this.#sink = sink;
  }
  record(entry: CallCostRecord): CallCostRecord {
    this.#records.push(entry);
    this.#sink?.(entry);
    return entry;
  }
  entries(): readonly CallCostRecord[] {
    return this.#records;
  }
  total(): number {
    return this.#records.reduce((sum, r) => sum + r.actualUsd, 0);
  }
  savingsSummary(): SavingsSummary {
    let actualUsd = 0;
    let naiveUsd = 0;
    let escalatedCallCount = 0;
    for (const r of this.#records) {
      actualUsd += r.actualUsd;
      naiveUsd += r.naiveUsd;
      if (r.escalatedFrom !== undefined) escalatedCallCount += 1;
    }
    const savedUsd = naiveUsd - actualUsd;
    return {
      actualUsd,
      naiveUsd,
      savedUsd,
      savedPct: savedPercent(savedUsd, naiveUsd),
      callCount: this.#records.length,
      escalatedCallCount,
    };
  }
}
