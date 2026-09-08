/**
 * Lapisan akses data bertipe untuk memori 4 tier — PRD §12.1, ADR-06/07.
 *
 * Tiga invarian dipaksakan di sini, bukan diminta lewat prompt atau konvensi:
 *
 *   - **L0 append-only.** Trigger di database yang menegakkannya; repository tidak punya
 *     jalan untuk mengubah isi episode sama sekali.
 *   - **Tulisan tak-tepercaya lewat karantina** (aturan 3). `proposeFact` menulis ke
 *     `quarantine`; hanya konsolidasi lokal yang mempromosikan.
 *   - **Fakta di-invalidate, tidak dihapus** (aturan 4). Tidak ada operasi hapus fakta
 *     yang bisa dijangkau dari API ini.
 */

import {
  CORE_MEMORY_CHAR_LIMIT,
  CORE_MEMORY_TOKEN_LIMIT,
  CoreMemoryBlockSchema,
  CoreMemorySchema,
  EpisodeSchema,
  MemoryFactSchema,
  QuarantinedWriteSchema,
  ArtifactPointerSchema,
  mayWriteCoreMemory,
  sensitivityRank,
  supersede,
  SENSITIVITY,
  type ArtifactPointer,
  type CoreMemory,
  type CoreMemoryBlock,
  type Episode,
  type EpisodeId,
  type MemoryFact,
  type MemoryFactId,
  type QuarantinedWrite,
  type Scope,
  type Sensitivity,
  type Timestamp,
  type Trust,
} from "@ecorione/shared-schema";
import type { z } from "zod";
import type { ContextDatabase } from "./db.js";
import {
  FACT_COLUMNS,
  factParams,
  provenanceParams,
  rowToArtifactPointer,
  rowToCoreBlock,
  rowToEpisode,
  rowToFact,
  rowToQuarantined,
  type ArtifactPointerRow,
  type CoreMemoryRow,
  type EpisodeRow,
  type FactRow,
  type QuarantineRow,
} from "./rows.js";
import type { SqliteDatabase } from "./sqlite.js";
import type { VectorIndex } from "./vector.js";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Aturan 3: tulisan dari model hosted / pihak ketiga tidak punya jalur langsung ke L1. */
export class QuarantineRequiredError extends ContextError {
  constructor(trust: Trust) {
    super(
      `Trust "${trust}" harus lewat proposeFact() → karantina, bukan insertFact() (ADR-07).`,
    );
  }
}

export class QuarantineStateError extends ContextError {}

export class FactNotFoundError extends ContextError {
  constructor(id: MemoryFactId) {
    super(`Fakta tidak ditemukan: ${id}`);
  }
}

export class FactAlreadyInvalidatedError extends ContextError {
  constructor(id: MemoryFactId) {
    super(`Fakta ${id} sudah di-invalidate — supersede rantai dari fakta penggantinya.`);
  }
}

/**
 * Sengaja ada sebagai error, bukan sebagai method yang tidak pernah ditulis. Orang akan
 * mencari `deleteFact`; yang harus mereka temukan adalah penjelasan kenapa ia tidak ada,
 * bukan keheningan yang mengundang penambahan.
 */
export class FactDeletionForbiddenError extends ContextError {
  constructor() {
    super(
      "Fakta tidak pernah dihapus (ADR-06). Provenance harus tetap bisa ditelusuri: " +
        "jawaban hari ini harus bisa dijelaskan lewat fakta yang berlaku saat itu, " +
        "termasuk yang sudah tidak berlaku sekarang. Pakai forgetFact() untuk meng-" +
        "invalidate tanpa pengganti, supersedeFact() kalau ada fakta baru yang " +
        "menggantikan, atau rebuildDerivedTiers() untuk menurunkan ulang L1 dari L0.",
    );
  }
}

