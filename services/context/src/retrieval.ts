/**
 * Retrieval hybrid — `prd.md` §12.1, ADR-05.
 *
 * Dua jalur berjalan paralel (BM25 leksikal + KNN vektor), difusikan dengan Reciprocal
 * Rank Fusion, lalu di-rerank dengan `skor × peluruhan_recency × confidence`.
 *
 * Dua invarian yang tidak boleh dilanggar:
 *
 * 1. **Filter mendahului ranking.** Scope dan sensitivitas disaring sebelum kedua jalur
 *    mencari, bukan sesudah. Fakta yang tersaring tidak boleh ikut menentukan peringkat
 *    tetangganya — kebocoran lintas konteks bisa terjadi lewat urutan hasil, bukan cuma
 *    lewat isi yang dikembalikan.
 *
 * 2. **k kecil.** Default 8, maksimum 20. Studi Context Rot (18 model) menemukan satu
 *    distraktor saja sudah menurunkan akurasi, dan potongan fokus ~300 token mengungguli
 *    percakapan penuh ~113k token. Fakta yang cuma agak relevan **aktif merusak**, bukan
 *    sekadar memboroskan token — jadi k besar bukan trade-off biaya-vs-kualitas, ia rugi
 *    di kedua sisi.
 */

import {
  DEFAULT_RETRIEVAL_K,
  MAX_RETRIEVAL_K,
  recencyDecay,
  type MemoryFact,
  type MemoryFactId,
  type RetrievalHit,
  type Scope,
  type Sensitivity,
  type Timestamp,
} from "@ecorione/shared-schema";
import type { ContextRepository } from "./repository.js";
import type { VectorIndex } from "./vector.js";

/**
 * Konstanta RRF. 60 adalah nilai konvensional dari paper aslinya (Cormack et al., 2009):
 * cukup besar untuk membuat selisih antar peringkat teratas tidak ekstrem, cukup kecil
 * untuk tetap membedakan. Diekspor supaya bisa dibandingkan di eval, bukan supaya disetel
 * sembarangan — mengubahnya mengubah seluruh urutan hasil.
 */
export const RRF_K = 60;

/** Berapa kandidat diambil tiap jalur sebelum fusi. Lebih lebar dari k akhir supaya fusi punya bahan. */
const CANDIDATE_MULTIPLIER = 4;
const MIN_CANDIDATES = 20;

export interface RetrievalOptions {
  readonly query: string;
  /** Wajib. Tidak ada default "semua scope" — itu bocor secara diam-diam. */
  readonly scopes: readonly Scope[];
  readonly k?: number | undefined;
  readonly maxSensitivity?: Sensitivity | undefined;
  /** Wajib disuntik — `Date.now()` dilarang di jalur ini (ADR-01, ESLint memblokirnya). */
  readonly now: Timestamp;
  /** Embedding query. Tanpa ini retrieval berjalan leksikal saja, dan itu sah. */
  readonly queryEmbedding?: Float32Array | undefined;
}

export interface RetrievalDiagnostics {
  readonly lexicalCandidates: number;
  readonly vectorCandidates: number;
  readonly afterFilter: number;
  readonly returned: number;
}

export interface RetrievalResult {
  readonly hits: RetrievalHit[];
  readonly diagnostics: RetrievalDiagnostics;
}

export class ContextRetriever {
  constructor(
    private readonly repo: ContextRepository,
    private readonly vectors?: VectorIndex,
  ) {}

  retrieve(options: RetrievalOptions): RetrievalResult {
    // Tipe sudah mewajibkan `scopes`, tapi jalur panggilan yang sebenarnya berbahaya
    // datang dari luar TypeScript: tool MCP menerima JSON dari model hosted. Batas
    // privasi tidak boleh cuma dijaga compiler — "tanpa scope" harus gagal keras, bukan
    // diam-diam berarti "semua scope".
    assertScopes(options.scopes);

    const k = clampK(options.k);
    const maxSensitivity: Sensitivity = options.maxSensitivity ?? "RESTRICTED";
    const candidateLimit = Math.max(MIN_CANDIDATES, k * CANDIDATE_MULTIPLIER);

    // Invarian 1: himpunan yang boleh dilihat dibentuk lebih dulu, dan kedua jalur
    // pencarian hanya boleh bergerak di dalamnya.
    const allowedFacts = this.allowedFacts(options.scopes, maxSensitivity);
    const allowedIds = new Set(allowedFacts.keys());

    const lexical = this.lexicalSearch(options.query, candidateLimit, allowedIds);
    const vector = this.vectorSearch(options.queryEmbedding, candidateLimit, allowedIds);

    const fused = reciprocalRankFusion([lexical, vector]);

    const hits: RetrievalHit[] = [];
    for (const [factId, entry] of fused) {
      const fact = allowedFacts.get(factId);
      if (fact === undefined) continue;

      // Rerank: relevansi (RRF) × seberapa segar × seberapa yakin. Peluruhan recency
      // adalah **sinyal ranking, bukan penghapusan** — fakta lama tetap bisa muncul kalau
      // relevansinya jauh lebih tinggi (`research.md` §3.5: melupakan belum terpecahkan,
      // dan menghapus lebih berbahaya daripada menurunkan peringkat).
      const score = entry.score * recencyDecay(fact.createdAt, options.now) * fact.confidence;

      hits.push({ fact, score, matchedBy: entry.matchedBy });
    }

    hits.sort((a, b) => b.score - a.score || (a.fact.id < b.fact.id ? -1 : 1));

    return {
      hits: hits.slice(0, k),
      diagnostics: {
        lexicalCandidates: lexical.length,
        vectorCandidates: vector.length,
        afterFilter: hits.length,
        returned: Math.min(hits.length, k),
      },
    };
  }

