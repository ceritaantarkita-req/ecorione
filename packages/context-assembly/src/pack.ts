/**
 * Perakitan context pack — `prd.md` §12.1, `research.md` §3.2.2, ADR-01.
 *
 * Urutan perakitan tetap, batas tetap:
 *   1. Blok inti L2 (selalu, ~1.5k token) — bagian dari prefix stabil
 *   2. Recall L1 terkondisi query, **k kecil**, di belakang cache breakpoint
 *   3. Ringkasan episodik thread berjalan
 *   4. Pointer artifact L3 (path + deskripsi satu baris) — **tidak pernah isinya**
 *
 * k sengaja kecil (5–10). Studi Context Rot (18 model): satu distraktor saja sudah
 * menurunkan akurasi secara terukur. Konteks lebih banyak bukan konteks lebih baik —
 * memangkas di sini adalah keputusan kualitas yang kebetulan juga menghemat biaya.
 */

import {
  CORE_MEMORY_TOKEN_LIMIT,
  DEFAULT_RETRIEVAL_K,
  MAX_RETRIEVAL_K,
  type ArtifactPointer,
  type EpisodeId,
  type MemoryFactId,
  type Provenance,
  type RetrievalHit,
  type Timestamp,
} from "@ecorione/shared-schema";
import { assertPrefixCacheable, prefixDigest, type StablePrefix } from "./prefix.js";

// ---------------------------------------------------------------------------
// Estimasi token
// ---------------------------------------------------------------------------

/**
 * Perkiraan kasar ~4 karakter/token, sama seperti `CORE_MEMORY_CHAR_LIMIT` di
 * `shared-schema`. **Ini gerbang, bukan penagihan.** Angka biaya yang jujur datang dari
 * `usage` yang dikembalikan provider dan dicatat di cost ledger (ADR-13) — bukan dari sini.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Ongkos tetap amplop "ini data, bukan instruksi" + label seksi di `render.ts`. Dicadangkan
 * di depan supaya anggaran yang dihitung di sini tidak lebih optimistis dari teks yang
 * benar-benar dirender.
 */
export const ENVELOPE_TOKEN_OVERHEAD = 96;

// ---------------------------------------------------------------------------
// Bahan
// ---------------------------------------------------------------------------

/**
 * Ringkasan episodik untuk thread berjalan. L0 mentah tidak pernah masuk konteks —
 * yang masuk hanya ringkasannya (`prd.md` §12.1).
 */
export interface EpisodicSummary {
  readonly id: EpisodeId;
  readonly ts: Timestamp;
  readonly text: string;
  readonly provenance: Provenance;
}

export interface ContextPackInput {
  readonly prefix: StablePrefix;
  /** Hasil retrieval mentah — belum dipotong k, belum dipotong anggaran. */
  readonly candidateFacts: readonly RetrievalHit[];
  readonly episodicSummaries: readonly EpisodicSummary[];
  readonly artifactPointers: readonly ArtifactPointer[];
}

/** Plafon per tier, sebagai pecahan anggaran dinamis. */
export interface TierShares {
  readonly recall: number;
  readonly episodic: number;
  readonly pointers: number;
}

/**
 * Plafon, **bukan jatah yang dipesan**: sisa anggaran tier sebelumnya mengalir ke tier
 * berikutnya. Yang dicegah plafon ini adalah recall memakan seluruh jendela dan menyisakan
 * nol untuk kontinuitas thread.
 */
export const DEFAULT_TIER_SHARES: TierShares = {
  recall: 0.5,
  episodic: 0.35,
  pointers: 0.15,
};

export interface AssembleOptions {
  readonly tokenBudget: number;
  /** Default `DEFAULT_RETRIEVAL_K` (8). Di atas `MAX_RETRIEVAL_K` ditolak. */
  readonly k?: number;
  /**
   * Jam disuntikkan, **tidak pernah `Date.now()`** (ADR-01; ESLint memblokirnya di jalur
   * perakitan). Selain membuat perakitan bisa diuji, ini yang menjamin dua panggilan dalam
   * satu giliran memakai waktu yang sama persis.
   */
  readonly now: Timestamp;
  readonly tierShares?: TierShares;
  /** Default `true`: menolak prefix yang mengandung nilai volatil sebelum dikirim. */
  readonly assertCacheablePrefix?: boolean;
}

// ---------------------------------------------------------------------------
// Hasil
// ---------------------------------------------------------------------------

export interface ContextPackStable {
  readonly prefix: StablePrefix;
  /** Digest prefix — dipakai Connect untuk memverifikasi cache hit antar panggilan. */
  readonly digest: string;
}

export interface ContextPackDynamic {
  readonly recalledFacts: readonly RetrievalHit[];
  readonly episodicSummaries: readonly EpisodicSummary[];
  readonly artifactPointers: readonly ArtifactPointer[];
  /** Waktu perakitan. Sengaja di sisi dinamis — di prefix ia akan membunuh cache. */
  readonly assembledAt: Timestamp;
}