export class CoreMemoryLimitError extends ContextError {
  constructor(chars: number) {
    super(
      `Memori inti ${String(chars)} karakter, melewati batas ~${String(CORE_MEMORY_TOKEN_LIMIT)} ` +
        `token (${String(CORE_MEMORY_CHAR_LIMIT)} karakter). Blok inti ikut di setiap ` +
        "panggilan, jadi tiap token di sini dibayar berkali-kali — ringkas, atau turunkan ke L1.",
    );
  }
}

export class CoreMemoryWriteForbiddenError extends ContextError {}

export class ScopeEscalationError extends ContextError {
  constructor(from: Scope, to: Scope) {
    super(
      `Promosi karantina tidak boleh memindahkan scope: usulan "${from}" → fakta "${to}". ` +
        "Scope adalah gerbang privasi lintas konteks, bukan metadata yang bisa disunting.",
    );
  }
}

// ---------------------------------------------------------------------------
// Tipe input — diturunkan dari skema bersama supaya tidak pernah menyimpang
// ---------------------------------------------------------------------------

export type AppendEpisodeInput = z.input<typeof EpisodeSchema>;
export type InsertFactInput = z.input<typeof MemoryFactSchema>;
export type ProposeFactInput = Omit<
  z.input<typeof QuarantinedWriteSchema>,
  "status" | "rejectionReason" | "reviewedAt"
>;
export type CoreMemoryBlockInput = z.input<typeof CoreMemoryBlockSchema>;
export type ArtifactPointerInput = z.input<typeof ArtifactPointerSchema>;

export interface FactLookupOptions {
  /**
   * Default `false`. Fungsi yang defaultnya mengembalikan fakta kadaluwarsa adalah bug yang
   * menunggu terjadi — pemanggil yang butuh sejarah harus memintanya secara eksplisit.
   */
  readonly includeInvalidated?: boolean;
}

export interface ListFactsFilter extends FactLookupOptions {
  readonly scopes?: readonly Scope[] | undefined;
  readonly subject?: string | undefined;
  readonly maxSensitivity?: Sensitivity | undefined;
  readonly limit?: number | undefined;
}

export interface ListEpisodesFilter {
  readonly scopes?: readonly Scope[] | undefined;
  readonly since?: Timestamp | undefined;
  readonly onlyUnconsolidated?: boolean | undefined;
  readonly limit?: number | undefined;
}

export interface SupersedeResult {
  /** Proyeksi fakta lama setelah invalidasi — `tInvalid` + `supersededBy` terisi. */
  readonly invalidated: MemoryFact;
  readonly replacement: MemoryFact;
}

