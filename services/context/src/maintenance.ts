import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MemoryFact, Timestamp } from "@ecorione/shared-schema";
import { runConsolidation } from "./consolidate.js";
import { openContextDatabase } from "./db.js";
import { loadMigrations, migrate } from "./migrate.js";
import { ContextRepository } from "./repository.js";
import type { SqliteDatabase } from "./sqlite.js";

export const MAINTENANCE_ACTIONS = [
  "migrate",
  "normalize-metadata",
  "dedupe-facts",
  "rebuild-l1",
  "rebuild-fts",
  "reindex-vector",
  "verify",
] as const;
export type MaintenanceAction = (typeof MAINTENANCE_ACTIONS)[number];

const ACTION_ORDER = new Map(MAINTENANCE_ACTIONS.map((action, index) => [action, index]));
const PLAN_SCHEMA = "ecorione.context-maintenance/v1" as const;
const MAX_INTERNAL_ROWS = 1_000_000;

interface SourceRow {
  readonly id: string;
  readonly ts: string;
  readonly raw_text: string;
  readonly source_app: string;
  readonly session_id: string | null;
  readonly tool_call_id: string | null;
  readonly source_uri: string | null;
  readonly scope: string;
  readonly sensitivity: string;
  readonly sync_class: string;
  readonly trust: string;
}

interface EpisodeProjectionRow {
  readonly id: string;
  readonly summary: string | null;
  readonly consolidated_at: string | null;
}

interface EmbeddingRow {
  readonly fact_id: string;
  readonly model: string;
  readonly dim: number;
  readonly embedding: Buffer;
}

interface QuarantinePromotionRow {
  readonly id: string;
  readonly promoted_fact_id: string;
}

interface ReceiptRow {
  readonly id: string;
  readonly operation_id: string;
  readonly kind: "EXECUTE" | "ROLLBACK";
  readonly actions_json: string;
  readonly plan_digest: string;
  readonly source_digest_before: string;
  readonly source_digest_after: string | null;
  readonly projection_digest_before: string;
  readonly projection_digest_after: string | null;
  readonly snapshot_path: string | null;
  readonly status: "SUCCEEDED" | "FAILED";
  readonly requested_at: string;
  readonly completed_at: string;
  readonly details_json: string;
}

export interface MaintenanceFindings {
  readonly episodes: number;
  readonly facts: number;
  readonly embeddings: number;
  readonly normalizableFacts: number;
  readonly duplicateLiveDerivedGroups: number;
  readonly orphanEpisodeReferences: number;
  readonly orphanSupersedeReferences: number;
  readonly orphanEmbeddingReferences: number;
  readonly orphanQuarantinePromotions: number;
  readonly foreignKeyViolations: number;
  readonly quickCheck: string;
  readonly ftsIntegrity: "ok" | "error";
}

export interface MaintenancePlan {
  readonly schema: typeof PLAN_SCHEMA;
  readonly operationId: string;
  readonly generatedAt: Timestamp;
  readonly actions: readonly MaintenanceAction[];
  readonly sourceDigest: string;
  readonly projectionDigest: string;
  readonly migration: {
    readonly currentVersion: number;
    readonly targetVersion: number;
    readonly pendingVersions: readonly number[];
  };
  readonly findings: MaintenanceFindings;
  readonly diff: {
    readonly pendingMigrationVersions: readonly number[];
    readonly normalizableFacts: number;
    readonly duplicateLiveDerivedGroups: number;
    readonly rebuildL1: boolean;
    readonly rebuildFts: boolean;
    readonly reindexVector: boolean;
  };
  readonly rebuildL1RequiresLocalExtraction: boolean;
  readonly planDigest: string;
}