export interface TierUsage {
  readonly core: number;
  readonly systemPrompt: number;
  readonly toolDefinitions: number;
  readonly recall: number;
  readonly episodic: number;
  readonly pointers: number;
  readonly envelope: number;
}

export interface ContextBudgetReport {
  readonly tokenBudget: number;
  readonly usedTokens: number;
  readonly perTier: TierUsage;
  readonly droppedFactIds: readonly MemoryFactId[];
  readonly droppedEpisodeIds: readonly EpisodeId[];
  readonly droppedPointerCount: number;
  /** Kandidat yang gugur karena batas k, sebelum anggaran token ikut bicara. */
  readonly trimmedByK: number;
}

/**
 * Pemisahan `stable` / `dynamic` di sini **struktural, bukan konvensi**: tidak ada field
 * di `stable` yang bisa menampung hasil retrieval atau timestamp, jadi menaruh konten
 * dinamis di depan cache breakpoint tidak bisa terjadi karena lupa — hanya lewat mengubah
 * tipe ini, yang tidak akan lolos review.
 */
export interface ContextPack {
  readonly stable: ContextPackStable;
  /** Penanda posisi cache breakpoint. Semua yang ada di `dynamic` berada setelahnya. */
  readonly cacheBreakpointAfter: "prefix";
  readonly dynamic: ContextPackDynamic;
  readonly budget: ContextBudgetReport;
}

// ---------------------------------------------------------------------------
// Error anggaran
// ---------------------------------------------------------------------------

export type BudgetTier = "core" | "stable" | "recall" | "episodic" | "pointers";

export class ContextBudgetError extends Error {
  readonly tier: BudgetTier;

  constructor(tier: BudgetTier, message: string) {
    super(message);
    this.name = "ContextBudgetError";
    this.tier = tier;
  }
}

// ---------------------------------------------------------------------------
// Perakitan
// ---------------------------------------------------------------------------

function coreMemoryTokens(prefix: StablePrefix): number {
  return prefix.coreMemory.blocks.reduce(
    (n, b) =>
      n + estimateTokens(b.label) + estimateTokens(b.description) + estimateTokens(b.value),
    0,
  );
}

function toolDefinitionTokens(prefix: StablePrefix): number {
  return prefix.toolDefinitions.reduce(
    (n, t) =>
      n +
      estimateTokens(t.name) +
      estimateTokens(t.description) +
      estimateTokens(JSON.stringify(t.inputSchema)),
    0,
  );
}

function factTokens(hit: RetrievalHit): number {
  // Teks fakta + baris provenance yang menyertainya di render (§14: setiap fakta membawa
  // provenance dan timestamp, jadi keduanya ikut dihitung — bukan cuma teksnya).
  return (
    estimateTokens(hit.fact.text) +
    estimateTokens(hit.fact.provenance.sourceApp) +
    estimateTokens(hit.fact.tValid) +
    8
  );
}

function episodeTokens(ep: EpisodicSummary): number {
  return estimateTokens(ep.text) + estimateTokens(ep.ts) + 6;
}

function pointerTokens(p: ArtifactPointer): number {
  return estimateTokens(p.path) + estimateTokens(p.description) + 6;
}

/**
 * Mengisi satu tier dengan urutan yang sudah diranking, **berhenti pada item pertama yang
 * tidak muat**. Sengaja tidak melompati item besar untuk menyelipkan item kecil di
 * belakangnya: aturannya "buang yang peringkatnya paling rendah lebih dulu", dan greedy
 * yang melompat diam-diam melanggar itu.
 */
function fillTier<T>(
  ranked: readonly T[],
  cost: (item: T) => number,
  available: number,
): { kept: T[]; dropped: T[]; used: number } {
  const kept: T[] = [];
  let used = 0;
  for (const [i, item] of ranked.entries()) {
    const c = cost(item);
    if (used + c > available) return { kept, dropped: ranked.slice(i), used };
    kept.push(item);
    used += c;
  }
  return { kept, dropped: [], used };
}

/** Ranking deterministik: skor turun, seri diputus lewat ID supaya urutannya stabil. */
function rankFacts(hits: readonly RetrievalHit[]): RetrievalHit[] {
  return [...hits].sort((a, b) => b.score - a.score || (a.fact.id < b.fact.id ? -1 : 1));
}

/** Ringkasan terbaru lebih dulu — kontinuitas thread lebih berguna daripada awal thread. */
function rankEpisodes(list: readonly EpisodicSummary[]): EpisodicSummary[] {
  return [...list].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : a.id < b.id ? -1 : 1));
}

