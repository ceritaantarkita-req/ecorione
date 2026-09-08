/**
 * Routing deterministik — `docs/api-fase1.md` §Connect "Routing deterministik", ADR-02.
 *
 * **Bukan** predictor terlatih: urutan aturan tetap, berhenti di yang pertama menyala,
 * `routeReason` = id aturan itu sendiri. Kalau suatu hari routing perlu jadi lebih pintar,
 * itu perubahan yang harus terlihat di diff (aturan baru, versi baru) — bukan model yang
 * diam-diam belajar rute berbeda dari trafik yang sama.
 */

import type { Sensitivity } from "@ecorione/shared-schema";
import type { PinnedModelId } from "@ecorione/shared-telemetry";

export type RouteTarget = "hosted" | "local";

export interface RouteRequest {
  readonly target: RouteTarget;
  readonly sensitivity: Sensitivity;
}

export interface RouteDecision {
  /**
   * Identitas model untuk keperluan harga/ledger (`pricing.ts`) — **bukan** tag mentah
   * yang dikirim ke endpoint Ollama. Untuk `target: "local"` ini selalu string pin tetap;
   * tag Ollama sungguhan datang dari `ECORIONE_LOCAL_MODEL` di adapter, terpisah dari
   * keputusan routing (ADR-14 — alias/tag provider tidak boleh jadi identitas biaya).
   */
  readonly model: PinnedModelId;
  readonly routeReason: "local-consolidation" | "sensitivity-restricted" | "default-hosted";
}

/** Identitas biaya tetap untuk model lokal — lihat catatan di `RouteDecision.model`. */
export const LOCAL_PINNED_MODEL: PinnedModelId = "local/qwen3-8b-instruct-q4_k_m";

const SENSITIVITY_MODEL: PinnedModelId = "claude-opus-4-1-20250805";
const DEFAULT_HOSTED_MODEL: PinnedModelId = "claude-sonnet-4-5-20250929";

/**
 * Urutan aturan mengikuti kontrak persis — jangan susun ulang tanpa memperbarui
 * `docs/api-fase1.md` di saat yang sama:
 *
 * 1. `target === "local"` → selalu model lokal. Model lokal berperan classifier/extractor
 *    (ADR-04), bukan agent loop — tidak pernah dieskalasi diam-diam ke hosted.
 * 2. `sensitivity === "RESTRICTED"` → kualitas tertinggi (Opus). Gerbang sensitivitas
 *    tidak pernah ditukar dengan biaya.
 * 3. Default → model hosted standar.
 */
export function route(req: RouteRequest): RouteDecision {
  if (req.target === "local") {
    return { model: LOCAL_PINNED_MODEL, routeReason: "local-consolidation" };
  }
  if (req.sensitivity === "RESTRICTED") {
    return { model: SENSITIVITY_MODEL, routeReason: "sensitivity-restricted" };
  }
  return { model: DEFAULT_HOSTED_MODEL, routeReason: "default-hosted" };
}
