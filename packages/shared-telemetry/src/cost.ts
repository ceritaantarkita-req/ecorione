/**
 * Akuntansi biaya kontrafaktual — ADR-13, `research.md` §2.6.
 *
 * Klaim "gue mengoptimalkan" cuma berarti kalau ada **baseline tandingan**. Jadi tiap
 * panggilan model dicatat dua kali: biaya aktual, dan biaya request yang sama di bawah
 * kebijakan naif (tanpa cache, model kuat default). **Selisihnya satu-satunya angka
 * penghematan yang jujur** — sisanya adalah pemasaran.
 */

import { z } from "zod";
import type { OperationId, PolicyRule } from "@ecorione/shared-schema";
import { priceFor, TOKENS_PER_PRICE_UNIT } from "./pricing.js";

/**
 * `inputTokens` berarti **input yang tidak kena cache saja**, bukan total prompt.
 *
 * Ini gotcha yang paling mahal di paket ini karena tidak pernah gagal keras: provider
 * melaporkannya berbeda-beda. Anthropic sudah memisahkan (`input_tokens` eksklusif
 * `cache_read_input_tokens`), sedangkan OpenAI melaporkan `prompt_tokens` yang **sudah
 * termasuk** `cached_tokens`. Kalau adapter lupa mengurangi, token ter-cache tertagih dua
 * kali di biaya aktual — biaya aktual naik, penghematan terlihat lebih kecil; dan kalau
 * salah ke arah sebaliknya (cache dihitung nol di aktual tapi penuh di naif),
 * penghematannya menggelembung tanpa satu pun test merah. Adapter provider yang wajib
 * menormalkan, bukan fungsi di bawah.
 */
export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
});
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

/**
 * Baseline kontrafaktual default: model yang **masuk akal dipilih pengguna tanpa
 * optimizer**, bukan model termahal yang ada. Memilih Opus sebagai baseline akan menaikkan
 * angka penghematan tanpa satu byte pun benar-benar dihemat.
 */
export const DEFAULT_NAIVE_MODEL = "claude-sonnet-4-5-20250929";

/** Biaya aktual USD: sisa input, tulis cache, baca cache, dan output ditagih terpisah. */
export function computeCost(model: string, usage: TokenUsage): number {
  const price = priceFor(model);
  const u = TokenUsageSchema.parse(usage);
  const total =
    u.inputTokens * price.inputPerMTok +
    u.cacheWriteTokens * price.cacheWritePerMTok +
    u.cacheReadTokens * price.cacheReadPerMTok +
    u.outputTokens * price.outputPerMTok;
  return total / TOKENS_PER_PRICE_UNIT;
}

/**
 * Biaya kebijakan naif: **tanpa caching sama sekali** pada model default. Seluruh token
 * prompt — termasuk yang aslinya terbaca/tertulis dari cache — ditagih di harga input
 * penuh, karena tanpa prefix stabil (ADR-01) token itu memang akan dikirim ulang utuh.
 */
export function computeNaiveCost(naiveModel: string, usage: TokenUsage): number {
  const price = priceFor(naiveModel);
  const u = TokenUsageSchema.parse(usage);
  const promptTokens = u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens;
  const total = promptTokens * price.inputPerMTok + u.outputTokens * price.outputPerMTok;
  return total / TOKENS_PER_PRICE_UNIT;
}

export interface CallCostRecord {
  readonly model: string;
  readonly naiveModel: string;
  readonly usage: TokenUsage;
  readonly actualUsd: number;
  readonly naiveUsd: number;
  /** `naiveUsd - actualUsd`. **Boleh negatif** — lihat `savedPct`. */
  readonly savedUsd: number;
  /**
   * Persen 0..100 (bukan pecahan 0..1), dan **tidak pernah di-clamp ke ≥0**. Panggilan
   * yang naik ke model lebih mahal menghasilkan angka negatif, dan itu memang harus
   * terlihat: meng-clamp adalah cara paling halus membuat ledger berbohong.
   */
  readonly savedPct: number;
  /** Aturan kebijakan mana yang menyala — `PolicyRule.id` di Hub. */
  readonly routeReason: PolicyRule["id"];
  readonly policyVersion: PolicyRule["version"];
  /**
   * Latensi keputusan routing. Dicatat sebagai field sendiri karena overhead optimizer
   * harus **dibebankan ke optimizer**, bukan disembunyikan di dalam latensi model
   * (`research.md` §2.6).
   */
  readonly optimizerOverheadMs: number;
  /**
   * Diisi kalau panggilan ini adalah retry yang naik dari model lebih lemah. Biaya
   * percobaan pertama tetap tercatat sebagai entri tersendiri di ledger.
   */
  readonly escalatedFrom?: string;
  /** Kunci join ke audit log Hub (event `MODEL_CALLED`, PRD §22). */
  readonly operationId?: OperationId;
}

export interface CallCostInput {
  readonly model: string;
  readonly usage: TokenUsage;
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
  const actualUsd = computeCost(input.model, usage);
  const naiveUsd = computeNaiveCost(naiveModel, usage);
  const savedUsd = naiveUsd - actualUsd;

  const record: MutableCallCostRecord = {
    model: input.model,
    naiveModel,
    usage,
    actualUsd,
    naiveUsd,
    savedUsd,
    savedPct: savedPercent(savedUsd, naiveUsd),
    routeReason: input.routeReason,
    policyVersion: input.policyVersion,
    optimizerOverheadMs: input.optimizerOverheadMs,
  };

  // Field opsional hanya dipasang kalau ada isinya — `exactOptionalPropertyTypes` menyala,
  // dan konsumen membedakan "tidak ada eskalasi" dari "ada key bernilai undefined".
  if (input.escalatedFrom !== undefined) record.escalatedFrom = input.escalatedFrom;
  if (input.operationId !== undefined) record.operationId = input.operationId;

  return record;
}

/** Baseline nol (mis. usage kosong) → 0%, bukan NaN/Infinity yang merusak agregat. */
function savedPercent(savedUsd: number, naiveUsd: number): number {
  if (naiveUsd === 0) return 0;
  return (savedUsd / naiveUsd) * 100;
}

export interface SavingsSummary {
  readonly actualUsd: number;
  readonly naiveUsd: number;
  readonly savedUsd: number;
  /** Persen 0..100, bisa negatif. */
  readonly savedPct: number;
  readonly callCount: number;
  /** Berapa dari `callCount` yang merupakan retry hasil eskalasi. */
  readonly escalatedCallCount: number;
}

export type CostLedgerSink = (record: CallCostRecord) => void;

/**
 * Ledger in-memory. Persistensi diserahkan ke service lewat `sink` supaya paket ini tetap
 * bebas I/O dan bisa dites tanpa database.
 */
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

  /** Total biaya **aktual** USD. */
  total(): number {
    let sum = 0;
    for (const r of this.#records) sum += r.actualUsd;
    return sum;
  }

  /**
   * Agregat penghematan jujur.
   *
   * **Biaya eskalasi ikut terhitung**: kalau sebuah panggilan gagal di model murah lalu
   * di-retry di model yang lebih kuat, kedua percobaan masuk sebagai entri terpisah dan
   * keduanya menambah `actualUsd`. Tanpa itu, "hemat" cuma berarti "gagal lebih murah".
   * Baseline naif tetap satu panggilan per entri, jadi rangkaian retry memang menurunkan
   * — bahkan bisa membuat negatif — persentase penghematannya. Itu perilaku yang benar.
   */
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
