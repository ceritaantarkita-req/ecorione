/** Model memori 4 tier — L0 ground truth; L1–L3 proyeksi turunan. */
import { z } from "zod";
import {
  ArtifactIdSchema,
  EpisodeIdSchema,
  MemoryFactIdSchema,
  SessionIdSchema,
} from "./ids.js";
import {
  ScopeSchema,
  SensitivitySchema,
  SyncClassSchema,
  TrustSchema,
} from "./classification.js";

export const TimestampSchema = z.string().datetime({ offset: false });
export type Timestamp = z.infer<typeof TimestampSchema>;
export const ProvenanceSchema = z.object({
  sourceApp: z.string().min(1).max(64),
  sessionId: SessionIdSchema.optional(),
  toolCallId: z.string().min(1).max(128).optional(),
  sourceUri: z.string().max(2048).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const EpisodeSchema = z.object({
  id: EpisodeIdSchema,
  ts: TimestampSchema,
  rawText: z.string(),
  provenance: ProvenanceSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  trust: TrustSchema,
  summary: z.string().nullable().default(null),
  consolidatedAt: TimestampSchema.nullable().default(null),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const MemoryFactSchema = z.object({
  id: MemoryFactIdSchema,
  subject: z.string().min(1).max(256),
  predicate: z.string().min(1).max(128),
  object: z.string().min(1).max(1024),
  text: z.string().min(1).max(2048),
  confidence: z.number().min(0).max(1),
  salience: z.number().min(0).max(1),
  sourceEpisodeIds: z.array(EpisodeIdSchema).min(1),
  tValid: TimestampSchema,
  tInvalid: TimestampSchema.nullable().default(null),
  supersededBy: MemoryFactIdSchema.nullable().default(null),
  createdAt: TimestampSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  trust: TrustSchema,
  provenance: ProvenanceSchema,
});
export type MemoryFact = z.infer<typeof MemoryFactSchema>;
export function isLive(fact: Pick<MemoryFact, "tInvalid">): boolean {
  return fact.tInvalid === null;
}
export function supersede(
  old: MemoryFact,
  replacement: Pick<MemoryFact, "id" | "tValid">,
): MemoryFact {
  return { ...old, tInvalid: replacement.tValid, supersededBy: replacement.id };
}

export const QuarantinedWriteSchema = z.object({
  id: MemoryFactIdSchema,
  proposedText: z.string().min(1).max(4096),
  proposedAt: TimestampSchema,
  provenance: ProvenanceSchema,
  trust: TrustSchema,
  scope: ScopeSchema,
  status: z.enum(["PENDING", "PROMOTED", "REJECTED"]).default("PENDING"),
  rejectionReason: z.string().max(512).nullable().default(null),
  reviewedAt: TimestampSchema.nullable().default(null),
});
export type QuarantinedWrite = z.infer<typeof QuarantinedWriteSchema>;

export const CORE_MEMORY_TOKEN_LIMIT = 1500;
export const CORE_MEMORY_CHAR_LIMIT = CORE_MEMORY_TOKEN_LIMIT * 4;
/** Optional on the wire for backward compatibility; Context persists explicit values. */
export const CoreMemoryBlockSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_-]*$/),
  description: z.string().min(1).max(512),
  value: z.string(),
  readOnly: z.boolean().default(false),
  updatedAt: TimestampSchema,
  scope: ScopeSchema.optional(),
  sensitivity: SensitivitySchema.optional(),
  syncClass: SyncClassSchema.optional(),
  trust: TrustSchema.optional(),
});
export type CoreMemoryBlock = z.infer<typeof CoreMemoryBlockSchema>;
export const CoreMemorySchema = z
  .object({ blocks: z.array(CoreMemoryBlockSchema) })
  .refine((m) => m.blocks.reduce((n, b) => n + b.value.length, 0) <= CORE_MEMORY_CHAR_LIMIT, {
    message: `Memori inti melewati batas ~${CORE_MEMORY_TOKEN_LIMIT} token (${CORE_MEMORY_CHAR_LIMIT} karakter). Ringkas atau turunkan sebagian ke L1.`,
  });
export type CoreMemory = z.infer<typeof CoreMemorySchema>;

export const ArtifactPointerSchema = z.object({
  id: ArtifactIdSchema,
  path: z.string().min(1).max(1024),
  description: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema.optional(),
});
export type ArtifactPointer = z.infer<typeof ArtifactPointerSchema>;

export const DEFAULT_RETRIEVAL_K = 8;
export const MAX_RETRIEVAL_K = 20;
export const RetrievalHitSchema = z.object({
  fact: MemoryFactSchema,
  score: z.number(),
  matchedBy: z.array(z.enum(["lexical", "vector"])).min(1),
});
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;
export const RetrievalQuerySchema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(MAX_RETRIEVAL_K).default(DEFAULT_RETRIEVAL_K),
  scopes: z.array(ScopeSchema).min(1),
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  liveOnly: z.boolean().default(true),
});
export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;
export const RECENCY_HALF_LIFE_DAYS = 45;
export function recencyDecay(
  factCreatedAt: Timestamp,
  now: Timestamp,
  halfLifeDays = RECENCY_HALF_LIFE_DAYS,
): number {
  const ageMs = Date.parse(now) - Date.parse(factCreatedAt);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
  return 2 ** (-(ageMs / 86_400_000) / halfLifeDays);
}
