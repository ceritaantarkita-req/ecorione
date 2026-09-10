/**
 * Tabel harga model — `prd.md` §8 (Observability), ADR-13, ADR-14.
 *
 * Konvensi OTel GenAI **tidak punya atribut biaya standar** (`research.md` §2.6), jadi
 * biaya harus dihitung sendiri: token × harga. Tabel ini satu-satunya tempat angka harga
 * hidup; kalau tersebar, angka penghematan jadi tidak bisa diaudit.
 */

/** Semua harga dalam USD per satu juta token. */
export const PRICE_CURRENCY = "USD";
export const TOKENS_PER_PRICE_UNIT = 1_000_000;

export interface ModelPrice {
  /** Input yang **tidak** kena cache. */
  readonly inputPerMTok: number;
  readonly outputPerMTok: number;
  /**
   * Menulis prefix ke cache provider. Tidak semua provider menagih premi tulis. Karena itu
   * angkanya per-model, bukan konstanta global.
   */
  readonly cacheWritePerMTok: number;
  /** Membaca prefix dari cache provider. */
  readonly cacheReadPerMTok: number;
}

/**
 * ⚠️ **Angka di bawah adalah pricing snapshot, bukan otoritas abadi.** Harga provider
 * berubah dan dapat berbeda per mode/region/tier. Verifikasi ke halaman harga provider
 * sebelum public claim atau billing. ADR-14 mewajibkan model identity eksplisit agar
 * perubahan harga/model terlihat di diff.
 */
const PRICE_TABLE = {
  // --- Anthropic / OpenRouter Anthropic mapping ---
  "claude-opus-4-1-20250805": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.5,
  },
  "claude-sonnet-4-5-20250929": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.3,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.1,
  },

  // --- OpenAI GPT-5.6 standard API pricing snapshot, verified 2026-09-09. ---
  // Explicit model IDs only; `gpt-5.6` alias is intentionally not allowed (ADR-14).
  "gpt-5.6-sol": {
    inputPerMTok: 4,
    outputPerMTok: 20,
    cacheWritePerMTok: 5,
    cacheReadPerMTok: 0.4,
  },
  "gpt-5.6-terra": {
    inputPerMTok: 2,
    outputPerMTok: 12,
    cacheWritePerMTok: 2.5,
    cacheReadPerMTok: 0.2,
  },
  "gpt-5.6-luna": {
    inputPerMTok: 0.2,
    outputPerMTok: 1.2,
    cacheWritePerMTok: 0.25,
    cacheReadPerMTok: 0.02,
  },

  // --- Legacy pinned OpenAI identities retained for historical/replay compatibility. ---
  "gpt-4.1-2025-04-14": {
    inputPerMTok: 2,
    outputPerMTok: 8,
    cacheWritePerMTok: 2,
    cacheReadPerMTok: 0.5,
  },
  "gpt-4.1-mini-2025-04-14": {
    inputPerMTok: 0.4,
    outputPerMTok: 1.6,
    cacheWritePerMTok: 0.4,
    cacheReadPerMTok: 0.1,
  },

  // --- DeepSeek historical pricing identity retained for experiments/replay. ---
  "deepseek-v3.2-exp": {
    inputPerMTok: 0.28,
    outputPerMTok: 0.42,
    cacheWritePerMTok: 0.28,
    cacheReadPerMTok: 0.028,
  },

  /**
   * Generic local-runtime pricing identity. Local runtime/model identity is recorded
   * separately; this key only means provider-token billing is zero. It does not claim
   * hardware, electricity or latency are free.
   */
  "local/provider-token-zero": {
    inputPerMTok: 0,
    outputPerMTok: 0,
    cacheWritePerMTok: 0,
    cacheReadPerMTok: 0,
  },

  /** Legacy local pricing identity retained for Historical Ledger/replay compatibility. */
  "local/qwen3-8b-instruct-q4_k_m": {
    inputPerMTok: 0,
    outputPerMTok: 0,
    cacheWritePerMTok: 0,
    cacheReadPerMTok: 0,
  },
} as const satisfies Readonly<Record<string, ModelPrice>>;

for (const entry of Object.values(PRICE_TABLE)) Object.freeze(entry);

export const MODEL_PRICES: Readonly<typeof PRICE_TABLE> = Object.freeze(PRICE_TABLE);

export type PinnedModelId = keyof typeof PRICE_TABLE;

/** Alias provider yang dapat drift diam-diam dilarang. */
export const MODEL_ALIAS_PATTERN = /-latest$|^latest$|:latest$|^gpt-5\.6$/;

export class ModelAliasError extends Error {
  constructor(model: string) {
    super(
      `Alias model dilarang (ADR-14): ${JSON.stringify(model)}. ` +
        `Gunakan model identity eksplisit yang ada di pricing snapshot.`,
    );
    this.name = "ModelAliasError";
  }
}

export class UnknownModelError extends Error {
  constructor(model: string) {
    super(
      `Model tidak ada di tabel harga: ${JSON.stringify(model)}. ` +
        `Tambahkan pricing snapshot sebelum memakainya — panggilan tanpa harga membuat ledger biaya kurang catat.`,
    );
    this.name = "UnknownModelError";
  }
}

export function isPinnedModel(model: string): model is PinnedModelId {
  return !MODEL_ALIAS_PATTERN.test(model) && Object.hasOwn(MODEL_PRICES, model);
}

export function assertPinnedModel(model: string): PinnedModelId {
  if (MODEL_ALIAS_PATTERN.test(model)) throw new ModelAliasError(model);
  if (!Object.hasOwn(MODEL_PRICES, model)) throw new UnknownModelError(model);
  return model as PinnedModelId;
}

export function priceFor(model: string): ModelPrice {
  return MODEL_PRICES[assertPinnedModel(model)];
}

export function pinnedModelIds(): readonly PinnedModelId[] {
  return Object.keys(MODEL_PRICES) as PinnedModelId[];
}
