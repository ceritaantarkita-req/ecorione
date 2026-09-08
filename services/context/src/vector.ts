/**
 * Jalur vektor — ADR-05.
 *
 * `fact_embeddings` (BLOB float32) adalah sumber kebenaran; index vektor apa pun di
 * atasnya adalah proyeksi turunan — pengulangan pola L0/L1 satu tingkat lebih rendah.
 * Karena itu implementasi bisa ditukar tanpa meng-embed ulang apa pun.
 *
 * Dua implementasi di balik satu antarmuka:
 *
 *   1. `sqlite-vec` kalau ekstensinya berhasil dimuat.
 *   2. Brute force di JS kalau tidak.
 *
 * Brute force bukan mode darurat yang perlu diminta maaf. Pada 10⁴–10⁵ fakta — skala
 * personal yang jadi target produk ini — satu sapuan cosine atas beberapa puluh ribu
 * vektor 768-dimensi selesai dalam orde milidetik, dan ia berjalan **setelah** gerbang
 * scope/sensitivitas memangkas kandidat, jadi yang disapu biasanya jauh lebih sedikit lagi.
 * Yang dibeli dengan `sqlite-vec` adalah kepala runway di atas titik itu, bukan
 * kebenaran hasil: keduanya menghitung metrik yang sama.
 */

import type { MemoryFactId } from "@ecorione/shared-schema";
import { createRequire } from "node:module";
import type { SqliteDatabase } from "./sqlite.js";

export interface VectorMatch {
  readonly factId: MemoryFactId;
  /** Cosine similarity, makin tinggi makin dekat. Dinormalkan sama di kedua implementasi. */
  readonly similarity: number;
}

export interface VectorIndex {
  readonly kind: "sqlite-vec" | "brute-force";
  readonly dim: number;
  /** Embedding lintas model tidak sebanding — index hanya menyentuh satu model (ADR-14). */
  readonly model: string;

  upsert(factId: MemoryFactId, embedding: Float32Array): void;
  remove(factId: MemoryFactId): void;

  /**
   * `allowed` adalah himpunan fakta yang **sudah** lolos gerbang scope dan sensitivitas.
   * Filter mendahului ranking dengan sengaja: fakta yang tersaring tidak boleh ikut
   * menentukan peringkat tetangga-tetangganya, karena kebocoran lintas konteks bisa
   * terjadi lewat urutan hasil, bukan cuma lewat isi.
   */
  search(query: Float32Array, limit: number, allowed: ReadonlySet<MemoryFactId>): VectorMatch[];

  /** Membangun ulang index turunan dari `fact_embeddings`. */
  rebuild(): void;
}

// ---------------------------------------------------------------------------
// Serialisasi
// ---------------------------------------------------------------------------

/** Menyalin, tidak membagi memori: buffer yang di-bind driver tidak boleh berubah di belakang. */
export function encodeEmbedding(vector: Float32Array): Buffer {
  return Buffer.from(new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength));
}

export function decodeEmbedding(blob: Buffer): Float32Array {
  return new Float32Array(
    blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength),
  );
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < n; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

export class EmbeddingDimensionError extends Error {
  constructor(expected: number, received: number) {
    super(`Dimensi embedding tidak cocok: index ${expected}, diterima ${received}.`);
    this.name = "EmbeddingDimensionError";
  }
}

// ---------------------------------------------------------------------------
// Penyimpanan bersama
// ---------------------------------------------------------------------------

interface EmbeddingRow {
  fact_id: string;
  embedding: Buffer;
}

function writeEmbedding(
  db: SqliteDatabase,
  model: string,
  dim: number,
  factId: MemoryFactId,
  embedding: Float32Array,
): void {
  if (embedding.length !== dim) throw new EmbeddingDimensionError(dim, embedding.length);

  db.prepare(
    `INSERT INTO fact_embeddings (fact_id, model, dim, embedding)
     VALUES (@fact_id, @model, @dim, @embedding)
     ON CONFLICT (fact_id) DO UPDATE SET
       model = excluded.model, dim = excluded.dim, embedding = excluded.embedding`,
  ).run({
    fact_id: factId,
    model,
    dim,
    embedding: encodeEmbedding(embedding),
  });
}

