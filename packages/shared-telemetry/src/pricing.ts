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
   * Menulis prefix ke cache provider. Tidak semua provider menagih premi tulis —
   * Anthropic 1,25× harga input, DeepSeek & OpenAI tidak menagih sama sekali. Karena itu
   * angkanya per-model, bukan konstanta global 1,25×.
   */
  readonly cacheWritePerMTok: number;
  /** Membaca prefix dari cache provider. Ini yang membuat ADR-01 bernilai uang. */
  readonly cacheReadPerMTok: number;
}

/**
 * ⚠️ **Angka di bawah adalah tabel awal, bukan otoritas.** Harga provider berubah tanpa
 * pengumuman dan berbeda per region/tier. **Verifikasi ke halaman harga provider sebelum
 * dipakai untuk menagih atau untuk mengklaim penghematan ke pengguna.** Selisih di sini
 * langsung menjadi selisih di angka `savedUsd` yang kita tampilkan.
 *
 * ID sengaja ditulis lengkap dengan tanggal (ADR-14) — lihat `assertPinnedModel`.
 */
const PRICE_TABLE = {
  // --- Anthropic (premi tulis 1,25×, baca 0,1× — dasar aritmetika break-even) ---
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

  // --- OpenAI (tanpa premi tulis: cache miss = harga input penuh) ---
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

  // --- DeepSeek (cache otomatis, tanpa premi tulis) ---
  "deepseek-v3.2-exp": {
    inputPerMTok: 0.28,
    outputPerMTok: 0.42,
    cacheWritePerMTok: 0.28,
    cacheReadPerMTok: 0.028,
  },

  /**
   * Model lokal. Nol di sini berarti **biaya marjinal per token yang ditagihkan** nol —
   * bukan berarti gratis: listrik, RAM, dan latensi tetap ada, hanya saja tidak masuk
   * ledger USD. Menyamakan keduanya adalah cara termudah membuat angka penghematan bohong.
   */
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

/**
 * Alias yang dilarang (ADR-14). Alasannya bukan kerapian: kalau provider menukar model di
 * balik `-latest`, tidak ada error, tidak ada log, tidak ada perubahan versi — perubahannya
 * baru muncul sebagai regresi kualitas berminggu-minggu kemudian, dan eval lama jadi tidak
 * bisa dibandingkan karena baseline-nya bergeser diam-diam.
 */
export const MODEL_ALIAS_PATTERN = /-latest$|^latest$|:latest$/;

export class ModelAliasError extends Error {
  constructor(model: string) {
    super(
      `Alias model dilarang (ADR-14): ${JSON.stringify(model)}. ` +
        `Pin versi eksplisit, mis. "claude-sonnet-4-5-20250929".`,
    );
    this.name = "ModelAliasError";
  }
}

export class UnknownModelError extends Error {
  constructor(model: string) {
    super(
      `Model tidak ada di tabel harga: ${JSON.stringify(model)}. ` +
        `Tambahkan entri di packages/shared-telemetry/src/pricing.ts sebelum memakainya — ` +
        `panggilan tanpa harga membuat ledger biaya diam-diam kurang catat.`,
    );
    this.name = "UnknownModelError";
  }
}

export function isPinnedModel(model: string): model is PinnedModelId {
  return !MODEL_ALIAS_PATTERN.test(model) && Object.hasOwn(MODEL_PRICES, model);
}

/** Gerbang tunggal untuk setiap ID model yang masuk ke jalur biaya. */
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