export interface MaintenanceReceipt {
  readonly id: string;
  readonly operationId: string;
  readonly kind: "EXECUTE" | "ROLLBACK";
  readonly actions: readonly MaintenanceAction[];
  readonly planDigest: string;
  readonly sourceDigestBefore: string;
  readonly sourceDigestAfter: string | null;
  readonly projectionDigestBefore: string;
  readonly projectionDigestAfter: string | null;
  readonly snapshotPath: string | null;
  readonly status: "SUCCEEDED" | "FAILED";
  readonly requestedAt: string;
  readonly completedAt: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export class MaintenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class MaintenanceConflictError extends MaintenanceError {}
export class MaintenanceIntegrityError extends MaintenanceError {}
export class MaintenanceSnapshotError extends MaintenanceError {}

export interface ContextMaintenanceOptions {
  readonly extractLocal?: ((prompt: string) => Promise<string>) | undefined;
  readonly snapshotDir?: string | undefined;
}

interface PreparedL1 {
  readonly facts: readonly MemoryFact[];
  readonly episodes: readonly EpisodeProjectionRow[];
  readonly consolidation: {
    readonly processed: number;
    readonly promoted: number;
    readonly quarantined: number;
    readonly rejected: number;
  };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function canonicalFactKey(
  fact: Pick<MemoryFact, "scope" | "subject" | "predicate" | "object">,
): string {
  return [fact.scope, fact.subject, fact.predicate, fact.object]
    .map((value) => normalizeWhitespace(value).toLocaleLowerCase("en-US"))
    .join("\u001f");
}

function canonicalActions(actions: readonly MaintenanceAction[]): MaintenanceAction[] {
  const unique = [...new Set(actions)];
  unique.sort((a, b) => (ACTION_ORDER.get(a) ?? 999) - (ACTION_ORDER.get(b) ?? 999));
  return unique;
}

function sourceRows(raw: SqliteDatabase): SourceRow[] {
  return raw
    .prepare(
      `SELECT id,ts,raw_text,source_app,session_id,tool_call_id,source_uri,
              scope,sensitivity,sync_class,trust
       FROM episodes ORDER BY id ASC`,
    )
    .all() as SourceRow[];
}

export function contextSourceDigest(raw: SqliteDatabase): string {
  return hashJson(sourceRows(raw));
}

function episodeProjectionRows(raw: SqliteDatabase): EpisodeProjectionRow[] {
  return raw
    .prepare("SELECT id,summary,consolidated_at FROM episodes ORDER BY id ASC")
    .all() as EpisodeProjectionRow[];
}

function embeddingDigestRows(raw: SqliteDatabase): readonly unknown[] {
  return raw
    .prepare(
      "SELECT fact_id,model,dim,hex(embedding) AS embedding_hex FROM fact_embeddings ORDER BY fact_id ASC",
    )
    .all() as readonly unknown[];
}

export function contextProjectionDigest(repo: ContextRepository): string {
  const facts = repo.listFacts({ includeInvalidated: true, limit: MAX_INTERNAL_ROWS });
  return hashJson({
    facts,
    episodeProjection: episodeProjectionRows(repo.db.raw),
    embeddings: embeddingDigestRows(repo.db.raw),
  });
}

function schemaVersions(raw: SqliteDatabase): number[] {
  return (
    raw.prepare("SELECT version FROM schema_migrations ORDER BY version ASC").all() as {
      version: number;
    }[]
  ).map((row) => row.version);
}

function countOrphans(
  raw: SqliteDatabase,
): Pick<
  MaintenanceFindings,
  | "orphanEpisodeReferences"
  | "orphanSupersedeReferences"
  | "orphanEmbeddingReferences"
  | "orphanQuarantinePromotions"
> {
  const episodeIds = new Set(
    (raw.prepare("SELECT id FROM episodes").all() as { id: string }[]).map((row) => row.id),
  );
  let orphanEpisodeReferences = 0;
  const encodedSources = raw.prepare("SELECT source_episode_ids FROM facts").all() as {
    source_episode_ids: string;
  }[];
  for (const row of encodedSources) {
    try {
      const ids = JSON.parse(row.source_episode_ids) as unknown;
      if (!Array.isArray(ids)) {
        orphanEpisodeReferences += 1;
        continue;
      }
      for (const id of ids) {
        if (typeof id !== "string" || !episodeIds.has(id)) orphanEpisodeReferences += 1;
      }
    } catch {
      orphanEpisodeReferences += 1;
    }
  }
  const orphanSupersedeReferences = Number(
    (
      raw
        .prepare(
          `SELECT COUNT(*) AS n FROM facts f
           LEFT JOIN facts target ON target.id=f.superseded_by
           WHERE f.superseded_by IS NOT NULL AND target.id IS NULL`,
        )
        .get() as { n: number }
    ).n,
  );
  const orphanEmbeddingReferences = Number(
    (
      raw
        .prepare(
          `SELECT COUNT(*) AS n FROM fact_embeddings e
           LEFT JOIN facts f ON f.id=e.fact_id WHERE f.id IS NULL`,
        )
        .get() as { n: number }
    ).n,
  );
  const orphanQuarantinePromotions = Number(
    (
      raw
        .prepare(
          `SELECT COUNT(*) AS n FROM quarantine q
           LEFT JOIN facts f ON f.id=q.promoted_fact_id
           WHERE q.promoted_fact_id IS NOT NULL AND f.id IS NULL`,
        )
        .get() as { n: number }
    ).n,
  );
  return {
    orphanEpisodeReferences,
    orphanSupersedeReferences,
    orphanEmbeddingReferences,
    orphanQuarantinePromotions,
  };
}

function inspectFts(raw: SqliteDatabase): "ok" | "error" {
  try {
    raw.prepare("INSERT INTO facts_fts(facts_fts, rank) VALUES('integrity-check', 1)").run();
    return "ok";
  } catch {
    return "error";
  }
}

export function inspectContext(repo: ContextRepository): MaintenanceFindings {
  const raw = repo.db.raw;
  const facts = repo.listFacts({ includeInvalidated: true, limit: MAX_INTERNAL_ROWS });
  let normalizableFacts = 0;
  const liveDerivedGroups = new Map<string, number>();
  for (const fact of facts) {
    const normalizedSubject = normalizeWhitespace(fact.subject);
    const normalizedPredicate = normalizeWhitespace(fact.predicate);
    const normalizedObject = normalizeWhitespace(fact.object);
    const normalizedText = `${normalizedSubject} ${normalizedPredicate} ${normalizedObject}`;
    const canonicalSources = [...new Set(fact.sourceEpisodeIds)].sort();
    if (
      fact.trust === "LOCAL_AGENT" &&
      (normalizedSubject !== fact.subject ||
        normalizedPredicate !== fact.predicate ||
        normalizedObject !== fact.object ||
        normalizedText !== fact.text ||
        JSON.stringify(canonicalSources) !== JSON.stringify(fact.sourceEpisodeIds))
    ) {
      normalizableFacts += 1;
    }
    if (fact.trust === "LOCAL_AGENT" && fact.tInvalid === null) {
      const key = canonicalFactKey(fact);
      liveDerivedGroups.set(key, (liveDerivedGroups.get(key) ?? 0) + 1);
    }
  }
  const quickRows = raw.pragma("quick_check") as { quick_check: string }[];
  const quickCheck = quickRows.map((row) => row.quick_check).join("; ") || "unknown";
  const foreignKeyViolations = (raw.pragma("foreign_key_check") as unknown[]).length;
  const embeddings = Number(
    (raw.prepare("SELECT COUNT(*) AS n FROM fact_embeddings").get() as { n: number }).n,
  );
  return {
    episodes: sourceRows(raw).length,
    facts: facts.length,
    embeddings,
    normalizableFacts,
    duplicateLiveDerivedGroups: [...liveDerivedGroups.values()].filter((count) => count > 1)
      .length,
    ...countOrphans(raw),
    foreignKeyViolations,
    quickCheck,
    ftsIntegrity: inspectFts(raw),
  };
}

function assertIntegrity(
  findings: MaintenanceFindings,
  options: { readonly allowFtsError?: boolean } = {},
): void {
  const failures: string[] = [];
  if (findings.quickCheck !== "ok") failures.push(`quick_check=${findings.quickCheck}`);
  if (findings.foreignKeyViolations > 0)
    failures.push(`foreign_key_violations=${String(findings.foreignKeyViolations)}`);
  if (findings.orphanEpisodeReferences > 0)
    failures.push(`orphan_episode_refs=${String(findings.orphanEpisodeReferences)}`);
  if (findings.orphanSupersedeReferences > 0)
    failures.push(`orphan_supersede_refs=${String(findings.orphanSupersedeReferences)}`);
  if (findings.orphanEmbeddingReferences > 0)
    failures.push(`orphan_embedding_refs=${String(findings.orphanEmbeddingReferences)}`);
  if (findings.orphanQuarantinePromotions > 0)
    failures.push(
      `orphan_quarantine_promotions=${String(findings.orphanQuarantinePromotions)}`,
    );
  if (findings.ftsIntegrity !== "ok" && options.allowFtsError !== true)
    failures.push("fts_integrity=error");
  if (failures.length > 0) {
    throw new MaintenanceIntegrityError(`Context integrity gagal: ${failures.join(", ")}.`);
  }
}

function receiptFromRow(row: ReceiptRow): MaintenanceReceipt {
  return {
    id: row.id,
    operationId: row.operation_id,
    kind: row.kind,
    actions: JSON.parse(row.actions_json) as MaintenanceAction[],
    planDigest: row.plan_digest,
    sourceDigestBefore: row.source_digest_before,
    sourceDigestAfter: row.source_digest_after,
    projectionDigestBefore: row.projection_digest_before,
    projectionDigestAfter: row.projection_digest_after,
    snapshotPath: row.snapshot_path,
    status: row.status,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    details: JSON.parse(row.details_json) as Record<string, unknown>,
  };
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

export class ContextMaintenanceEngine {
  constructor(
    private readonly repo: ContextRepository,
    private readonly options: ContextMaintenanceOptions = {},
  ) {}

  verify(): MaintenanceFindings {
    const findings = inspectContext(this.repo);
    assertIntegrity(findings);
    return findings;
  }

  plan(input: {
    readonly operationId: string;
    readonly actions: readonly MaintenanceAction[];
    readonly now: Timestamp;
  }): MaintenancePlan {
    const actions = canonicalActions(input.actions);
    if (actions.length === 0)
      throw new MaintenanceError("Maintenance plan membutuhkan action.");
    if (
      actions.includes("rebuild-l1") &&
      (actions.includes("normalize-metadata") || actions.includes("dedupe-facts"))
    ) {
      throw new MaintenanceConflictError(
        "rebuild-l1 tidak boleh digabung dengan normalize/dedupe yang akan langsung tertimpa.",
      );
    }
    const applied = schemaVersions(this.repo.db.raw);
    const available = loadMigrations().map((migration) => migration.version);
    const appliedSet = new Set(applied);
    const targetVersion = Math.max(0, ...available);
    const findings = inspectContext(this.repo);
    const pendingVersions = available.filter((version) => !appliedSet.has(version));
    const unsigned = {
      schema: PLAN_SCHEMA,
      operationId: input.operationId,
      generatedAt: input.now,
      actions,
      sourceDigest: contextSourceDigest(this.repo.db.raw),
      projectionDigest: contextProjectionDigest(this.repo),
      migration: {
        currentVersion: Math.max(0, ...applied),
        targetVersion,
        pendingVersions,
      },
      findings,
      diff: {
        pendingMigrationVersions: pendingVersions,
        normalizableFacts: actions.includes("normalize-metadata")
          ? findings.normalizableFacts
          : 0,
        duplicateLiveDerivedGroups: actions.includes("dedupe-facts")
          ? findings.duplicateLiveDerivedGroups
          : 0,
        rebuildL1: actions.includes("rebuild-l1"),
        rebuildFts: actions.includes("rebuild-fts") || actions.includes("rebuild-l1"),
        reindexVector: actions.includes("reindex-vector") || actions.includes("rebuild-l1"),
      },
      rebuildL1RequiresLocalExtraction: actions.includes("rebuild-l1"),
    };
    return { ...unsigned, planDigest: hashJson(unsigned) };
  }

  private assertPlan(plan: MaintenancePlan): void {
    if (plan.schema !== PLAN_SCHEMA) {
      throw new MaintenanceConflictError("Maintenance plan schema tidak valid.");
    }
    const expected = this.plan({
      operationId: plan.operationId,
      actions: plan.actions,
      now: plan.generatedAt,
    });
    if (expected.planDigest !== plan.planDigest) {
      if (expected.sourceDigest !== plan.sourceDigest) {
        throw new MaintenanceConflictError(
          "Context L0 berubah setelah dry-run; buat plan baru.",
        );
      }
      if (expected.projectionDigest !== plan.projectionDigest) {
        throw new MaintenanceConflictError(
          "Context projection berubah setelah dry-run; buat plan baru.",
        );
      }
      throw new MaintenanceConflictError("Maintenance plan digest tidak valid.");
    }
  }

  private snapshotDirectory(): string {
    if (this.options.snapshotDir !== undefined) return this.options.snapshotDir;
    if (this.repo.db.path === ":memory:") {
      throw new MaintenanceSnapshotError(
        "Execute/rollback membutuhkan file-backed Context DB.",
      );
    }
    return join(dirname(this.repo.db.path), "context-maintenance-snapshots");
  }

  private async createSnapshot(operationId: string, now: Timestamp): Promise<string> {
    if (this.repo.db.path === ":memory:") {
      throw new MaintenanceSnapshotError("Snapshot tidak didukung untuk Context DB in-memory.");
    }
    const directory = this.snapshotDirectory();
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `${safeSegment(operationId)}-${safeSegment(now)}.sqlite`);
    if (existsSync(path)) throw new MaintenanceConflictError(`Snapshot sudah ada: ${path}`);
    await this.repo.db.raw.backup(path);
    chmodSync(path, 0o600);
    return path;
  }

  private getReceiptByOperation(operationId: string): MaintenanceReceipt | null {
    const row = this.repo.db.raw
      .prepare("SELECT * FROM context_maintenance_receipts WHERE operation_id=?")
      .get(operationId) as ReceiptRow | undefined;
    return row === undefined ? null : receiptFromRow(row);
  }

  getReceipt(id: string): MaintenanceReceipt | null {
    const row = this.repo.db.raw
      .prepare("SELECT * FROM context_maintenance_receipts WHERE id=?")
      .get(id) as ReceiptRow | undefined;
    return row === undefined ? null : receiptFromRow(row);
  }

  listReceipts(limit = 100): MaintenanceReceipt[] {
    const bounded = Math.max(1, Math.min(limit, 500));
    return (
      this.repo.db.raw
        .prepare(
          "SELECT * FROM context_maintenance_receipts ORDER BY completed_at DESC,id ASC LIMIT ?",
        )
        .all(bounded) as ReceiptRow[]
    ).map(receiptFromRow);
  }

  private storeReceipt(receipt: MaintenanceReceipt): MaintenanceReceipt {
    this.repo.db.raw
      .prepare(
        `INSERT INTO context_maintenance_receipts (
          id,operation_id,kind,actions_json,plan_digest,source_digest_before,source_digest_after,
          projection_digest_before,projection_digest_after,snapshot_path,status,requested_at,completed_at,details_json
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        receipt.id,
        receipt.operationId,
        receipt.kind,
        JSON.stringify(receipt.actions),
        receipt.planDigest,
        receipt.sourceDigestBefore,
        receipt.sourceDigestAfter,
        receipt.projectionDigestBefore,
        receipt.projectionDigestAfter,
        receipt.snapshotPath,
        receipt.status,
        receipt.requestedAt,
        receipt.completedAt,
        JSON.stringify(receipt.details),
      );
    return receipt;
  }

  private normalizeDerivedFacts(): number {
    const raw = this.repo.db.raw;
    const facts = this.repo.listFacts({ includeInvalidated: true, limit: MAX_INTERNAL_ROWS });
    let changed = 0;
    raw.transaction(() => {
      const update = raw.prepare(
        `UPDATE facts SET subject=?,predicate=?,object=?,text=?,source_episode_ids=? WHERE id=?`,
      );
      for (const fact of facts) {
        if (fact.trust !== "LOCAL_AGENT") continue;
        const subject = normalizeWhitespace(fact.subject);
        const predicate = normalizeWhitespace(fact.predicate);
        const object = normalizeWhitespace(fact.object);
        const text = `${subject} ${predicate} ${object}`;
        const sources = [...new Set(fact.sourceEpisodeIds)].sort();
        if (
          subject === fact.subject &&
          predicate === fact.predicate &&
          object === fact.object &&
          text === fact.text &&
          JSON.stringify(sources) === JSON.stringify(fact.sourceEpisodeIds)
        ) {
          continue;
        }
        update.run(subject, predicate, object, text, JSON.stringify(sources), fact.id);
        changed += 1;
      }
    })();
    return changed;
  }

  private dedupeDerivedFacts(now: Timestamp): { groups: number; invalidated: number } {
    const raw = this.repo.db.raw;
    const live = this.repo
      .listFacts({ includeInvalidated: false, limit: MAX_INTERNAL_ROWS })
      .filter((fact) => fact.trust === "LOCAL_AGENT");
    const groups = new Map<string, MemoryFact[]>();
    for (const fact of live) {
      const key = canonicalFactKey(fact);
      const group = groups.get(key) ?? [];
      group.push(fact);
      groups.set(key, group);
    }
    let changedGroups = 0;
    let invalidated = 0;
    raw.transaction(() => {
      const updateWinner = raw.prepare(
        "UPDATE facts SET confidence=?,salience=?,source_episode_ids=? WHERE id=?",
      );
      const invalidate = raw.prepare("UPDATE facts SET t_invalid=?,superseded_by=? WHERE id=?");
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        group.sort(
          (a, b) =>
            Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
        );
        const winner = group[0];
        if (winner === undefined) continue;
        const duplicates = group.slice(1);
        const sources = [...new Set(group.flatMap((fact) => fact.sourceEpisodeIds))].sort();
        updateWinner.run(
          Math.max(...group.map((fact) => fact.confidence)),
          Math.max(...group.map((fact) => fact.salience)),
          JSON.stringify(sources),
          winner.id,
        );
        for (const duplicate of duplicates) {
          const invalidAt =
            Date.parse(now) >= Date.parse(duplicate.tValid) ? now : duplicate.tValid;
          invalidate.run(invalidAt, winner.id, duplicate.id);
          invalidated += 1;
        }
        changedGroups += 1;
      }
    })();
    return { groups: changedGroups, invalidated };
  }

  private rebuildFts(): void {
    this.repo.db.raw.prepare("INSERT INTO facts_fts(facts_fts) VALUES('rebuild')").run();
  }

  private async prepareL1Rebuild(now: Timestamp): Promise<PreparedL1> {
    if (this.options.extractLocal === undefined) {
      throw new MaintenanceError(
        "rebuild-l1 membutuhkan Context local extractor melalui Connect.",
      );
    }
    const stagingDb = openContextDatabase({ path: ":memory:" });
    try {
      const stagingRepo = new ContextRepository(stagingDb);
      const sourceEpisodes = this.repo.listEpisodes({ order: "asc", limit: MAX_INTERNAL_ROWS });
      for (const episode of sourceEpisodes) {
        stagingRepo.appendEpisode({
          ...episode,
          summary: null,
          consolidatedAt: null,
        });
      }
      let processed = 0;
      let promoted = 0;
      let quarantined = 0;
      let rejected = 0;
      for (;;) {
        const result = await runConsolidation(
          { repo: stagingRepo, extractLocal: this.options.extractLocal },
          { now, limit: 20 },
        );
        if (result.processed === 0) break;
        processed += result.processed;
        promoted += result.promoted;
        quarantined += result.quarantined;
        rejected += result.rejected;
        if (result.errors.length > 0) {
          throw new MaintenanceError(`Staging L1 rebuild gagal: ${result.errors.join(" | ")}`);
        }
      }
      return {
        facts: stagingRepo.listFacts({ includeInvalidated: true, limit: MAX_INTERNAL_ROWS }),
        episodes: episodeProjectionRows(stagingDb.raw),
        consolidation: { processed, promoted, quarantined, rejected },
      };
    } finally {
      stagingDb.close();
    }
  }

  private applyPreparedL1(prepared: PreparedL1): {
    factsWritten: number;
    embeddingsDropped: number;
  } {
    const raw = this.repo.db.raw;
    const embeddingsDropped = Number(
      (raw.prepare("SELECT COUNT(*) AS n FROM fact_embeddings").get() as { n: number }).n,
    );
    this.repo.rebuildDerivedTiers((repo) => {
      raw.pragma("defer_foreign_keys = ON");
      for (const fact of prepared.facts) repo.insertFact(fact);
      const updateEpisode = raw.prepare(
        "UPDATE episodes SET summary=?,consolidated_at=? WHERE id=?",
      );
      for (const episode of prepared.episodes) {
        updateEpisode.run(episode.summary, episode.consolidated_at, episode.id);
      }
    });
    return { factsWritten: prepared.facts.length, embeddingsDropped };
  }

  async execute(plan: MaintenancePlan): Promise<MaintenanceReceipt> {
    const existing = this.getReceiptByOperation(plan.operationId);
    if (existing !== null) {
      if (existing.planDigest === plan.planDigest && existing.status === "SUCCEEDED")
        return existing;
      throw new MaintenanceConflictError(
        `Operation ${plan.operationId} sudah memiliki receipt ${existing.status}.`,
      );
    }
    this.assertPlan(plan);
    assertIntegrity(plan.findings, { allowFtsError: plan.actions.includes("rebuild-fts") });
    const prepared = plan.actions.includes("rebuild-l1")
      ? await this.prepareL1Rebuild(plan.generatedAt)
      : null;
    this.assertPlan(plan);
    const sourceBefore = plan.sourceDigest;
    const projectionBefore = plan.projectionDigest;
    let snapshotPath: string | null = null;
    const details: Record<string, unknown> = {};
    try {
      snapshotPath = await this.createSnapshot(plan.operationId, plan.generatedAt);
      if (plan.actions.includes("migrate")) details.migration = migrate(this.repo.db.raw);
      if (plan.actions.includes("normalize-metadata")) {
        details.normalizedFacts = this.normalizeDerivedFacts();
      }
      if (plan.actions.includes("dedupe-facts")) {
        details.dedupe = this.dedupeDerivedFacts(plan.generatedAt);
      }
      if (prepared !== null) {
        details.l1Rebuild = {
          ...prepared.consolidation,
          ...this.applyPreparedL1(prepared),
        };
      }
      if (plan.actions.includes("rebuild-fts") || prepared !== null) this.rebuildFts();
      if (plan.actions.includes("reindex-vector") || prepared !== null) {
        this.repo.vectorIndex?.rebuild();
        details.vectorReindexed = this.repo.vectorIndex !== undefined;
      }
      const findingsAfter = this.verify();
      const sourceAfter = contextSourceDigest(this.repo.db.raw);
      if (sourceAfter !== sourceBefore) {
        throw new MaintenanceIntegrityError(
          "Immutable Context L0 digest berubah saat maintenance.",
        );
      }
      const receipt: MaintenanceReceipt = {
        id: `maint_${hashJson([plan.operationId, plan.planDigest]).slice(0, 24)}`,
        operationId: plan.operationId,
        kind: "EXECUTE",
        actions: plan.actions,
        planDigest: plan.planDigest,
        sourceDigestBefore: sourceBefore,
        sourceDigestAfter: sourceAfter,
        projectionDigestBefore: projectionBefore,
        projectionDigestAfter: contextProjectionDigest(this.repo),
        snapshotPath,
        status: "SUCCEEDED",
        requestedAt: plan.generatedAt,
        completedAt: plan.generatedAt,
        details: { ...details, findingsAfter },
      };
      return this.storeReceipt(receipt);
    } catch (error) {
      const failed: MaintenanceReceipt = {
        id: `maint_${hashJson([plan.operationId, plan.planDigest, "failed"]).slice(0, 24)}`,
        operationId: plan.operationId,
        kind: "EXECUTE",
        actions: plan.actions,
        planDigest: plan.planDigest,
        sourceDigestBefore: sourceBefore,
        sourceDigestAfter: contextSourceDigest(this.repo.db.raw),
        projectionDigestBefore: projectionBefore,
        projectionDigestAfter: contextProjectionDigest(this.repo),
        snapshotPath,
        status: "FAILED",
        requestedAt: plan.generatedAt,
        completedAt: plan.generatedAt,
        details: { error: error instanceof Error ? error.message : String(error), ...details },
      };
      try {
        this.storeReceipt(failed);
      } catch {
        // Preserve the original failure when receipt persistence is itself unavailable.
      }
      throw error;
    }
  }

  async rollback(input: {
    readonly operationId: string;
    readonly sourceReceiptId: string;
    readonly now: Timestamp;
  }): Promise<MaintenanceReceipt> {
    const existing = this.getReceiptByOperation(input.operationId);
    if (existing !== null) return existing;
    const sourceReceipt = this.getReceipt(input.sourceReceiptId);
    if (
      sourceReceipt === null ||
      sourceReceipt.kind !== "EXECUTE" ||
      sourceReceipt.snapshotPath === null
    ) {
      throw new MaintenanceSnapshotError(
        "Source receipt tidak memiliki snapshot rollback yang valid.",
      );
    }
    if (!existsSync(sourceReceipt.snapshotPath)) {
      throw new MaintenanceSnapshotError("Snapshot rollback tidak ditemukan di owner storage.");
    }
    const snapshotDb = openContextDatabase({
      path: sourceReceipt.snapshotPath,
      readonly: true,
      runMigrations: false,
    });
    let safetySnapshot: string | null = null;
    const sourceBefore = contextSourceDigest(this.repo.db.raw);
    const projectionBefore = contextProjectionDigest(this.repo);
    try {
      const snapshotSource = contextSourceDigest(snapshotDb.raw);
      if (snapshotSource !== sourceBefore) {
        throw new MaintenanceConflictError(
          "Context L0 sudah berubah sejak snapshot; rollback projection ditolak. Gunakan rebuild dari L0 terbaru.",
        );
      }
      const snapshotRepo = new ContextRepository(snapshotDb);
      const snapshotFacts = snapshotRepo.listFacts({
        includeInvalidated: true,
        limit: MAX_INTERNAL_ROWS,
      });
      const snapshotEpisodes = episodeProjectionRows(snapshotDb.raw);
      const snapshotEmbeddings = snapshotDb.raw
        .prepare("SELECT fact_id,model,dim,embedding FROM fact_embeddings ORDER BY fact_id")
        .all() as EmbeddingRow[];
      const snapshotPromotions = snapshotDb.raw
        .prepare(
          "SELECT id,promoted_fact_id FROM quarantine WHERE promoted_fact_id IS NOT NULL ORDER BY id",
        )
        .all() as QuarantinePromotionRow[];
      safetySnapshot = await this.createSnapshot(input.operationId, input.now);
      const raw = this.repo.db.raw;
      this.repo.rebuildDerivedTiers((repo) => {
        raw.pragma("defer_foreign_keys = ON");
        for (const fact of snapshotFacts) repo.insertFact(fact);
        const insertEmbedding = raw.prepare(
          "INSERT INTO fact_embeddings(fact_id,model,dim,embedding) VALUES(?,?,?,?)",
        );
        for (const embedding of snapshotEmbeddings) {
          insertEmbedding.run(
            embedding.fact_id,
            embedding.model,
            embedding.dim,
            embedding.embedding,
          );
        }
        const updateEpisode = raw.prepare(
          "UPDATE episodes SET summary=?,consolidated_at=? WHERE id=?",
        );
        for (const episode of snapshotEpisodes) {
          updateEpisode.run(episode.summary, episode.consolidated_at, episode.id);
        }
        const restorePromotion = raw.prepare(
          "UPDATE quarantine SET promoted_fact_id=? WHERE id=?",
        );
        for (const promotion of snapshotPromotions) {
          restorePromotion.run(promotion.promoted_fact_id, promotion.id);
        }
      });
      this.rebuildFts();
      this.repo.vectorIndex?.rebuild();
      const findingsAfter = this.verify();
      const sourceAfter = contextSourceDigest(this.repo.db.raw);
      if (sourceAfter !== sourceBefore) {
        throw new MaintenanceIntegrityError(
          "Immutable Context L0 digest berubah saat rollback.",
        );
      }
      return this.storeReceipt({
        id: `maint_${hashJson([input.operationId, input.sourceReceiptId]).slice(0, 24)}`,
        operationId: input.operationId,
        kind: "ROLLBACK",
        actions: sourceReceipt.actions,
        planDigest: sourceReceipt.planDigest,
        sourceDigestBefore: sourceBefore,
        sourceDigestAfter: sourceAfter,
        projectionDigestBefore: projectionBefore,
        projectionDigestAfter: contextProjectionDigest(this.repo),
        snapshotPath: safetySnapshot,
        status: "SUCCEEDED",
        requestedAt: input.now,
        completedAt: input.now,
        details: { sourceReceiptId: input.sourceReceiptId, findingsAfter },
      });
    } finally {
      snapshotDb.close();
    }
  }

  removeSnapshot(receiptId: string): void {
    const receipt = this.getReceipt(receiptId);
    if (
      receipt?.snapshotPath !== null &&
      receipt?.snapshotPath !== undefined &&
      existsSync(receipt.snapshotPath)
    ) {
      unlinkSync(receipt.snapshotPath);
    }
  }
}
