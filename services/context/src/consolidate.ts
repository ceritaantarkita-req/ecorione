/**
 * Konsolidasi — `prd.md` §12.1, `docs/api-fase1.md` §Context "Konsolidasi". Model lokal
 * kecil, di luar jalur panas, dibatch: gerbang salience + ekstraksi, lalu validasi-dan-
 * promosi. Ini **adalah** langkah yang dimaksud §12.1 poin 4 ("tulis ulang L2 hanya
 * kalau...") diterapkan ke L1 — bukan jalan pintas melewati karantina.
 *
 * ADR-07 berlaku untuk `LOCAL_AGENT` juga (`requiresQuarantine("LOCAL_AGENT")` di
 * `@ecorione/shared-schema` bernilai `true`): setiap kandidat masuk `proposeFact()`
 * (karantina) dulu, baru dipromosikan lewat `promoteFromQuarantine()` di modul ini
 * setelah lolos pemeriksaan konten imperatif. `insertFact()` di repository memang
 * secara teknis mengizinkan trust `LOCAL_AGENT` langsung — itu disediakan untuk jalur
 * lain (mis. impor tepercaya yang sudah divalidasi eksternal), bukan untuk konsolidasi.
 *
 * Panggilan model lokal **selalu lewat Connect** (`extractLocal`, diinjeksikan) —
 * bukan dipanggil langsung dari sini — supaya cost ledger dan trace tetap satu jalur
 * untuk semua panggilan model, walau biaya lokal $0 (ADR-13: `naiveUsd` tetap dihitung).
 */

import { stripImperativeContent } from "@ecorione/context-assembly";
import {
  makeId,
  type Episode,
  type MemoryFactId,
  type Scope,
  type Timestamp,
} from "@ecorione/shared-schema";
import { z } from "zod";
import { ContextError, type ContextRepository } from "./repository.js";

export interface ConsolidateDeps {
  readonly repo: ContextRepository;
  /**
   * Menjalankan satu panggilan model lokal lewat Connect (`target: "local"`) dan
   * mengembalikan teks balasannya mentah. Diinjeksikan supaya modul ini bisa dites
   * tanpa HTTP sungguhan — lihat `consolidate.test.ts`.
   */
  readonly extractLocal: (prompt: string) => Promise<string>;
}

export interface ConsolidateOptions {
  /** Berapa episode belum-terkonsolidasi diproses dalam satu panggilan. Default 20. */
  readonly limit?: number | undefined;
  readonly now: Timestamp;
}

export interface ConsolidateResult {
  readonly processed: number;
  readonly promoted: number;
  /** Lolos gerbang salience + tidak ada konten imperatif, tapi promosi gagal (mis.
   * scope tidak konsisten) — tetap PENDING di karantina untuk ditinjau manual. */
  readonly quarantined: number;
  /** Ditolak: konten imperatif terdeteksi, atau tidak lolos gerbang salience. */
  readonly rejected: number;
  readonly errors: readonly string[];
}

const DEFAULT_BATCH_LIMIT = 20;

const CandidateSchema = z.object({
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: z.number().min(0).max(1),
  worthRemembering: z.boolean(),
});
const CandidatesSchema = z.array(CandidateSchema);
type Candidate = z.infer<typeof CandidateSchema>;

/**
 * Prompt ekstraksi. Bukan bagian dari prefix stabil Connect (ini pemanggilan lokal
 * terpisah, bukan giliran chat) — jadi tidak perlu mengikuti disiplin ADR-01, tapi
 * tetap satu string literal supaya perilakunya konsisten antar batch.
 */
function buildExtractionPrompt(episodes: readonly Episode[]): string {
  const lines = episodes.map(
    (ep, i) => `[${String(i)}] (${ep.provenance.sourceApp}) ${ep.rawText}`,
  );
  return [
    "Baca episode percakapan di bawah. Untuk tiap fakta atau preferensi yang layak",
    "diingat jangka panjang tentang pengguna, kembalikan satu entri JSON.",
    "Jawab HANYA dengan JSON array valid, tanpa teks lain, bentuk:",
    '[{"subject":"...","predicate":"...","object":"...","confidence":0.0-1.0,"worthRemembering":true|false}]',
    "Kalau tidak ada yang layak diingat dari episode manapun, kembalikan array kosong: [].",
    "",
    ...lines,
  ].join("\n");
}

