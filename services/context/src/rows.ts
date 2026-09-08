/** Pemetaan baris SQLite ↔ shared schema. */
import {
  ArtifactPointerSchema,
  CoreMemoryBlockSchema,
  EpisodeSchema,
  MemoryFactSchema,
  QuarantinedWriteSchema,
  type ArtifactPointer,
  type CoreMemoryBlock,
  type Episode,
  type MemoryFact,
  type Provenance,
  type QuarantinedWrite,
} from "@ecorione/shared-schema";
import type { BindValue } from "./sqlite.js";

export interface ProvenanceColumns {
  source_app: string;
  session_id: string | null;
  tool_call_id: string | null;
  source_uri: string | null;
}
function provenanceObject(row: ProvenanceColumns): Record<string, unknown> {
  const provenance: Record<string, unknown> = { sourceApp: row.source_app };
  if (row.session_id !== null) provenance.sessionId = row.session_id;
  if (row.tool_call_id !== null) provenance.toolCallId = row.tool_call_id;
  if (row.source_uri !== null) provenance.sourceUri = row.source_uri;
  return provenance;
}
export function provenanceParams(p: Provenance): ProvenanceColumns {
  return {
    source_app: p.sourceApp,
    session_id: p.sessionId ?? null,
    tool_call_id: p.toolCallId ?? null,
    source_uri: p.sourceUri ?? null,
  };
}

export interface EpisodeRow extends ProvenanceColumns {
  id: string; ts: string; raw_text: string; scope: string; sensitivity: string;
  sync_class: string; trust: string; summary: string | null; consolidated_at: string | null;
}
export function rowToEpisode(row: EpisodeRow): Episode {
  return EpisodeSchema.parse({
    id: row.id,
    ts: row.ts,
    rawText: row.raw_text,
    provenance: provenanceObject(row),
    scope: row.scope,
    sensitivity: row.sensitivity,
    syncClass: row.sync_class,
    trust: row.trust,
    summary: row.summary,
    consolidatedAt: row.consolidated_at,
  });
}

export interface FactRow extends ProvenanceColumns {
  id: string; subject: string; predicate: string; object: string; text: string;
  confidence: number; salience: number; source_episode_ids: string; t_valid: string;
  t_invalid: string | null; superseded_by: string | null; created_at: string;
  scope: string; sensitivity: string; sync_class: string; trust: string;
}
export const FACT_COLUMNS = `
  id, subject, predicate, object, text, confidence, salience, source_episode_ids,
  t_valid, t_invalid, superseded_by, created_at,
  scope, sensitivity, sync_class, trust,
  source_app, session_id, tool_call_id, source_uri
`;
export function rowToFact(row: FactRow): MemoryFact {
  return MemoryFactSchema.parse({
    id: row.id,
    subject: row.subject,
    predicate: row.predicate,
    object: row.object,
    text: row.text,
    confidence: row.confidence,
    salience: row.salience,
    sourceEpisodeIds: JSON.parse(row.source_episode_ids) as unknown,
    tValid: row.t_valid,
    tInvalid: row.t_invalid,
    supersededBy: row.superseded_by,
    createdAt: row.created_at,
    scope: row.scope,
    sensitivity: row.sensitivity,
    syncClass: row.sync_class,
    trust: row.trust,
    provenance: provenanceObject(row),
  });
}
export function factParams(fact: MemoryFact): Record<string, BindValue> {
  return {
    id: fact.id,
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    text: fact.text,
    confidence: fact.confidence,
    salience: fact.salience,
    source_episode_ids: JSON.stringify(fact.sourceEpisodeIds),
    t_valid: fact.tValid,
    t_invalid: fact.tInvalid,
    superseded_by: fact.supersededBy,
    created_at: fact.createdAt,
    scope: fact.scope,
    sensitivity: fact.sensitivity,
    sync_class: fact.syncClass,
    trust: fact.trust,
    ...provenanceParams(fact.provenance),
  };
}

export interface QuarantineRow extends ProvenanceColumns {
  id: string; proposed_text: string; proposed_at: string; trust: string; scope: string;
  status: string; rejection_reason: string | null; reviewed_at: string | null;
  promoted_fact_id: string | null;
}
export function rowToQuarantined(row: QuarantineRow): QuarantinedWrite {
  return QuarantinedWriteSchema.parse({
    id: row.id,
    proposedText: row.proposed_text,
    proposedAt: row.proposed_at,
    provenance: provenanceObject(row),
    trust: row.trust,
    scope: row.scope,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
  });
}

export interface CoreMemoryRow {
  label: string; description: string; value: string; read_only: number; updated_at: string;
  scope: string; sensitivity: string; sync_class: string; trust: string;
}
export function rowToCoreBlock(row: CoreMemoryRow): CoreMemoryBlock {
  return CoreMemoryBlockSchema.parse({
    label: row.label,
    description: row.description,
    value: row.value,
    readOnly: row.read_only === 1,
    updatedAt: row.updated_at,
    scope: row.scope,
    sensitivity: row.sensitivity,
    syncClass: row.sync_class,
    trust: row.trust,
  });
}

export interface ArtifactPointerRow {
  id: string; path: string; description: string; mime_type: string; size_bytes: number;
  scope: string; sensitivity: string; sync_class: string;
}
export function rowToArtifactPointer(row: ArtifactPointerRow): ArtifactPointer {
  return ArtifactPointerSchema.parse({
    id: row.id,
    path: row.path,
    description: row.description,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    scope: row.scope,
    sensitivity: row.sensitivity,
    syncClass: row.sync_class,
  });
}
