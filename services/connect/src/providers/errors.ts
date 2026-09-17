/**
 * Error domain adapter provider — dipetakan ke error HTTP di `http.ts`, bukan 500:
 * kegagalan provider/kontrol operator bukan bug di Connect (`docs/api-fase1.md` §Connect).
 */

export type ProviderErrorKind = "unreachable" | "invalid-credential" | "upstream";

/**
 * Whitelisted provider-routing metadata safe for logs/evidence. It deliberately excludes
 * prompts, completions, guardrail pipeline payloads, raw provider bodies, and credentials.
 */
export interface SafeProviderRoutingMetadata {
  readonly requested?: string | undefined;
  readonly strategy?: string | undefined;
  readonly region?: string | undefined;
  readonly attempt?: number | undefined;
  readonly isByok?: boolean | undefined;
  readonly endpointTotal?: number | undefined;
  readonly selectedProvider?: string | undefined;
  readonly selectedModel?: string | undefined;
}

export interface ProviderResponseDiagnostics {
  /** Provider/runtime model identity returned by the upstream response. */
  readonly responseModel: string;
  /** Provider finish reason when exposed; null means absent/unknown. */
  readonly finishReason: string | null;
  /** Safe aggregate token counts only — never prompt/document content. */
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Authoritative provider-billed cost when the upstream exposed a valid value. */
  readonly providerReportedActualUsd?: number | undefined;
  /** Safe routing identity only; no raw provider metadata is retained. */
  readonly routingMetadata?: SafeProviderRoutingMetadata | undefined;
}

export class ProviderError extends Error {
  readonly provider: "hosted" | "local";
  readonly kind: ProviderErrorKind;

  constructor(
    provider: "hosted" | "local",
    message: string,
    kind: ProviderErrorKind = "upstream",
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
  }
}

/**
 * Upstream menjawab secara cukup lengkap untuk memberi metadata aman/billing authority,
 * tetapi completion tetap tidak boleh dipakai. Tidak pernah membawa prompt, document content,
 * credential, atau raw provider body.
 */
export class ProviderResponseError extends ProviderError {
  readonly diagnostics: ProviderResponseDiagnostics;

  constructor(message: string, diagnostics: ProviderResponseDiagnostics) {
    super("hosted", message, "upstream");
    this.name = "ProviderResponseError";
    this.diagnostics = diagnostics;
  }
}

/** Kredensial provider hosted belum tersedia — gagal jelas, bukan mencoba dan gagal samar. */
export class MissingCredentialError extends Error {
  constructor(source: string) {
    super(`Kredensial provider belum tersedia: ${source}.`);
    this.name = "MissingCredentialError";
  }
}

/** Operator mematikan seluruh target hosted sebagai emergency cost-control switch. */
export class CostKillSwitchError extends Error {
  constructor() {
    super("Panggilan model hosted dinonaktifkan oleh ECORIONE_COST_KILL_SWITCH.");
    this.name = "CostKillSwitchError";
  }
}

/**
 * Tidak ada plafon spend kumulatif yang terkonfigurasi untuk dispatch hosted.
 *
 * ADR-21 menyatakan hosted dispatch tunduk pada kill switch DAN budget kumulatif. Sebelum
 * audit 2026-09-14, `ECORIONE_SPEND_DAILY_USD`/`_MONTHLY_USD` yang kosong menghasilkan
 * `spendBudget === undefined`, yang berarti dispatch hosted berjalan tanpa admission
 * control sama sekali — diam-diam unlimited, persis kebalikan dari invariant-nya. Gagal
 * tertutup di sini, dan minta operator menyatakan niatnya secara eksplisit.
 */
export class SpendBudgetNotConfiguredError extends Error {
  constructor() {
    super(
      "Dispatch hosted butuh plafon spend kumulatif. Isi ECORIONE_SPEND_DAILY_USD dan/atau " +
        "ECORIONE_SPEND_MONTHLY_USD, atau nyatakan tanpa plafon secara eksplisit lewat " +
        "ECORIONE_SPEND_UNLIMITED=1.",
    );
    this.name = "SpendBudgetNotConfiguredError";
  }
}
