/** Typed storage boundary for Context. L0 is append-only; L1 is rebuildable; L2/L3 remain user-owned projections. */
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

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
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
export class FactDeletionForbiddenError extends ContextError {
  constructor() {
    super(
      "Fakta tidak pernah dihapus (ADR-06). Pakai forgetFact(), supersedeFact(), atau rebuildDerivedTiers().",
    );
  }
}
export class CoreMemoryLimitError extends ContextError {
  constructor(chars: number) {
    super(
      `Memori inti ${String(chars)} karakter, melewati batas ~${String(CORE_MEMORY_TOKEN_LIMIT)} token (${String(CORE_MEMORY_CHAR_LIMIT)} karakter).`,
    );
  }
}
export class CoreMemoryWriteForbiddenError extends ContextError {}
export class ScopeEscalationError extends ContextError {
  constructor(from: Scope, to: Scope) {
    super(`Promosi karantina tidak boleh memindahkan scope: usulan "${from}" → fakta "${to}".`);
  }
}

export type AppendEpisodeInput = z.input<typeof EpisodeSchema>;
export type InsertFactInput = z.input<typeof MemoryFactSchema>;
export type ProposeFactInput = Omit<
  z.input<typeof QuarantinedWriteSchema>,
  "status" | "rejectionReason" | "reviewedAt"
>;
export type CoreMemoryBlockInput = z.input<typeof CoreMemoryBlockSchema>;
export type ArtifactPointerInput = z.input<typeof ArtifactPointerSchema>;
export interface FactLookupOptions {
  readonly includeInvalidated?: boolean | undefined;
}
export interface ListFactsFilter extends FactLookupOptions {
  readonly scopes?: readonly Scope[] | undefined;
  readonly subject?: string | undefined;
  readonly maxSensitivity?: Sensitivity | undefined;
  readonly hostedEligibleOnly?: boolean | undefined;
  readonly limit?: number | undefined;
}
export interface ListEpisodesFilter {
  readonly scopes?: readonly Scope[] | undefined;
  readonly sessionId?: string | undefined;
  readonly since?: Timestamp | undefined;
  readonly onlyUnconsolidated?: boolean | undefined;
  readonly hostedEligibleOnly?: boolean | undefined;
  readonly order?: "asc" | "desc" | undefined;
  readonly limit?: number | undefined;
}
export interface CoreMemoryFilter {
  readonly scopes?: readonly Scope[] | undefined;
  readonly maxSensitivity?: Sensitivity | undefined;
  readonly hostedEligibleOnly?: boolean | undefined;
}
export interface SupersedeResult {
  readonly invalidated: MemoryFact;
  readonly replacement: MemoryFact;
}
export interface CoreMemoryWriteOptions {
  readonly trust: Trust;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}
export function allowedSensitivities(max: Sensitivity): Sensitivity[] {
  return SENSITIVITY.filter((s) => sensitivityRank(s) <= sensitivityRank(max));
}
const DIRECT_L1_WRITE_TRUST: ReadonlySet<Trust> = new Set<Trust>(["USER", "LOCAL_AGENT"]);

