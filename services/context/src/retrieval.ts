/** Hybrid retrieval with scope/sensitivity/egress filters applied before ranking. */
import {
  DEFAULT_RETRIEVAL_K,
  MAX_RETRIEVAL_K,
  SENSITIVITY,
  recencyDecay,
  sensitivityRank,
  type MemoryFact,
  type MemoryFactId,
  type ProjectId,
  type RetrievalHit,
  type Scope,
  type Sensitivity,
  type Timestamp,
} from "@ecorione/shared-schema";
import type { ContextRepository } from "./repository.js";
import type { VectorIndex } from "./vector.js";

export const RRF_K = 60;
const CANDIDATE_MULTIPLIER = 4;
const MIN_CANDIDATES = 20;

export interface RetrievalOptions {
  readonly query: string;
  readonly scopes: readonly Scope[];
  readonly k?: number;
  readonly projectId?: ProjectId | null | undefined;
  readonly maxSensitivity?: Sensitivity;
  readonly now: Timestamp;
  readonly queryEmbedding?: Float32Array;
  /** Hosted request may only recall CLOUD_ALLOWED/PUBLIC data. */
  readonly hostedEligibleOnly?: boolean;
  /** Optional Brain-derived exact provenance source URI constraint. Undefined is baseline; [] is fail-closed empty. */
  readonly candidateSourceUris?: readonly string[] | undefined;
  /** Optional Brain-derived exact Fact ID constraint. Undefined is baseline; [] is fail-closed empty. */
  readonly candidateFactIds?: readonly MemoryFactId[] | undefined;
}
export interface RetrievalDiagnostics {
  readonly lexicalCandidates: number;
  readonly vectorCandidates: number;
  readonly afterFilter: number;
  readonly returned: number;
  readonly authorizedCandidates: number;
  readonly narrowedCandidates: number;
  readonly constraintApplied: boolean;
}
export interface RetrievalResult {
  readonly hits: RetrievalHit[];
  readonly diagnostics: RetrievalDiagnostics;
}

type RankedList = readonly MemoryFactId[];
interface FusedEntry {
  score: number;
  matchedBy: RetrievalHit["matchedBy"];
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}
function allowedSensitivities(max: Sensitivity): Sensitivity[] {
  return SENSITIVITY.filter((s) => sensitivityRank(s) <= sensitivityRank(max));
}

