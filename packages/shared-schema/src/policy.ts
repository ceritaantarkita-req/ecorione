/**
 * Kontrak policy engine, approval gate, dan audit — `prd.md` §7 (Hub), §22.
 *
 * Tiga hal yang menopang seluruh klaim "fondasi untuk operasi yang dijalankan AI":
 * durable state, idempotency, dan audit trail. Semuanya dipaksakan **di kode**, tidak
 * pernah diminta lewat prompt (ADR-12).
 */

import { z } from "zod";
import { ModuleNameSchema } from "./modules.js";
import { OperationIdSchema, EventIdSchema } from "./ids.js";
import { SensitivitySchema, ScopeSchema } from "./classification.js";

/**
 * Tangga otonomi — `prd.md` §22. **L4 tidak ada** untuk apa pun yang konsekuensial:
 * yang membatasi bukan kepintaran model, tapi verifikasi.
 */
export const AUTONOMY_LEVELS = ["L0", "L1", "L2", "L3", "L4"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];
export const AutonomyLevelSchema = z.enum(AUTONOMY_LEVELS);

/** Plafon yang boleh dipakai di v1. Nilai di atas ini ditolak policy engine. */
export const MAX_AUTONOMY_V1: AutonomyLevel = "L3";

const AUTONOMY_RANK: Record<AutonomyLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

export function autonomyExceeds(level: AutonomyLevel, ceiling: AutonomyLevel): boolean {
  return AUTONOMY_RANK[level] > AUTONOMY_RANK[ceiling];
}

/**
 * Kelas aksi. Yang menentukan butuh approval atau tidak adalah **reversibilitas**,
 * bukan identitas tool — gerbang pada risiko argumen mencegah approval fatigue
 * (`research.md` §7.4).
 */
export const ACTION_CLASS = [
  /** Baca saja, tidak mengubah apa pun. */
  "READ",
  /** Mengubah state internal yang bisa dibatalkan (ada aksi kompensasi). */
  "REVERSIBLE_WRITE",
  /** Mengubah state tanpa aksi pembatalan. Permanen L2 — PRD §22 prasyarat #6. */
  "IRREVERSIBLE_WRITE",
  /** Mengeluarkan uang. */
  "SPEND",
  /** Mengirim komunikasi ke luar. */
  "EXTERNAL_SEND",
  /** Menyentuh kredensial. */
  "CREDENTIAL_ACCESS",
  /** Mengeksekusi kode atau perintah. */
  "EXECUTE",
] as const;
export type ActionClass = (typeof ACTION_CLASS)[number];
export const ActionClassSchema = z.enum(ACTION_CLASS);

/** Kelas yang **selalu** butuh approval, berapa pun level otonominya. */
const ALWAYS_GATED: ReadonlySet<ActionClass> = new Set<ActionClass>([
  "IRREVERSIBLE_WRITE",
  "SPEND",
  "EXTERNAL_SEND",
  "CREDENTIAL_ACCESS",
]);

export function alwaysRequiresApproval(cls: ActionClass): boolean {
  return ALWAYS_GATED.has(cls);
}

export const ActionRequestSchema = z.object({
  operationId: OperationIdSchema,
  module: ModuleNameSchema,
  tool: z.string().min(1).max(128),
  actionClass: ActionClassSchema,
  /** Argumen sudah ternormalisasi — dipakai untuk idempotency key dan audit. */
  args: z.record(z.string(), z.unknown()),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  autonomy: AutonomyLevelSchema,
  /**
   * Wajib untuk setiap aksi yang punya efek samping (ADR-12). Retry dengan key yang sama
   * tidak pernah mengeksekusi dua kali — ini beda antara "coba lagi" dan "tagih dua kali".
   */
  idempotencyKey: z.string().min(8).max(128).nullable(),
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

/**
 * Empat respons terhadap tool call yang di-interrupt.
 *
 * Gotcha terdokumentasi: **`RESPOND` tidak boleh dipakai untuk menolak tool yang punya
 * efek samping** — itu memberi sinyal sukses palsu ke model. Pakai `REJECT`.
 */
export const APPROVAL_DECISIONS = ["APPROVE", "EDIT", "REJECT", "RESPOND"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export const ApprovalDecisionSchema = z.enum(APPROVAL_DECISIONS);

export const PolicyVerdictSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("ALLOW"), reason: z.string() }),
  z.object({
    outcome: z.literal("REQUIRE_APPROVAL"),
    reason: z.string(),
    /** Ditampilkan ke pengguna saat meminta persetujuan. */
    prompt: z.string(),
  }),
  z.object({ outcome: z.literal("DENY"), reason: z.string() }),
]);
export type PolicyVerdict = z.infer<typeof PolicyVerdictSchema>;

/** Aturan bernomor supaya audit bisa menyebut aturan mana yang menyala. */
export const PolicyRuleSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(256),
  /** Versi kebijakan — dicatat di tiap keputusan supaya bisa direplay. */
  version: z.string().min(1).max(32),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

// ---------------------------------------------------------------------------
// Audit log — append-only
// ---------------------------------------------------------------------------

/**
 * Audit **tidak boleh** mengandalkan laporan-diri agent. Agent terdokumentasi melakukan
 * *deceptive shortcutting* saat mentok: menghilangkan bagian sulit lalu melapor sukses
 * (`research.md` §7.1). Yang dicatat adalah apa yang benar-benar dieksekusi.
 */
export const AUDIT_EVENT_TYPES = [
  "ACTION_REQUESTED",
  "POLICY_EVALUATED",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
  "ACTION_EXECUTED",
  "ACTION_FAILED",
  "ACTION_SKIPPED_IDEMPOTENT",
  "MEMORY_PROPOSED",
  "MEMORY_PROMOTED",
  "MEMORY_INVALIDATED",
  "MODEL_CALLED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export const AuditEventTypeSchema = z.enum(AUDIT_EVENT_TYPES);

export const AuditEventSchema = z.object({
  id: EventIdSchema,
  ts: z.string().datetime({ offset: false }),
  type: AuditEventTypeSchema,
  operationId: OperationIdSchema.nullable(),
  module: ModuleNameSchema,
  /** Payload spesifik per tipe. Disimpan apa adanya supaya bisa direplay. */
  detail: z.record(z.string(), z.unknown()),
  /** Aturan kebijakan yang menyala, kalau event ini keputusan. */
  ruleId: z.string().max(64).nullable().default(null),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Membangun idempotency key deterministik dari identitas aksi.
 * Digest-nya dihitung pemanggil (Node `crypto`), supaya paket ini tetap bebas dependensi.
 */
export function idempotencyPayload(
  req: Pick<ActionRequest, "module" | "tool" | "args">,
): string {
  return JSON.stringify({ m: req.module, t: req.tool, a: sortDeep(req.args) });
}

/** Serialisasi stabil: urutan kunci tidak boleh mengubah key yang dihasilkan. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}