export interface CoreMemoryWriteOptions {
  /** Hanya `USER` boleh menulis blok read-only; `LOCAL_AGENT` boleh sisanya (ADR-07). */
  readonly trust: Trust;
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Daftar sensitivitas yang lolos ambang — dipakai sebagai predikat `IN`, bukan filter pasca-query. */
export function allowedSensitivities(max: Sensitivity): Sensitivity[] {
  return SENSITIVITY.filter((s) => sensitivityRank(s) <= sensitivityRank(max));
}

const DIRECT_L1_WRITE_TRUST: ReadonlySet<Trust> = new Set<Trust>(["USER", "LOCAL_AGENT"]);

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ContextRepository {
  private readonly raw: SqliteDatabase;

  constructor(
    private readonly database: ContextDatabase,
    private readonly vectors?: VectorIndex,
  ) {
    this.raw = database.raw;
  }

  get db(): ContextDatabase {
    return this.database;
  }

  get vectorIndex(): VectorIndex | undefined {
    return this.vectors;
  }

  // -------------------------------------------------------------------------
  // L0
  // -------------------------------------------------------------------------

  /** Satu-satunya tulisan yang benar-benar permanen. Semua tier lain diturunkan dari sini. */
  appendEpisode(input: AppendEpisodeInput): Episode {
    const episode = EpisodeSchema.parse(input);

    this.raw
      .prepare(
        `INSERT INTO episodes (
           id, ts, raw_text, source_app, session_id, tool_call_id, source_uri,
           scope, sensitivity, sync_class, trust, summary, consolidated_at
         ) VALUES (
           @id, @ts, @raw_text, @source_app, @session_id, @tool_call_id, @source_uri,
           @scope, @sensitivity, @sync_class, @trust, @summary, @consolidated_at
         )`,
      )
      .run({
        id: episode.id,
        ts: episode.ts,
        raw_text: episode.rawText,
        ...provenanceParams(episode.provenance),
        scope: episode.scope,
        sensitivity: episode.sensitivity,
        sync_class: episode.syncClass,
        trust: episode.trust,
        summary: episode.summary,
        consolidated_at: episode.consolidatedAt,
      });

    return episode;
  }

  getEpisode(id: EpisodeId): Episode | null {
    const row = this.raw.prepare("SELECT * FROM episodes WHERE id = ?").get(id) as
      EpisodeRow | undefined;
    return row === undefined ? null : rowToEpisode(row);
  }

  listEpisodes(filter: ListEpisodesFilter = {}): Episode[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filter.scopes !== undefined && filter.scopes.length > 0) {
      clauses.push(`scope IN (${placeholders(filter.scopes.length)})`);
      params.push(...filter.scopes);
    }
    if (filter.since !== undefined) {
      clauses.push("ts >= ?");
      params.push(filter.since);
    }
    if (filter.onlyUnconsolidated === true) {
      clauses.push("consolidated_at IS NULL");
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filter.limit ?? 200;

    const rows = this.raw
      .prepare(`SELECT * FROM episodes ${where} ORDER BY ts ASC, id ASC LIMIT ?`)
      .all(...params, limit) as EpisodeRow[];

    return rows.map(rowToEpisode);
  }

  /**
   * Menandai episode sudah lewat gerbang salience. Kolom `summary`/`consolidated_at`
   * sengaja tidak dilindungi trigger append-only: keduanya penanda turunan, bukan isi.
   */
  markEpisodeConsolidated(id: EpisodeId, summary: string | null, now: Timestamp): void {
    this.raw
      .prepare("UPDATE episodes SET summary = ?, consolidated_at = ? WHERE id = ?")
      .run(summary, now, id);
  }

  // -------------------------------------------------------------------------
  // Karantina (ADR-07)
  // -------------------------------------------------------------------------

  /**
   * Jalur tulis untuk `memory_propose` — tool MCP yang dipanggil model hosted. Tidak ada
   * `memory_write`. Isinya tidak pernah terlihat retrieval sampai dipromosikan, jadi
   * konten yang di-inject lewat halaman web atau email tidak pernah sempat jadi "memori".
   */
  proposeFact(input: ProposeFactInput): MemoryFactId {
    const proposal = QuarantinedWriteSchema.parse({ ...input, status: "PENDING" });

    this.raw
      .prepare(
        `INSERT INTO quarantine (
           id, proposed_text, proposed_at, source_app, session_id, tool_call_id, source_uri,
           trust, scope, status, rejection_reason, reviewed_at, promoted_fact_id
         ) VALUES (
           @id, @proposed_text, @proposed_at, @source_app, @session_id, @tool_call_id, @source_uri,
           @trust, @scope, 'PENDING', NULL, NULL, NULL
         )`,
      )
      .run({
        id: proposal.id,
        proposed_text: proposal.proposedText,
        proposed_at: proposal.proposedAt,
        ...provenanceParams(proposal.provenance),
        trust: proposal.trust,
        scope: proposal.scope,
      });

    return proposal.id;
  }

  getQuarantined(id: MemoryFactId): QuarantinedWrite | null {
    const row = this.raw.prepare("SELECT * FROM quarantine WHERE id = ?").get(id) as
      QuarantineRow | undefined;
    return row === undefined ? null : rowToQuarantined(row);
  }

  listQuarantine(status: QuarantinedWrite["status"] = "PENDING"): QuarantinedWrite[] {
    const rows = this.raw
      .prepare("SELECT * FROM quarantine WHERE status = ? ORDER BY proposed_at ASC, id ASC")
      .all(status) as QuarantineRow[];
    return rows.map(rowToQuarantined);
  }

  /**
   * Konsolidasi lokal memutuskan usulan ini layak jadi fakta. Bentuk terstrukturnya datang
   * dari pemanggil — ekstraksi triple adalah tugas model lokal, bukan tugas lapisan data.
   *
   * Scope fakta hasil promosi harus sama dengan scope usulannya: promosi bukan kesempatan
   * memindahkan sesuatu dari `work` ke `personal`.
   */
  promoteFromQuarantine(
    quarantineId: MemoryFactId,
    factInput: InsertFactInput,
    now: Timestamp,
  ): MemoryFact {
    const proposal = this.getQuarantined(quarantineId);
    if (proposal === null) {
      throw new QuarantineStateError(`Usulan karantina tidak ditemukan: ${quarantineId}`);
    }
    if (proposal.status !== "PENDING") {
      throw new QuarantineStateError(
        `Usulan ${quarantineId} sudah berstatus ${proposal.status}.`,
      );
    }

    const fact = MemoryFactSchema.parse(factInput);
    if (fact.scope !== proposal.scope) {
      throw new ScopeEscalationError(proposal.scope, fact.scope);
    }

    return this.raw.transaction(() => {
      this.insertFactRow(fact);
      this.raw
        .prepare(
          `UPDATE quarantine
             SET status = 'PROMOTED', reviewed_at = ?, promoted_fact_id = ?, rejection_reason = NULL
           WHERE id = ?`,
        )
        .run(now, fact.id, quarantineId);
      return fact;
    })();
  }

  rejectQuarantined(quarantineId: MemoryFactId, reason: string, now: Timestamp): void {
    const changes = this.raw
      .prepare(
        `UPDATE quarantine
           SET status = 'REJECTED', rejection_reason = ?, reviewed_at = ?
         WHERE id = ? AND status = 'PENDING'`,
      )
      .run(reason, now, quarantineId).changes;

    if (changes === 0) {
      throw new QuarantineStateError(
        `Tidak ada usulan PENDING dengan id ${quarantineId} untuk ditolak.`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // L1
  // -------------------------------------------------------------------------

  private insertFactRow(fact: MemoryFact): void {
    this.raw
      .prepare(
        `INSERT INTO facts (
           id, subject, predicate, object, text, confidence, salience, source_episode_ids,
           t_valid, t_invalid, superseded_by, created_at,
           scope, sensitivity, sync_class, trust,
           source_app, session_id, tool_call_id, source_uri
         ) VALUES (
           @id, @subject, @predicate, @object, @text, @confidence, @salience, @source_episode_ids,
           @t_valid, @t_invalid, @superseded_by, @created_at,
           @scope, @sensitivity, @sync_class, @trust,
           @source_app, @session_id, @tool_call_id, @source_uri
         )`,
      )
      .run(factParams(fact));
  }

  /** Tulisan L1 langsung. Hanya untuk konsolidasi lokal — sumber lain lewat karantina. */
  insertFact(input: InsertFactInput): MemoryFact {
    const fact = MemoryFactSchema.parse(input);
    if (!DIRECT_L1_WRITE_TRUST.has(fact.trust)) {
      throw new QuarantineRequiredError(fact.trust);
    }
    this.insertFactRow(fact);
    return fact;
  }

  private factRow(id: MemoryFactId, includeInvalidated: boolean): FactRow | undefined {
    const liveClause = includeInvalidated ? "" : "AND t_invalid IS NULL";
    return this.raw
      .prepare(`SELECT ${FACT_COLUMNS} FROM facts WHERE id = ? ${liveClause}`)
      .get(id) as FactRow | undefined;
  }

  getFact(id: MemoryFactId, options: FactLookupOptions = {}): MemoryFact | null {
    const row = this.factRow(id, options.includeInvalidated ?? false);
    return row === undefined ? null : rowToFact(row);
  }

  getFactsByIds(
    ids: readonly MemoryFactId[],
    options: FactLookupOptions = {},
  ): Map<MemoryFactId, MemoryFact> {
    const result = new Map<MemoryFactId, MemoryFact>();
    if (ids.length === 0) return result;

    const liveClause = (options.includeInvalidated ?? false) ? "" : "AND t_invalid IS NULL";
    const rows = this.raw
      .prepare(
        `SELECT ${FACT_COLUMNS} FROM facts WHERE id IN (${placeholders(ids.length)}) ${liveClause}`,
      )
      .all(...ids) as FactRow[];

    for (const row of rows) {
      const fact = rowToFact(row);
      result.set(fact.id, fact);
    }
    return result;
  }

  listFacts(filter: ListFactsFilter = {}): MemoryFact[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    // Default aman: hanya fakta yang masih berlaku (aturan 4).
    if (!(filter.includeInvalidated ?? false)) clauses.push("t_invalid IS NULL");

    if (filter.scopes !== undefined && filter.scopes.length > 0) {
      clauses.push(`scope IN (${placeholders(filter.scopes.length)})`);
      params.push(...filter.scopes);
    }
    if (filter.subject !== undefined) {
      clauses.push("subject = ?");
      params.push(filter.subject);
    }
    if (filter.maxSensitivity !== undefined) {
      const allowed = allowedSensitivities(filter.maxSensitivity);
      clauses.push(`sensitivity IN (${placeholders(allowed.length)})`);
      params.push(...allowed);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filter.limit ?? 200;

    const rows = this.raw
      .prepare(
        `SELECT ${FACT_COLUMNS} FROM facts ${where} ORDER BY created_at DESC, id ASC LIMIT ?`,
      )
      .all(...params, limit) as FactRow[];

    return rows.map(rowToFact);
  }

  /**
   * Kontradiksi menghasilkan invalidasi, bukan penghapusan (aturan 4, ADR-06). Fakta lama
   * tetap ada dengan `t_invalid` dan `superseded_by` terisi, jadi jawaban lama masih bisa
   * dijelaskan sesudah faktanya berubah.
   */
  supersedeFact(oldId: MemoryFactId, newFactInput: InsertFactInput): SupersedeResult {
    const oldRow = this.factRow(oldId, true);
    if (oldRow === undefined) throw new FactNotFoundError(oldId);
    if (oldRow.t_invalid !== null) throw new FactAlreadyInvalidatedError(oldId);

    const old = rowToFact(oldRow);
    const replacement = MemoryFactSchema.parse(newFactInput);

    // Fakta tidak bisa berhenti benar sebelum ia mulai benar. Ini pemeriksaan bi-temporal,
    // bukan validasi kosmetik: `t_invalid < t_valid` membuat query "apa yang benar pada
    // waktu T" mengembalikan hasil yang mustahil.
    if (Date.parse(replacement.tValid) < Date.parse(old.tValid)) {
      throw new ContextError(
        `t_valid pengganti (${replacement.tValid}) mendahului t_valid fakta lama (${old.tValid}).`,
      );
    }

    return this.raw.transaction(() => {
      this.insertFactRow(replacement);
      this.raw
        .prepare("UPDATE facts SET t_invalid = ?, superseded_by = ? WHERE id = ?")
        .run(replacement.tValid, replacement.id, oldId);

      return { invalidated: supersede(old, replacement), replacement };
    })();
  }

  /**
   * "Lupakan" satu-klik dari panel Ai (`prd.md` §7) — invalidate fakta **tanpa pengganti**.
   * Beda dari `supersedeFact`: tidak ada fakta baru, jadi `supersededBy` tetap `null`.
   * Baris lama tetap ada (ADR-06) — hanya `t_invalid` yang berubah, dan alasan permintaan
   * dicatat di audit log Hub, bukan di sini (Context tidak memegang audit trail).
   */
  forgetFact(id: MemoryFactId, now: Timestamp): MemoryFact {
    const row = this.factRow(id, true);
    if (row === undefined) throw new FactNotFoundError(id);
    if (row.t_invalid !== null) throw new FactAlreadyInvalidatedError(id);

    const fact = rowToFact(row);
    // Invarian bi-temporal yang sama dengan supersedeFact: fakta tidak bisa berhenti
    // benar sebelum ia mulai benar.
    if (Date.parse(now) < Date.parse(fact.tValid)) {
      throw new ContextError(
        `Waktu forget (${now}) mendahului t_valid fakta (${fact.tValid}).`,
      );
    }

    this.raw.prepare("UPDATE facts SET t_invalid = ? WHERE id = ?").run(now, id);
    return { ...fact, tInvalid: now };
  }

  /** Salience naik tiap kali fakta dikonfirmasi ulang — sinyal ranking, bukan penghapusan. */
  setSalience(id: MemoryFactId, salience: number): void {
    if (salience < 0 || salience > 1) {
      throw new ContextError(`Salience harus di 0..1, diterima ${String(salience)}.`);
    }
    const changes = this.raw
      .prepare("UPDATE facts SET salience = ? WHERE id = ?")
      .run(salience, id).changes;
    if (changes === 0) throw new FactNotFoundError(id);
  }

  /**
   * Penjaga tingkat repository. Database juga menolaknya lewat trigger; keduanya ada
   * karena yang dilindungi bukan konsistensi data, tapi kemampuan menelusuri provenance —
   * dan itu hilang permanen begitu satu baris terhapus.
   */
  deleteFact(_id: MemoryFactId): never {
    throw new FactDeletionForbiddenError();
  }

  /**
   * Satu-satunya jalur sah yang boleh menghapus baris L1: membuang **seluruh** tier
   * turunan untuk diturunkan ulang dari L0. Sengaja bernama panjang dan sengaja membuka
   * flag eksplisit di `context_meta` — supaya "hapus satu fakta yang mengganggu" tidak
   * pernah bisa menyelinap lewat pintu ini.
   */
  rebuildDerivedTiers<T>(rebuild: (repo: this) => T): T {
    return this.raw.transaction(() => {
      this.raw
        .prepare(
          "INSERT INTO context_meta (key, value) VALUES ('allow_derived_rebuild', '1') " +
            "ON CONFLICT (key) DO UPDATE SET value = '1'",
        )
        .run();
      try {
        this.raw.exec("DELETE FROM facts");
        return rebuild(this);
      } finally {
        this.raw.prepare("DELETE FROM context_meta WHERE key = 'allow_derived_rebuild'").run();
      }
    })();
  }

  // -------------------------------------------------------------------------
  // Embedding
  // -------------------------------------------------------------------------

  putFactEmbedding(factId: MemoryFactId, embedding: Float32Array): void {
    if (this.vectors === undefined) {
      throw new ContextError(
        "Repository dibuat tanpa VectorIndex — embedding tidak bisa ditulis.",
      );
    }
    if (this.factRow(factId, true) === undefined) throw new FactNotFoundError(factId);
    this.vectors.upsert(factId, embedding);
  }

  // -------------------------------------------------------------------------
  // L2 — memori inti
  // -------------------------------------------------------------------------

  getCoreMemory(): CoreMemory {
    // Terurut label supaya render-nya deterministik: blok inti bagian dari prefix stabil,
    // dan urutan yang berubah membatalkan cache provider tanpa error apa pun (ADR-01).
    const rows = this.raw
      .prepare("SELECT * FROM core_memory ORDER BY label ASC")
      .all() as CoreMemoryRow[];

    return CoreMemorySchema.parse({ blocks: rows.map(rowToCoreBlock) });
  }

  getCoreMemoryBlock(label: string): CoreMemoryBlock | null {
    const row = this.raw.prepare("SELECT * FROM core_memory WHERE label = ?").get(label) as
      CoreMemoryRow | undefined;
    return row === undefined ? null : rowToCoreBlock(row);
  }

  setCoreMemoryBlock(
    input: CoreMemoryBlockInput,
    options: CoreMemoryWriteOptions,
  ): CoreMemoryBlock {
    const block = CoreMemoryBlockSchema.parse(input);
    const existing = this.getCoreMemoryBlock(block.label);

    if (!mayWriteCoreMemory(options.trust)) {
      // Hanya konsolidasi lokal yang boleh menyentuh L2 selain pengguna, dan tidak pernah
      // blok read-only. Sumber hosted/pihak ketiga tidak punya jalur ke sini sama sekali.
      if (options.trust !== "LOCAL_AGENT") {
        throw new CoreMemoryWriteForbiddenError(
          `Trust "${options.trust}" tidak boleh menulis memori inti — lewat karantina (ADR-07).`,
        );
      }
      if (existing?.readOnly === true || block.readOnly) {
        throw new CoreMemoryWriteForbiddenError(
          `Blok "${block.label}" read-only — hanya pengguna yang boleh menulisnya.`,
        );
      }
    }

    const othersChars = this.raw
      .prepare("SELECT COALESCE(SUM(LENGTH(value)), 0) AS n FROM core_memory WHERE label <> ?")
      .get(block.label) as { n: number };

    const total = othersChars.n + block.value.length;
    if (total > CORE_MEMORY_CHAR_LIMIT) throw new CoreMemoryLimitError(total);

    this.raw
      .prepare(
        `INSERT INTO core_memory (label, description, value, read_only, updated_at)
         VALUES (@label, @description, @value, @read_only, @updated_at)
         ON CONFLICT (label) DO UPDATE SET
           description = excluded.description,
           value = excluded.value,
           read_only = excluded.read_only,
           updated_at = excluded.updated_at`,
      )
      .run({
        label: block.label,
        description: block.description,
        value: block.value,
        read_only: block.readOnly ? 1 : 0,
        updated_at: block.updatedAt,
      });

    return block;
  }

  /** L2 adalah proyeksi yang bisa disunting manusia — menghapus blok di sini sah. */
  deleteCoreMemoryBlock(label: string, options: CoreMemoryWriteOptions): void {
    const existing = this.getCoreMemoryBlock(label);
    if (existing === null) return;
    if (existing.readOnly && !mayWriteCoreMemory(options.trust)) {
      throw new CoreMemoryWriteForbiddenError(
        `Blok "${label}" read-only — hanya pengguna yang boleh menghapusnya.`,
      );
    }
    this.raw.prepare("DELETE FROM core_memory WHERE label = ?").run(label);
  }

  // -------------------------------------------------------------------------
  // L3 — pointer artifact
  // -------------------------------------------------------------------------

  putArtifactPointer(input: ArtifactPointerInput): ArtifactPointer {
    const pointer = ArtifactPointerSchema.parse(input);

    this.raw
      .prepare(
        `INSERT INTO artifact_pointers (id, path, description, mime_type, size_bytes, scope, sensitivity)
         VALUES (@id, @path, @description, @mime_type, @size_bytes, @scope, @sensitivity)
         ON CONFLICT (id) DO UPDATE SET
           path = excluded.path,
           description = excluded.description,
           mime_type = excluded.mime_type,
           size_bytes = excluded.size_bytes,
           scope = excluded.scope,
           sensitivity = excluded.sensitivity`,
      )
      .run({
        id: pointer.id,
        path: pointer.path,
        description: pointer.description,
        mime_type: pointer.mimeType,
        size_bytes: pointer.sizeBytes,
        scope: pointer.scope,
        sensitivity: pointer.sensitivity,
      });

    return pointer;
  }

  listArtifactPointers(
    scopes: readonly Scope[],
    max: Sensitivity = "RESTRICTED",
  ): ArtifactPointer[] {
    if (scopes.length === 0) return [];
    const allowed = allowedSensitivities(max);

    const rows = this.raw
      .prepare(
        `SELECT * FROM artifact_pointers
         WHERE scope IN (${placeholders(scopes.length)})
           AND sensitivity IN (${placeholders(allowed.length)})
         ORDER BY id ASC`,
      )
      .all(...scopes, ...allowed) as ArtifactPointerRow[];

    return rows.map(rowToArtifactPointer);
  }
}