// ---------------------------------------------------------------------------
// Brute force
// ---------------------------------------------------------------------------

class BruteForceVectorIndex implements VectorIndex {
  readonly kind = "brute-force" as const;

  constructor(
    private readonly db: SqliteDatabase,
    readonly dim: number,
    readonly model: string,
  ) {}

  upsert(factId: MemoryFactId, embedding: Float32Array): void {
    writeEmbedding(this.db, this.model, this.dim, factId, embedding);
  }

  remove(factId: MemoryFactId): void {
    this.db.prepare("DELETE FROM fact_embeddings WHERE fact_id = ?").run(factId);
  }

  search(
    query: Float32Array,
    limit: number,
    allowed: ReadonlySet<MemoryFactId>,
  ): VectorMatch[] {
    if (limit <= 0 || allowed.size === 0) return [];
    if (query.length !== this.dim) throw new EmbeddingDimensionError(this.dim, query.length);

    const rows = this.db
      .prepare("SELECT fact_id, embedding FROM fact_embeddings WHERE model = ? AND dim = ?")
      .all(this.model, this.dim) as EmbeddingRow[];

    const matches: VectorMatch[] = [];
    for (const row of rows) {
      const factId = row.fact_id as MemoryFactId;
      if (!allowed.has(factId)) continue;
      matches.push({
        factId,
        similarity: cosineSimilarity(query, decodeEmbedding(row.embedding)),
      });
    }

    // Urutan sekunder lewat id supaya hasil deterministik saat similarity seri —
    // ranking yang goyang bikin RRF ikut goyang dan test jadi flaky tanpa sebab nyata.
    matches.sort((a, b) =>
      b.similarity === a.similarity
        ? a.factId.localeCompare(b.factId)
        : b.similarity - a.similarity,
    );

    return matches.slice(0, limit);
  }

  rebuild(): void {
    // Tidak ada index turunan untuk dibangun — `fact_embeddings` sudah bentuk akhirnya.
  }
}

// ---------------------------------------------------------------------------
// sqlite-vec
// ---------------------------------------------------------------------------

export type SqliteVecLoader = (db: SqliteDatabase) => void;

/**
 * Mencoba menemukan `sqlite-vec` tanpa menjadikannya dependency. Paketnya berisi binary
 * per-platform dan sering tidak terpasang; kegagalan di sini normal, bukan error.
 */
export function tryDefaultSqliteVecLoader(): SqliteVecLoader | null {
  try {
    const require = createRequire(import.meta.url);
    const mod = require("sqlite-vec") as { load?: (db: unknown) => void };
    if (typeof mod.load !== "function") return null;
    const load = mod.load;
    return (db) => {
      load(db);
    };
  } catch {
    return null;
  }
}

interface VecMatchRow {
  fact_id: string;
  distance: number;
}

class SqliteVecIndex implements VectorIndex {
  readonly kind = "sqlite-vec" as const;