export class ContextRetriever {
  constructor(
    private readonly repo: ContextRepository,
    private readonly vectors?: VectorIndex,
  ) {}
  retrieve(options: RetrievalOptions): RetrievalResult {
    assertScopes(options.scopes);
    const k = clampK(options.k);
    const maxSensitivity = options.maxSensitivity ?? "RESTRICTED";
    const candidateLimit = Math.max(MIN_CANDIDATES, k * CANDIDATE_MULTIPLIER);
    const authorizedFacts = this.allowedFacts(
      options.scopes,
      maxSensitivity,
      options.hostedEligibleOnly ?? false,
      options.projectId ?? null,
    );
    const sourceConstraint =
      options.candidateSourceUris === undefined
        ? undefined
        : new Set(options.candidateSourceUris);
    const factConstraint =
      options.candidateFactIds === undefined ? undefined : new Set(options.candidateFactIds);
    const constraintApplied = sourceConstraint !== undefined || factConstraint !== undefined;
    const allowedFacts = constraintApplied
      ? new Map(
          [...authorizedFacts].filter(([factId, fact]) => {
            if (factConstraint?.has(factId) === true) return true;
            const sourceUri = fact.provenance.sourceUri;
            return sourceUri !== undefined && sourceConstraint?.has(sourceUri) === true;
          }),
        )
      : authorizedFacts;
    const allowedIds = new Set(allowedFacts.keys());
    const lexical = this.lexicalSearch(
      options.query,
      candidateLimit,
      options.scopes,
      maxSensitivity,
      options.hostedEligibleOnly ?? false,
      options.projectId ?? null,
      options.candidateSourceUris,
      options.candidateFactIds,
    );
    const vector = this.vectorSearch(options.queryEmbedding, candidateLimit, allowedIds);
    const fused = reciprocalRankFusion([lexical, vector]);
    const hits: RetrievalHit[] = [];
    for (const [factId, entry] of fused) {
      const fact = allowedFacts.get(factId);
      if (fact === undefined) continue;
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
        authorizedCandidates: authorizedFacts.size,
        narrowedCandidates: allowedFacts.size,
        constraintApplied,
      },
    };
  }

  private allowedFacts(
    scopes: readonly Scope[],
    maxSensitivity: Sensitivity,
    hostedEligibleOnly: boolean,
    projectId: ProjectId | null,
  ): Map<MemoryFactId, MemoryFact> {
    const facts = this.repo.listFacts({
      scopes,
      maxSensitivity,
      hostedEligibleOnly,
      projectId,
      includeGlobal: projectId !== null,
      limit: 100_000,
    });
    return new Map(facts.map((f) => [f.id, f]));
  }

  private lexicalSearch(
    query: string,
    limit: number,
    scopes: readonly Scope[],
    maxSensitivity: Sensitivity,
    hostedEligibleOnly: boolean,
    projectId: ProjectId | null,
    candidateSourceUris: readonly string[] | undefined,
    candidateFactIds: readonly MemoryFactId[] | undefined,
  ): RankedList {
    const match = toFtsQuery(query);
    if (match === null) return [];
    const hasSourceConstraint = candidateSourceUris !== undefined;
    const hasFactConstraint = candidateFactIds !== undefined;
    if (
      (hasSourceConstraint || hasFactConstraint) &&
      (candidateSourceUris?.length ?? 0) === 0 &&
      (candidateFactIds?.length ?? 0) === 0
    ) {
      return [];
    }
    const allowed = allowedSensitivities(maxSensitivity);
    const egress = hostedEligibleOnly ? "AND f.sync_class IN ('CLOUD_ALLOWED','PUBLIC')" : "";
    const projectClause =
      projectId === null
        ? "AND f.project_id IS NULL AND f.project_state='GLOBAL'"
        : "AND ((f.project_id IS NULL AND f.project_state='GLOBAL') OR (f.project_id=? AND f.project_state='ASSIGNED'))";
    const projectParams = projectId === null ? [] : [projectId];
    const sourceValues = candidateSourceUris ?? [];
    const factValues = candidateFactIds ?? [];
    const candidateParts: string[] = [];
    if (sourceValues.length > 0) {
      candidateParts.push(`f.source_uri IN (${placeholders(sourceValues.length)})`);
    }
    if (factValues.length > 0) {
      candidateParts.push(`f.id IN (${placeholders(factValues.length)})`);
    }
    const candidateClause =
      hasSourceConstraint || hasFactConstraint ? `AND (${candidateParts.join(" OR ")})` : "";
    try {
      const rows = this.repo.db.raw
        .prepare(
          `
        SELECT f.id AS id
        FROM facts_fts
        JOIN facts f ON f.rowid = facts_fts.rowid
        WHERE facts_fts MATCH ?
          AND f.t_invalid IS NULL
          AND f.scope IN (${placeholders(scopes.length)})
          AND f.sensitivity IN (${placeholders(allowed.length)})
          ${egress}
          ${projectClause}
          ${candidateClause}
        ORDER BY bm25(facts_fts)
        LIMIT ?
      `,
        )
        .all(
          match,
          ...scopes,
          ...allowed,
          ...projectParams,
          ...sourceValues,
          ...factValues,
          limit,
        ) as {
        id: string;
      }[];
      return rows.map((r) => r.id as MemoryFactId);
    } catch {
      return [];
    }
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

export function reciprocalRankFusion(
  lists: readonly RankedList[],
  k = RRF_K,
): Map<MemoryFactId, FusedEntry> {
  const fused = new Map<MemoryFactId, FusedEntry>();
  const labels = ["lexical", "vector"] as const;
  lists.forEach((list, listIndex) => {
    const label = labels[listIndex] ?? "lexical";
    list.forEach((factId, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = fused.get(factId);
      if (existing === undefined)
        fused.set(factId, { score: contribution, matchedBy: [label] });
      else {
        existing.score += contribution;
        if (!existing.matchedBy.includes(label))
          existing.matchedBy = [...existing.matchedBy, label];
      }
    });
  });
  return fused;
}

export class MissingScopeError extends Error {
  constructor() {
    super("Retrieval butuh minimal satu scope. Tidak ada default 'semua scope'.");
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
  if (!Number.isInteger(k) || k < 1)
    throw new RangeError(`k harus bilangan bulat ≥ 1, diterima ${k}`);
  return Math.min(k, MAX_RETRIEVAL_K);
}
export function toFtsQuery(raw: string): string | null {
  const tokens = raw
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`);
  return tokens.length === 0 ? null : tokens.join(" OR ");
}
