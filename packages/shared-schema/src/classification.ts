/**
 * Klasifikasi data — `prd.md` §12, §14.
 *
 * Dua sumbu yang berbeda dan tidak boleh dicampur:
 *   - `Sensitivity` menjawab "siapa yang boleh melihat ini"
 *   - `SyncClass`   menjawab "apakah ini boleh meninggalkan mesin ini"
 *
 * Keduanya adalah **gerbang keras**. ADR-02: sensitivitas dievaluasi sebelum biaya dan
 * tidak pernah ditukar dengannya.
 */

import { z } from "zod";

export const SENSITIVITY = ["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"] as const;
export type Sensitivity = (typeof SENSITIVITY)[number];
export const SensitivitySchema = z.enum(SENSITIVITY);

/** Urutan naik: makin tinggi makin ketat. Dipakai untuk perbandingan gerbang. */
const SENSITIVITY_RANK: Record<Sensitivity, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  SENSITIVE: 2,
  RESTRICTED: 3,
};

export function sensitivityRank(s: Sensitivity): number {
  return SENSITIVITY_RANK[s];
}

/** `true` kalau `actual` sama ketat atau lebih ketat dari `threshold`. */
export function atLeastAsSensitive(actual: Sensitivity, threshold: Sensitivity): boolean {
  return SENSITIVITY_RANK[actual] >= SENSITIVITY_RANK[threshold];
}

/** Sensitivitas paling ketat dari sekumpulan — dipakai saat merakit context pack. */
export function maxSensitivity(values: readonly Sensitivity[]): Sensitivity {
  let result: Sensitivity = "PUBLIC";
  for (const v of values) {
    if (SENSITIVITY_RANK[v] > SENSITIVITY_RANK[result]) result = v;
  }
  return result;
}

export const SYNC_CLASS = ["LOCAL_ONLY", "SYNC_ENCRYPTED", "CLOUD_ALLOWED", "PUBLIC"] as const;
export type SyncClass = (typeof SYNC_CLASS)[number];
export const SyncClassSchema = z.enum(SYNC_CLASS);

/**
 * Default `LOCAL_ONLY` — PRD §15. Data keluar mesin hanya lewat pilihan eksplisit,
 * tidak pernah karena lupa menyetel.
 */
export const DEFAULT_SYNC_CLASS: SyncClass = "LOCAL_ONLY";

export function mayLeaveDevice(sync: SyncClass): boolean {
  return sync !== "LOCAL_ONLY";
}

/**
 * Kepercayaan sumber tulisan — PRD §14, ADR-07.
 *
 * Konten pihak ketiga (halaman web, email, file bersama) masuk dengan trust rendah dan
 * **tidak pernah dipromosikan ke memori inti tanpa konfirmasi pengguna**. Skor ini tidak
 * pernah dinilai oleh LLM: pertahanan berbasis kepercayaan-yang-dinilai-LLM sudah terbukti
 * bisa ditembus (`research.md` §3.4).
 */
export const TRUST = ["USER", "LOCAL_AGENT", "HOSTED_AGENT", "THIRD_PARTY"] as const;
export type Trust = (typeof TRUST)[number];
export const TrustSchema = z.enum(TRUST);

const TRUST_RANK: Record<Trust, number> = {
  USER: 3,
  LOCAL_AGENT: 2,
  HOSTED_AGENT: 1,
  THIRD_PARTY: 0,
};

/** Hanya tulisan dari pengguna sendiri yang boleh langsung menyentuh memori inti (L2). */
export function mayWriteCoreMemory(trust: Trust): boolean {
  return trust === "USER";
}

/** Segala yang di bawah USER masuk karantina dulu — ADR-07. */
export function requiresQuarantine(trust: Trust): boolean {
  return TRUST_RANK[trust] < TRUST_RANK.USER;
}

/**
 * Scope memori — memisahkan konteks pribadi/kerja/proyek supaya retrieval tidak
 * membocorkan lintas konteks (PRD §14).
 */
export const ScopeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9:_-]*$/, "Scope: lowercase, boleh `:` `_` `-`");
export type Scope = z.infer<typeof ScopeSchema>;

export const DEFAULT_SCOPE: Scope = "personal";