  constructor(
    private readonly db: SqliteDatabase,
    readonly dim: number,
    readonly model: string,
  ) {
    // Dimensi baru diketahui saat model embedding dipilih, jadi tabel vec0 tidak bisa
    // hidup di migrasi awal — ia dibuat di sini dan dianggap turunan sepenuhnya.
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS facts_vec USING vec0(
         embedding float[${String(dim)}] distance_metric=cosine
       )`,
    );
  }

  /** vec0 diindeks dengan `rowid` integer — dipakai yang sama dengan FTS5: `facts.rowid`. */
  private rowidOf(factId: MemoryFactId): number | null {
    const row = this.db.prepare("SELECT rowid AS rid FROM facts WHERE id = ?").get(factId) as
      { rid: number } | undefined;
    return row?.rid ?? null;
  }

  upsert(factId: MemoryFactId, embedding: Float32Array): void {
    writeEmbedding(this.db, this.model, this.dim, factId, embedding);

    const rid = this.rowidOf(factId);
    if (rid === null) return;

    const blob = encodeEmbedding(embedding);
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM facts_vec WHERE rowid = ?").run(rid);
      this.db.prepare("INSERT INTO facts_vec (rowid, embedding) VALUES (?, ?)").run(rid, blob);
    })();
  }

  remove(factId: MemoryFactId): void {
    const rid = this.rowidOf(factId);
    this.db.transaction(() => {
      if (rid !== null) this.db.prepare("DELETE FROM facts_vec WHERE rowid = ?").run(rid);
      this.db.prepare("DELETE FROM fact_embeddings WHERE fact_id = ?").run(factId);
    })();
  }

  search(
    query: Float32Array,
    limit: number,
    allowed: ReadonlySet<MemoryFactId>,
  ): VectorMatch[] {
    if (limit <= 0 || allowed.size === 0) return [];
    if (query.length !== this.dim) throw new EmbeddingDimensionError(this.dim, query.length);

    const ids = [...allowed];
    const idPlaceholders = ids.map(() => "?").join(", ");

    // `rowid IN (...)` adalah bentuk filter yang didukung vec0 pada query KNN. Filternya
    // masuk ke dalam KNN, bukan dipasang sesudahnya — supaya batas `k` dihitung atas
    // kandidat yang sudah lolos gerbang, bukan atas seluruh index.
    const rows = this.db
      .prepare(
        `SELECT f.id AS fact_id, v.distance AS distance
         FROM facts_vec v
         JOIN facts f ON f.rowid = v.rowid
         WHERE v.embedding MATCH ?
           AND k = ?
           AND v.rowid IN (SELECT rowid FROM facts WHERE id IN (${idPlaceholders}))`,
      )
      .all(encodeEmbedding(query), limit, ...ids) as VecMatchRow[];

    return rows.map((row) => ({
      factId: row.fact_id as MemoryFactId,
      // vec0 mengembalikan jarak cosine; dibalik supaya sebanding dengan jalur brute force.
      similarity: 1 - row.distance,
    }));
  }

  rebuild(): void {
    const rows = this.db
      .prepare("SELECT fact_id, embedding FROM fact_embeddings WHERE model = ? AND dim = ?")
      .all(this.model, this.dim) as EmbeddingRow[];

    this.db.transaction(() => {
      this.db.exec("DELETE FROM facts_vec");
      for (const row of rows) {
        const rid = this.rowidOf(row.fact_id as MemoryFactId);
        if (rid === null) continue;
        this.db
          .prepare("INSERT INTO facts_vec (rowid, embedding) VALUES (?, ?)")
          .run(rid, row.embedding);
      }
    })();
  }
}

// ---------------------------------------------------------------------------
// Pabrik
// ---------------------------------------------------------------------------

export interface VectorIndexOptions {
  readonly dim: number;
  /** Identitas model embedding, di-pin eksplisit — alias `-latest` dilarang (ADR-14). */
  readonly model: string;
  /**
   * `"auto"` mencoba `sqlite-vec` lalu jatuh ke brute force. `"brute-force"` memaksa
   * jalur JS — dipakai test supaya hasilnya tidak bergantung pada ekstensi terpasang.
   */
  readonly prefer?: "auto" | "brute-force";
  /** Loader eksplisit; kalau kosong dan `prefer` = `"auto"`, dicari sendiri. */
  readonly loader?: SqliteVecLoader | undefined;
}

export function createVectorIndex(
  db: SqliteDatabase,
  options: VectorIndexOptions,
): VectorIndex {
  const { dim, model } = options;

  if ((options.prefer ?? "auto") === "brute-force") {
    return new BruteForceVectorIndex(db, dim, model);
  }

  const loader = options.loader ?? tryDefaultSqliteVecLoader();
  if (loader === null || loader === undefined) {
    return new BruteForceVectorIndex(db, dim, model);
  }

  try {
    loader(db);
    return new SqliteVecIndex(db, dim, model);
  } catch {
    // Ekstensi gagal dimuat (binary platform tidak ada, build SQLite tanpa dukungan
    // extension, dst.). Ini bukan kondisi error — hasil retrieval-nya identik.
    return new BruteForceVectorIndex(db, dim, model);
  }
}
