/**
 * Model memori 4 tier — `prd.md` §12.1, ADR-06.
 *
 * Keputusan struktural terpenting di seluruh sistem: **L0 adalah ground truth; L1–L3
 * adalah proyeksi turunan yang bisa dibangun ulang.** Kalau konsolidasi menulis fakta
 * yang salah, tier turunannya dihapus dan diturunkan ulang dari L0.
 */

import { z } from "zod";
import {
  EpisodeIdSchema,
  MemoryFactIdSchema,
  ArtifactIdSchema,
  SessionIdSchema,
} from "./ids.js";
import {
  ScopeSchema,
  SensitivitySchema,
  SyncClassSchema,
  TrustSchema,
} from "./classification.js";

/** Waktu selalu ISO 8601 UTC. String, bukan Date — supaya serialisasi deterministik. */
export const TimestampSchema = z.string().datetime({ offset: false });
export type Timestamp = z.infer<typeof TimestampSchema>;

/**
 * Dari mana sebuah baris berasal. Provenance bukan opsional — ini yang membuat
 * mitigasi poisoning, filter scope, dan UX "memori apa yang dipakai" mungkin sama sekali.
 */
export const ProvenanceSchema = z.object({
  /** Aplikasi yang menghasilkan: "ai" | "claude-code" | "chatgpt" | "ollama" | "cli" | … */
  sourceApp: z.string().min(1).max(64),
  /** Sesi asal, kalau ada. */
  sessionId: SessionIdSchema.optional(),
  /** Tool call yang menghasilkan, kalau lahir dari tool. */
  toolCallId: z.string().min(1).max(128).optional(),
  /** URL/path asal, kalau kontennya diambil dari luar. */
  sourceUri: z.string().max(2048).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

// ---------------------------------------------------------------------------
// L0 — log episodik (append-only, tidak pernah diedit)
// ---------------------------------------------------------------------------

export const EpisodeSchema = z.object({
  id: EpisodeIdSchema,
  ts: TimestampSchema,
  /** Teks mentah. Tidak di-embed secara default — hanya ringkasannya yang di-embed. */
  rawText: z.string(),
  provenance: ProvenanceSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  trust: TrustSchema,
  /** Diisi konsolidasi, bukan saat penulisan. */
  summary: z.string().nullable().default(null),
  /** `true` setelah episode ini diproses gerbang salience. */
  consolidatedAt: TimestampSchema.nullable().default(null),
});
export type Episode = z.infer<typeof EpisodeSchema>;

// ---------------------------------------------------------------------------
// L1 — fakta semantik (bi-temporal)
// ---------------------------------------------------------------------------

/**
 * Model bi-temporal diambil dari Graphiti **sebagai kolom, bukan sebagai graph database**
 * (ADR-05). `t_valid`/`t_invalid` = kapan fakta benar di dunia. Kontradiksi menghasilkan
 * invalidasi, bukan penghapusan — retrieval selalu memfilter `tInvalid === null`.
 */
export const MemoryFactSchema = z.object({
  id: MemoryFactIdSchema,
  subject: z.string().min(1).max(256),
  predicate: z.string().min(1).max(128),
  object: z.string().min(1).max(1024),
  /** Rendering natural-language dari triple di atas — ini yang masuk konteks. */
  text: z.string().min(1).max(2048),

  /** 0..1, seberapa yakin ekstraksi ini benar. */
  confidence: z.number().min(0).max(1),
  /** 0..1, seberapa layak diingat. Naik tiap kali fakta ini dikonfirmasi ulang. */
  salience: z.number().min(0).max(1),

  sourceEpisodeIds: z.array(EpisodeIdSchema).min(1),

  /** Kapan fakta ini mulai benar di dunia. */
  tValid: TimestampSchema,
  /** Kapan berhenti benar. `null` = masih berlaku. */
  tInvalid: TimestampSchema.nullable().default(null),
  /** Fakta yang menggantikan ini, kalau di-invalidate karena kontradiksi. */
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

/**
 * Meng-invalidate fakta lama karena digantikan yang baru. Tidak pernah menghapus —
 * provenance harus tetap bisa ditelusuri (ADR-06).
 */
export function supersede(
  old: MemoryFact,
  replacement: Pick<MemoryFact, "id" | "tValid">,
): MemoryFact {
  return { ...old, tInvalid: replacement.tValid, supersededBy: replacement.id };
}

// ---------------------------------------------------------------------------
// Karantina — ADR-07
// ---------------------------------------------------------------------------

/**
 * Tulisan dari model hosted dan dari tool masuk sini dulu, bukan langsung ke L1.
 * Konsolidasi lokal yang memvalidasi dan mempromosikan. Ini yang menetralkan sebagian
 * besar permukaan memory poisoning.
 */
export const QuarantinedWriteSchema = z.object({
  id: MemoryFactIdSchema,
  proposedText: z.string().min(1).max(4096),
  proposedAt: TimestampSchema,
  provenance: ProvenanceSchema,
  trust: TrustSchema,
  scope: ScopeSchema,
  status: z.enum(["PENDING", "PROMOTED", "REJECTED"]).default("PENDING"),
  /** Alasan penolakan — mis. "berisi konten imperatif", "kontradiksi tak terselesaikan". */
  rejectionReason: z.string().max(512).nullable().default(null),
  reviewedAt: TimestampSchema.nullable().default(null),
});
export type QuarantinedWrite = z.infer<typeof QuarantinedWriteSchema>;

// ---------------------------------------------------------------------------
// L2 — memori inti / prosedural
// ---------------------------------------------------------------------------

/**
 * Batas keras memori inti. Selalu ada di konteks setiap panggilan, jadi tiap token di
 * sini dibayar berkali-kali — dan ia bagian dari prefix stabil yang masuk cache (ADR-01).
 */
export const CORE_MEMORY_TOKEN_LIMIT = 1500;

/** Perkiraan kasar 4 karakter/token. Cukup untuk gerbang, bukan untuk penagihan. */
export const CORE_MEMORY_CHAR_LIMIT = CORE_MEMORY_TOKEN_LIMIT * 4;

export const CoreMemoryBlockSchema = z.object({
  /** Label unik, dipakai sebagai nama seksi saat dirender. */
  label: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_-]*$/),
  /** Menjelaskan ke model kapan blok ini relevan. */
  description: z.string().min(1).max(512),
  value: z.string(),
  /** Blok read-only tidak boleh ditulis ulang konsolidasi — hanya oleh pengguna. */
  readOnly: z.boolean().default(false),
  updatedAt: TimestampSchema,
});
export type CoreMemoryBlock = z.infer<typeof CoreMemoryBlockSchema>;

export const CoreMemorySchema = z
  .object({
    blocks: z.array(CoreMemoryBlockSchema),
  })
  .refine((m) => m.blocks.reduce((n, b) => n + b.value.length, 0) <= CORE_MEMORY_CHAR_LIMIT, {
    message: `Memori inti melewati batas ~${CORE_MEMORY_TOKEN_LIMIT} token (${CORE_MEMORY_CHAR_LIMIT} karakter). Ringkas atau turunkan sebagian ke L1.`,
  });
export type CoreMemory = z.infer<typeof CoreMemorySchema>;

// ---------------------------------------------------------------------------
// L3 — pointer artifact (just-in-time retrieval)
// ---------------------------------------------------------------------------

/**
 * Artifact **tidak pernah** dimuat isinya ke konteks secara spekulatif. Agent memegang
 * pointer + deskripsi satu baris, lalu membuka saat perlu (`research.md` §3.2).
 */
export const ArtifactPointerSchema = z.object({
  id: ArtifactIdSchema,
  path: z.string().min(1).max(1024),
  /** Satu baris. Kalau butuh lebih, isinya yang harus dibaca, bukan deskripsinya. */
  description: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
});
export type ArtifactPointer = z.infer<typeof ArtifactPointerSchema>;

// ---------------------------------------------------------------------------
// Hasil retrieval
// ---------------------------------------------------------------------------

/**
 * k sengaja kecil. Studi Context Rot (18 model): **satu distraktor saja sudah menurunkan
 * akurasi**, dan potongan fokus ~300 token mengungguli percakapan penuh ~113k token.
 * Fakta yang cuma agak relevan aktif merusak, bukan sekadar memboroskan token.
 */
export const DEFAULT_RETRIEVAL_K = 8;
export const MAX_RETRIEVAL_K = 20;

export const RetrievalHitSchema = z.object({
  fact: MemoryFactSchema,
  /** Skor gabungan setelah RRF + rerank. */
  score: z.number(),
  /** Dari jalur mana hit ini datang — berguna untuk debugging retrieval. */
  matchedBy: z.array(z.enum(["lexical", "vector"])).min(1),
});
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;

export const RetrievalQuerySchema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(MAX_RETRIEVAL_K).default(DEFAULT_RETRIEVAL_K),
  /** Retrieval selalu dibatasi scope aktif — mencegah kebocoran lintas konteks. */
  scopes: z.array(ScopeSchema).min(1),
  /** Batas sensitivitas maksimum yang boleh ikut. */
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  /** `false` untuk audit historis; default hanya fakta yang masih berlaku. */
  liveOnly: z.boolean().default(true),
});
export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;

/** Setengah-hidup peluruhan recency, dalam hari. Peluruhan adalah sinyal ranking — bukan penghapusan. */
export const RECENCY_HALF_LIFE_DAYS = 45;

export function recencyDecay(
  factCreatedAt: Timestamp,
  now: Timestamp,
  halfLifeDays: number = RECENCY_HALF_LIFE_DAYS,
): number {
  const ageMs = Date.parse(now) - Date.parse(factCreatedAt);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 1;
  const ageDays = ageMs / 86_400_000;
  return 2 ** (-ageDays / halfLifeDays);
}