export function assembleContextPack(
  input: ContextPackInput,
  options: AssembleOptions,
): ContextPack {
  const k = options.k ?? DEFAULT_RETRIEVAL_K;
  if (!Number.isInteger(k) || k < 1 || k > MAX_RETRIEVAL_K) {
    throw new RangeError(
      `k harus bilangan bulat 1..${MAX_RETRIEVAL_K}, diterima ${String(options.k)}. ` +
        `k besar bukan trade-off netral: satu distraktor saja menurunkan akurasi (Context Rot).`,
    );
  }
  if (!Number.isInteger(options.tokenBudget) || options.tokenBudget <= 0) {
    throw new RangeError(
      `tokenBudget harus bilangan bulat positif, diterima ${String(options.tokenBudget)}`,
    );
  }

  if (options.assertCacheablePrefix !== false) assertPrefixCacheable(input.prefix);

  const shares = options.tierShares ?? DEFAULT_TIER_SHARES;
  const core = coreMemoryTokens(input.prefix);
  const system = estimateTokens(input.prefix.systemPrompt);
  const tools = toolDefinitionTokens(input.prefix);

  // Memori inti tidak pernah dipotong. Kalau ia melewati batas, yang rusak adalah
  // konsolidasi (L2 seharusnya menurunkan isinya ke L1), dan memangkasnya diam-diam di
  // sini akan menyembunyikan bug itu sekaligus menghapus konteks yang dijamin selalu ada.
  if (core > CORE_MEMORY_TOKEN_LIMIT) {
    throw new ContextBudgetError(
      "core",
      `Memori inti ~${core} token, melewati batas keras ${CORE_MEMORY_TOKEN_LIMIT} (prd.md §12.1). ` +
        `Ini bug konsolidasi, bukan sesuatu yang boleh dipangkas saat perakitan: turunkan blok ` +
        `yang jarang dipakai ke L1, atau ringkas isinya di Space.`,
    );
  }

  const stable = core + system + tools;
  if (stable + ENVELOPE_TOKEN_OVERHEAD > options.tokenBudget) {
    const tier: BudgetTier = core > options.tokenBudget ? "core" : "stable";
    throw new ContextBudgetError(
      tier,
      `Prefix stabil ~${stable} token (memori inti ${core}, system prompt ${system}, ` +
        `definisi tool ${tools}) + amplop ${ENVELOPE_TOKEN_OVERHEAD} tidak muat di anggaran ` +
        `${options.tokenBudget} token. Prefix tidak pernah dipangkas — naikkan anggaran, ` +
        `kecilkan katalog tool, atau ringkas memori inti.`,
    );
  }

  const dynamicBudget = options.tokenBudget - stable - ENVELOPE_TOKEN_OVERHEAD;

  const rankedFacts = rankFacts(input.candidateFacts);
  const withinK = rankedFacts.slice(0, k);
  const trimmedByK = rankedFacts.length - withinK.length;

  // Plafon per tier + sisa yang mengalir ke tier berikutnya. `remaining` sudah memuat
  // pemakaian tier sebelumnya, jadi `carry` hanya melonggarkan plafon — bukan menambah uang.
  let remaining = dynamicBudget;
  let carry = 0;

  const recallCap = Math.min(remaining, Math.floor(dynamicBudget * shares.recall) + carry);
  const recall = fillTier(withinK, factTokens, recallCap);
  carry = recallCap - recall.used;
  remaining -= recall.used;

  const episodicCap = Math.min(remaining, Math.floor(dynamicBudget * shares.episodic) + carry);
  const episodic = fillTier(rankEpisodes(input.episodicSummaries), episodeTokens, episodicCap);
  remaining -= episodic.used;

  // Tier terakhir boleh memakai seluruh sisa: pointer artifact murah dan tidak pernah
  // membawa isi dokumen, jadi tidak ada risiko ia menenggelamkan konteks lain.
  const pointers = fillTier(input.artifactPointers, pointerTokens, remaining);
  remaining -= pointers.used;

  const perTier: TierUsage = {
    core,
    systemPrompt: system,
    toolDefinitions: tools,
    recall: recall.used,
    episodic: episodic.used,
    pointers: pointers.used,
    envelope: ENVELOPE_TOKEN_OVERHEAD,
  };

  return {
    stable: { prefix: input.prefix, digest: prefixDigest(input.prefix) },
    cacheBreakpointAfter: "prefix",
    dynamic: {
      recalledFacts: recall.kept,
      episodicSummaries: episodic.kept,
      artifactPointers: pointers.kept,
      assembledAt: options.now,
    },
    budget: {
      tokenBudget: options.tokenBudget,
      usedTokens: options.tokenBudget - remaining,
      perTier,
      // Hanya yang gugur karena anggaran. Yang gugur karena batas k dihitung terpisah di
      // `trimmedByK` — dua sebab yang berbeda dan menuntut perbaikan yang berbeda.
      droppedFactIds: recall.dropped.map((h) => h.fact.id),
      droppedEpisodeIds: episodic.dropped.map((e) => e.id),
      droppedPointerCount: pointers.dropped.length,
      trimmedByK,
    },
  };
}