  /**
   * Fakta yang lolos gerbang, di-index by id. Sengaja dimaterialisasi: kedua jalur butuh
   * himpunan yang sama, dan pada skala personal (10⁴–10⁵ fakta) ini jauh lebih murah
   * daripada menjalankan predikat yang sama dua kali di dua mesin pencari berbeda.
   */
  private allowedFacts(
    scopes: readonly Scope[],
    maxSensitivity: Sensitivity,
  ): Map<MemoryFactId, MemoryFact> {
    const facts = this.repo.listFacts({
      scopes,
      maxSensitivity,
      limit: 100_000,
    });
    return new Map(facts.map((f) => [f.id, f]));
  }

  private lexicalSearch(
    query: string,
    limit: number,
    allowed: ReadonlySet<MemoryFactId>,
  ): RankedList {
    const match = toFtsQuery(query);
    if (match === null) return [];

    let rows: { id: string }[];
    try {
      rows = this.repo.db.raw
        .prepare(
          `SELECT f.id AS id
             FROM facts_fts
             JOIN facts f ON f.rowid = facts_fts.rowid
            WHERE facts_fts MATCH ?
            ORDER BY bm25(facts_fts)
            LIMIT ?`,
        )
        .all(match, limit) as { id: string }[];
    } catch {
      // Query yang tidak bisa diparse FTS5 bukan alasan untuk menggagalkan retrieval —
      // jalur vektor masih bisa menjawab. Diamkan di sini, jangan diamkan di eval.
      return [];
    }

    return rows.map((r) => r.id as MemoryFactId).filter((id) => allowed.has(id));
  }

  private vectorSearch(
    queryEmbedding: Float32Array | undefined,
    limit: number,
    allowed: ReadonlySet<MemoryFactId>,
  ): RankedList {
    if (queryEmbedding === undefined || this.vectors === undefined) return [];
    return this.vectors.search(queryEmbedding, limit, allowed).map((m) => m.factId);
  }
}

type RankedList = readonly MemoryFactId[];

interface FusedEntry {
  score: number;
  matchedBy: RetrievalHit["matchedBy"];
}

/**
 * Reciprocal Rank Fusion: `skor = Σ 1/(RRF_K + peringkat)`.
 *
 * Yang membuat ini sepadan dengan kerumitannya: fakta yang **cukup baik di kedua jalur**
 * mengalahkan fakta yang juara di satu jalur saja. Itu properti yang benar untuk memori —
 * kecocokan kata kunci tanpa kedekatan makna biasanya kebetulan, dan sebaliknya.
 *
 * RRF hanya memakai peringkat, bukan skor mentah, jadi tidak perlu menormalkan BM25
 * (skala tak terbatas, makin kecil makin baik) terhadap cosine (−1..1). Itu alasan
 * praktisnya dipilih di atas penjumlahan berbobot.
 */
export function reciprocalRankFusion(
  lists: readonly RankedList[],
  k: number = RRF_K,
): Map<MemoryFactId, FusedEntry> {
  const fused = new Map<MemoryFactId, FusedEntry>();
  const labels = ["lexical", "vector"] as const;

  lists.forEach((list, listIndex) => {
    const label = labels[listIndex] ?? "lexical";
    list.forEach((factId, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = fused.get(factId);
      if (existing === undefined) {
        fused.set(factId, { score: contribution, matchedBy: [label] });
      } else {
        existing.score += contribution;
        if (!existing.matchedBy.includes(label)) {
          existing.matchedBy = [...existing.matchedBy, label];
        }
      }
    });
  });

  return fused;
}

export class MissingScopeError extends Error {
  constructor() {
    super(
      "Retrieval butuh minimal satu scope. Tidak ada default 'semua scope' — itu " +
        "kebocoran lintas konteks yang tidak menghasilkan error (PRD §14).",
    );
    this.name = "MissingScopeError";
  }
}

function assertScopes(
  scopes: readonly Scope[] | undefined,
): asserts scopes is readonly Scope[] {
  if (scopes === undefined || scopes.length === 0) throw new MissingScopeError();
}

function clampK(k: number | undefined): number {
  if (k === undefined) return DEFAULT_RETRIEVAL_K;
  if (!Number.isInteger(k) || k < 1) {
    throw new RangeError(`k harus bilangan bulat ≥ 1, diterima ${k}`);
  }
  return Math.min(k, MAX_RETRIEVAL_K);
}

/**
 * Query pengguna diubah jadi ekspresi FTS5 yang aman.
 *
 * Teks bebas bisa berisi sintaks FTS5 (`"` `*` `:` `NEAR` `AND`) yang akan dieksekusi
 * sebagai operator atau melempar. Tiap token dikutip dan digabung `OR`, jadi query
 * diperlakukan sebagai kata, bukan sebagai program.
 */
export function toFtsQuery(raw: string): string | null {
  const tokens = raw
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`);

  return tokens.length === 0 ? null : tokens.join(" OR ");
}