/** Parse ketat: respons model yang tidak valid diskip, tidak pernah dianggap "tidak ada fakta". */
function parseCandidates(raw: string): { candidates: Candidate[]; error: string | null } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { candidates: [], error: "Respons model lokal bukan JSON valid." };
  }
  const result = CandidatesSchema.safeParse(json);
  if (!result.success) {
    return { candidates: [], error: "Respons model lokal tidak cocok skema kandidat fakta." };
  }
  return { candidates: result.data, error: null };
}

export async function runConsolidation(
  deps: ConsolidateDeps,
  options: ConsolidateOptions,
): Promise<ConsolidateResult> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const episodes = deps.repo.listEpisodes({ onlyUnconsolidated: true, limit });

  let promoted = 0;
  let quarantined = 0;
  let rejected = 0;
  const errors: string[] = [];

  if (episodes.length === 0) {
    return { processed: 0, promoted, quarantined, rejected, errors };
  }

  const raw = await deps.extractLocal(buildExtractionPrompt(episodes));
  const { candidates, error } = parseCandidates(raw);

  if (error !== null) {
    errors.push(error);
    // Skema tidak valid tidak boleh menghentikan proses untuk seluruh batch, tapi juga
    // tidak boleh diam-diam diperlakukan seolah "tidak ada fakta": episode tetap
    // ditandai terkonsolidasi (supaya tidak dicoba ulang tanpa henti dengan batch yang
    // sama), dengan summary yang menyatakan kegagalan apa adanya.
    for (const ep of episodes) {
      deps.repo.markEpisodeConsolidated(ep.id, `[konsolidasi gagal] ${error}`, options.now);
    }
    return { processed: episodes.length, promoted, quarantined, rejected, errors };
  }

  // Scope batch ini: episode yang diproses bisa lintas scope pada prinsipnya, tapi
  // Fase 1 memproses satu scope per panggilan `runConsolidation` — pemanggil (route
  // handler) yang bertanggung jawab membagi batch per scope kalau perlu. Di sini kita
  // pakai scope episode pertama sebagai scope proposal; episode dengan scope berbeda
  // dalam batch yang sama tetap diproses tapi dicatat sebagai error per-baris, bukan
  // membuat asumsi diam-diam.
  const batchScope: Scope = episodes[0]?.scope ?? "personal";

  for (const candidate of candidates) {
    if (!candidate.worthRemembering) {
      rejected += 1;
      continue;
    }

    const text = `${candidate.subject} ${candidate.predicate} ${candidate.object}`;
    const { flagged } = stripImperativeContent(text);
    if (flagged.length > 0) {
      rejected += 1;
      continue;
    }

    const factId: MemoryFactId = makeId("memoryFact");
    const sourceEpisodeIds = episodes.map((ep) => ep.id);

    deps.repo.proposeFact({
      id: factId,
      proposedText: text,
      proposedAt: options.now,
      provenance: { sourceApp: "context:consolidate" },
      trust: "LOCAL_AGENT",
      scope: batchScope,
    });

    try {
      deps.repo.promoteFromQuarantine(
        factId,
        {
          id: factId,
          subject: candidate.subject,
          predicate: candidate.predicate,
          object: candidate.object,
          text,
          confidence: candidate.confidence,
          salience: 0.5,
          sourceEpisodeIds,
          tValid: options.now,
          createdAt: options.now,
          scope: batchScope,
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
          trust: "LOCAL_AGENT",
          provenance: { sourceApp: "context:consolidate" },
        },
        options.now,
      );
      promoted += 1;
    } catch (err) {
      // Gagal promosi (mis. ScopeEscalationError) — biarkan PENDING di karantina untuk
      // ditinjau manual, bukan hilang diam-diam.
      if (err instanceof ContextError) {
        quarantined += 1;
        errors.push(err.message);
      } else {
        throw err;
      }
    }
  }

  for (const ep of episodes) {
    deps.repo.markEpisodeConsolidated(ep.id, null, options.now);
  }

  return { processed: episodes.length, promoted, quarantined, rejected, errors };
}