export class ContextRepository {
  private readonly raw: SqliteDatabase;
  constructor(
    private readonly database: ContextDatabase,
    private readonly vectors?: VectorIndex | undefined,
  ) {
    this.raw = database.raw;
  }
  get db(): ContextDatabase {
    return this.database;
  }
  get vectorIndex(): VectorIndex | undefined {
    return this.vectors;
  }

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
    if (filter.sessionId !== undefined) {
      clauses.push("session_id = ?");
      params.push(filter.sessionId);
    }
    if (filter.since !== undefined) {
      clauses.push("ts >= ?");
      params.push(filter.since);
    }
    if (filter.onlyUnconsolidated === true) clauses.push("consolidated_at IS NULL");
    if (filter.hostedEligibleOnly === true)
      clauses.push("sync_class IN ('CLOUD_ALLOWED','PUBLIC')");
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const direction = filter.order === "desc" ? "DESC" : "ASC";
    const rows = this.raw
      .prepare(
        `SELECT * FROM episodes ${where} ORDER BY ts ${direction}, id ${direction} LIMIT ?`,
      )
      .all(...params, filter.limit ?? 200) as EpisodeRow[];
    return rows.map(rowToEpisode);
  }
  markEpisodeConsolidated(id: EpisodeId, summary: string | null, now: Timestamp): void {
    this.raw
      .prepare("UPDATE episodes SET summary = ?, consolidated_at = ? WHERE id = ?")
      .run(summary, now, id);
  }

  proposeFact(input: ProposeFactInput): MemoryFactId {
    const p = QuarantinedWriteSchema.parse({ ...input, status: "PENDING" });
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
        id: p.id,
        proposed_text: p.proposedText,
        proposed_at: p.proposedAt,
        ...provenanceParams(p.provenance),
        trust: p.trust,
        scope: p.scope,
      });
    return p.id;
  }
  getQuarantined(id: MemoryFactId): QuarantinedWrite | null {
    const row = this.raw.prepare("SELECT * FROM quarantine WHERE id = ?").get(id) as
      QuarantineRow | undefined;
    return row === undefined ? null : rowToQuarantined(row);
  }
  listQuarantine(status: QuarantinedWrite["status"] = "PENDING"): QuarantinedWrite[] {
    return (
      this.raw
        .prepare("SELECT * FROM quarantine WHERE status = ? ORDER BY proposed_at ASC, id ASC")
        .all(status) as QuarantineRow[]
    ).map(rowToQuarantined);
  }
  promoteFromQuarantine(
    quarantineId: MemoryFactId,
    factInput: InsertFactInput,
    now: Timestamp,
    options: { readonly supersedes?: MemoryFactId | undefined } = {},
  ): MemoryFact {
    const proposal = this.getQuarantined(quarantineId);
    if (proposal === null)
      throw new QuarantineStateError(`Usulan karantina tidak ditemukan: ${quarantineId}`);
    if (proposal.status !== "PENDING")
      throw new QuarantineStateError(
        `Usulan ${quarantineId} sudah berstatus ${proposal.status}.`,
      );
    const fact = MemoryFactSchema.parse(factInput);
    if (fact.scope !== proposal.scope)
      throw new ScopeEscalationError(proposal.scope, fact.scope);
    let old: MemoryFact | null = null;
    if (options.supersedes !== undefined) {
      old = this.getFact(options.supersedes, { includeInvalidated: true });
      if (old === null) throw new FactNotFoundError(options.supersedes);
      if (old.tInvalid !== null) throw new FactAlreadyInvalidatedError(options.supersedes);
      if (Date.parse(fact.tValid) < Date.parse(old.tValid))
        throw new ContextError("t_valid pengganti mendahului fakta lama.");
    }
    return this.raw.transaction(() => {
      this.insertFactRow(fact);
      if (old !== null)
        this.raw
          .prepare("UPDATE facts SET t_invalid = ?, superseded_by = ? WHERE id = ?")
          .run(fact.tValid, fact.id, old.id);
      this.raw
        .prepare(
          "UPDATE quarantine SET status='PROMOTED', reviewed_at=?, promoted_fact_id=?, rejection_reason=NULL WHERE id=?",
        )
        .run(now, fact.id, quarantineId);
      return fact;
    })();
  }
  rejectQuarantined(id: MemoryFactId, reason: string, now: Timestamp): void {
    const changes = this.raw
      .prepare(
        "UPDATE quarantine SET status='REJECTED', rejection_reason=?, reviewed_at=? WHERE id=? AND status='PENDING'",
      )
      .run(reason, now, id).changes;
    if (changes === 0)
      throw new QuarantineStateError(`Tidak ada usulan PENDING dengan id ${id} untuk ditolak.`);
  }

  private insertFactRow(fact: MemoryFact): void {
    this.raw
      .prepare(
        `INSERT INTO facts (
      id, subject, predicate, object, text, confidence, salience, source_episode_ids,
      t_valid, t_invalid, superseded_by, created_at, scope, sensitivity, sync_class, trust,
      source_app, session_id, tool_call_id, source_uri
    ) VALUES (
      @id, @subject, @predicate, @object, @text, @confidence, @salience, @source_episode_ids,
      @t_valid, @t_invalid, @superseded_by, @created_at, @scope, @sensitivity, @sync_class, @trust,
      @source_app, @session_id, @tool_call_id, @source_uri
    )`,
      )
      .run(factParams(fact));
  }
  insertFact(input: InsertFactInput): MemoryFact {
    const fact = MemoryFactSchema.parse(input);
    if (!DIRECT_L1_WRITE_TRUST.has(fact.trust)) throw new QuarantineRequiredError(fact.trust);
    this.insertFactRow(fact);
    return fact;
  }
  private factRow(id: MemoryFactId, includeInvalidated: boolean): FactRow | undefined {
    const live = includeInvalidated ? "" : "AND t_invalid IS NULL";
    return this.raw
      .prepare(`SELECT ${FACT_COLUMNS} FROM facts WHERE id = ? ${live}`)
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
    const live = (options.includeInvalidated ?? false) ? "" : "AND t_invalid IS NULL";
    const rows = this.raw
      .prepare(
        `SELECT ${FACT_COLUMNS} FROM facts WHERE id IN (${placeholders(ids.length)}) ${live}`,
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
    if (filter.hostedEligibleOnly === true)
      clauses.push("sync_class IN ('CLOUD_ALLOWED','PUBLIC')");
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    return (
      this.raw
        .prepare(
          `SELECT ${FACT_COLUMNS} FROM facts ${where} ORDER BY created_at DESC, id ASC LIMIT ?`,
        )
        .all(...params, filter.limit ?? 200) as FactRow[]
    ).map(rowToFact);
  }
  supersedeFact(oldId: MemoryFactId, newFactInput: InsertFactInput): SupersedeResult {
    const oldRow = this.factRow(oldId, true);
    if (oldRow === undefined) throw new FactNotFoundError(oldId);
    if (oldRow.t_invalid !== null) throw new FactAlreadyInvalidatedError(oldId);
    const old = rowToFact(oldRow);
    const replacement = MemoryFactSchema.parse(newFactInput);
    if (Date.parse(replacement.tValid) < Date.parse(old.tValid))
      throw new ContextError("t_valid pengganti mendahului fakta lama.");
    return this.raw.transaction(() => {
      this.insertFactRow(replacement);
      this.raw
        .prepare("UPDATE facts SET t_invalid=?, superseded_by=? WHERE id=?")
        .run(replacement.tValid, replacement.id, oldId);
      return { invalidated: supersede(old, replacement), replacement };
    })();
  }
  forgetFact(id: MemoryFactId, now: Timestamp): MemoryFact {
    const row = this.factRow(id, true);
    if (row === undefined) throw new FactNotFoundError(id);
    if (row.t_invalid !== null) throw new FactAlreadyInvalidatedError(id);
    const fact = rowToFact(row);
    if (Date.parse(now) < Date.parse(fact.tValid))
      throw new ContextError(
        `Waktu forget (${now}) mendahului t_valid fakta (${fact.tValid}).`,
      );
    this.raw.prepare("UPDATE facts SET t_invalid=? WHERE id=?").run(now, id);
    return { ...fact, tInvalid: now };
  }
  setSalience(id: MemoryFactId, salience: number): void {
    if (salience < 0 || salience > 1)
      throw new ContextError(`Salience harus di 0..1, diterima ${String(salience)}.`);
    if (
      this.raw.prepare("UPDATE facts SET salience=? WHERE id=?").run(salience, id).changes === 0
    )
      throw new FactNotFoundError(id);
  }
  deleteFact(_id: MemoryFactId): never {
    throw new FactDeletionForbiddenError();
  }

  /** Rebuild only L1 derived facts. User-edited L2 and Artifact-owned L3 are not destroyed here. */
  rebuildDerivedTiers<T>(rebuild: (repo: this) => T): T {
    return this.raw.transaction(() => {
      this.raw
        .prepare(
          "INSERT INTO context_meta (key,value) VALUES ('allow_derived_rebuild','1') ON CONFLICT(key) DO UPDATE SET value='1'",
        )
        .run();
      try {
        this.raw
          .prepare(
            "UPDATE quarantine SET promoted_fact_id = NULL WHERE promoted_fact_id IS NOT NULL",
          )
          .run();
        this.raw.exec("DELETE FROM facts");
        return rebuild(this);
      } finally {
        this.raw.prepare("DELETE FROM context_meta WHERE key='allow_derived_rebuild'").run();
      }
    })();
  }

  putFactEmbedding(factId: MemoryFactId, embedding: Float32Array): void {
    if (this.vectors === undefined)
      throw new ContextError(
        "Repository dibuat tanpa VectorIndex — embedding tidak bisa ditulis.",
      );
    if (this.factRow(factId, true) === undefined) throw new FactNotFoundError(factId);
    this.vectors.upsert(factId, embedding);
  }

  getCoreMemory(filter: CoreMemoryFilter = {}): CoreMemory {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filter.scopes !== undefined && filter.scopes.length > 0) {
      clauses.push(`scope IN (${placeholders(filter.scopes.length)})`);
      params.push(...filter.scopes);
    }
    if (filter.maxSensitivity !== undefined) {
      const allowed = allowedSensitivities(filter.maxSensitivity);
      clauses.push(`sensitivity IN (${placeholders(allowed.length)})`);
      params.push(...allowed);
    }
    if (filter.hostedEligibleOnly === true)
      clauses.push("sync_class IN ('CLOUD_ALLOWED','PUBLIC')");
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.raw
      .prepare(`SELECT * FROM core_memory ${where} ORDER BY label ASC`)
      .all(...params) as CoreMemoryRow[];
    return CoreMemorySchema.parse({ blocks: rows.map(rowToCoreBlock) });
  }
  getCoreMemoryBlock(label: string): CoreMemoryBlock | null {
    const row = this.raw.prepare("SELECT * FROM core_memory WHERE label=?").get(label) as
      CoreMemoryRow | undefined;
    return row === undefined ? null : rowToCoreBlock(row);
  }
  setCoreMemoryBlock(
    input: CoreMemoryBlockInput,
    options: CoreMemoryWriteOptions,
  ): CoreMemoryBlock {
    const block = CoreMemoryBlockSchema.parse({
      ...input,
      scope: input.scope ?? "personal",
      sensitivity: input.sensitivity ?? "INTERNAL",
      syncClass: input.syncClass ?? "LOCAL_ONLY",
      trust: options.trust,
    });
    const existing = this.getCoreMemoryBlock(block.label);
    if (!mayWriteCoreMemory(options.trust)) {
      if (options.trust !== "LOCAL_AGENT")
        throw new CoreMemoryWriteForbiddenError(
          `Trust "${options.trust}" tidak boleh menulis memori inti.`,
        );
      if (existing?.readOnly === true || block.readOnly)
        throw new CoreMemoryWriteForbiddenError(
          `Blok "${block.label}" read-only — hanya pengguna yang boleh menulisnya.`,
        );
    }
    const others = this.raw
      .prepare("SELECT COALESCE(SUM(LENGTH(value)),0) AS n FROM core_memory WHERE label <> ?")
      .get(block.label) as { n: number };
    const total = others.n + block.value.length;
    if (total > CORE_MEMORY_CHAR_LIMIT) throw new CoreMemoryLimitError(total);
    const scope = block.scope ?? "personal";
    const sensitivity = block.sensitivity ?? "INTERNAL";
    const syncClass = block.syncClass ?? "LOCAL_ONLY";
    const trust = block.trust ?? options.trust;
    this.raw
      .prepare(
        `INSERT INTO core_memory (label,description,value,read_only,updated_at,scope,sensitivity,sync_class,trust)
      VALUES (@label,@description,@value,@read_only,@updated_at,@scope,@sensitivity,@sync_class,@trust)
      ON CONFLICT(label) DO UPDATE SET description=excluded.description,value=excluded.value,read_only=excluded.read_only,
      updated_at=excluded.updated_at,scope=excluded.scope,sensitivity=excluded.sensitivity,sync_class=excluded.sync_class,trust=excluded.trust`,
      )
      .run({
        label: block.label,
        description: block.description,
        value: block.value,
        read_only: block.readOnly ? 1 : 0,
        updated_at: block.updatedAt,
        scope,
        sensitivity,
        sync_class: syncClass,
        trust,
      });
    return { ...block, scope, sensitivity, syncClass, trust };
  }
  deleteCoreMemoryBlock(label: string, options: CoreMemoryWriteOptions): void {
    const existing = this.getCoreMemoryBlock(label);
    if (existing === null) return;
    if (existing.readOnly && !mayWriteCoreMemory(options.trust))
      throw new CoreMemoryWriteForbiddenError(`Blok "${label}" read-only.`);
    this.raw.prepare("DELETE FROM core_memory WHERE label=?").run(label);
  }

  putArtifactPointer(input: ArtifactPointerInput): ArtifactPointer {
    const p = ArtifactPointerSchema.parse({
      ...input,
      syncClass: input.syncClass ?? "LOCAL_ONLY",
    });
    const syncClass = p.syncClass ?? "LOCAL_ONLY";
    this.raw
      .prepare(
        `INSERT INTO artifact_pointers (id,path,description,mime_type,size_bytes,scope,sensitivity,sync_class)
      VALUES (@id,@path,@description,@mime_type,@size_bytes,@scope,@sensitivity,@sync_class)
      ON CONFLICT(id) DO UPDATE SET path=excluded.path,description=excluded.description,mime_type=excluded.mime_type,
      size_bytes=excluded.size_bytes,scope=excluded.scope,sensitivity=excluded.sensitivity,sync_class=excluded.sync_class`,
      )
      .run({
        id: p.id,
        path: p.path,
        description: p.description,
        mime_type: p.mimeType,
        size_bytes: p.sizeBytes,
        scope: p.scope,
        sensitivity: p.sensitivity,
        sync_class: syncClass,
      });
    return { ...p, syncClass };
  }
  listArtifactPointers(
    scopes: readonly Scope[],
    max: Sensitivity = "RESTRICTED",
    hostedEligibleOnly = false,
  ): ArtifactPointer[] {
    if (scopes.length === 0) return [];
    const allowed = allowedSensitivities(max);
    const egress = hostedEligibleOnly ? " AND sync_class IN ('CLOUD_ALLOWED','PUBLIC')" : "";
    const rows = this.raw
      .prepare(
        `SELECT * FROM artifact_pointers WHERE scope IN (${placeholders(scopes.length)}) AND sensitivity IN (${placeholders(allowed.length)})${egress} ORDER BY id ASC`,
      )
      .all(...scopes, ...allowed) as ArtifactPointerRow[];
    return rows.map(rowToArtifactPointer);
  }
}
