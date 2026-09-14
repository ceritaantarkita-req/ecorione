/**
 * Resolusi identitas model lokal lewat boundary provider — bukan deklarasi operator.
 *
 * Rencana W13 (`docs/immutable-local-model-identity-plan.md` langkah 2) menuliskan:
 * *"Resolve the local runtime identity at startup/preflight through the existing local
 * provider boundary; never infer a digest from the alias string."* Implementasi yang
 * di-merge hanya membaca `ECORIONE_LOCAL_MODEL_DIGEST` dari env/settings dan tidak pernah
 * memeriksa apakah digest itu cocok dengan model yang benar-benar dilayani, sehingga
 * `modelIdentityPinned=true` adalah klaim, bukan bukti (audit 2026-09-14 S2-5).
 *
 * Modul ini menutup celah itu untuk runtime yang punya provenance API. Ollama — runtime
 * default ECORIONE — mengekspos `GET /api/tags` yang mengembalikan digest asli setiap
 * model yang terpasang. Runtime OpenAI-compatible lain yang tidak punya endpoint itu
 * tetap didukung, tapi hasilnya dilaporkan apa adanya sebagai `declared-unverified`,
 * bukan dinaikkan jadi `pinned`.
 */
import { LocalModelDigestSchema, type LocalModelDigest } from "../local-model-identity.js";

export type LocalModelProvenanceStatus =
  /** Digest yang dideklarasikan operator cocok dengan yang dilaporkan runtime. */
  | "verified"
  /** Operator tidak mendeklarasikan apa pun; digest diambil dari runtime. */
  | "resolved"
  /** Operator mendeklarasikan digest, tapi runtime tidak bisa mengonfirmasi. */
  | "declared-unverified"
  /** Tidak ada deklarasi dan tidak ada provenance — identitas benar-benar tidak terikat. */
  | "unverified";

export interface LocalModelProvenance {
  readonly status: LocalModelProvenanceStatus;
  readonly digest: LocalModelDigest | null;
  /** Dari mana nilai itu berasal, untuk dicatat apa adanya di evidence. */
  readonly source: string;
  /** Kenapa verifikasi tidak bisa dilakukan — hanya untuk status yang tidak terverifikasi. */
  readonly detail?: string | undefined;
}

/** Digest yang dilaporkan runtime berbeda dari yang dideklarasikan operator. */
export class LocalModelDigestMismatchError extends Error {
  constructor(
    readonly modelTag: string,
    readonly declared: LocalModelDigest,
    readonly observed: LocalModelDigest,
  ) {
    super(
      `Digest model lokal tidak cocok untuk ${JSON.stringify(modelTag)}: ` +
        `dideklarasikan ${declared}, runtime melayani ${observed}. ` +
        "Evidence tidak boleh diatribusikan ke model yang salah.",
    );
    this.name = "LocalModelDigestMismatchError";
  }
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal | undefined },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface LocalProvenanceInput {
  readonly baseUrl: string;
  readonly modelTag: string;
  readonly declaredDigest?: LocalModelDigest | null | undefined;
  readonly fetchImpl?: FetchLike | undefined;
  readonly signal?: AbortSignal | undefined;
}

/**
 * `http://127.0.0.1:11434/v1` → `http://127.0.0.1:11434`.
 *
 * API native Ollama ada di root, sementara `localBaseUrl` menunjuk ke permukaan
 * OpenAI-compatible-nya. Hanya sufiks `/v1` yang dibuang; base URL lain dibiarkan apa
 * adanya supaya runtime yang menaruh keduanya di prefix sama tetap terlayani.
 */
export function provenanceBaseUrl(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  const path = url.pathname.replace(/\/+$/u, "");
  url.pathname = path.endsWith("/v1") ? path.slice(0, -"/v1".length) : path;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/u, "");
}

interface OllamaTag {
  readonly name?: unknown;
  readonly model?: unknown;
  readonly digest?: unknown;
}

function normalizeDigest(value: unknown): LocalModelDigest | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = LocalModelDigestSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Nama di `/api/tags` dinormalkan Ollama: `gemma4` ↔ `gemma4:latest`. Cocokkan keduanya
 * supaya selector yang ditulis operator tanpa tag tetap ketemu.
 */
function tagMatches(entry: OllamaTag, modelTag: string): boolean {
  const wanted = modelTag.trim().toLowerCase();
  const withDefault = wanted.includes(":") ? wanted : `${wanted}:latest`; // naming-gate:allow
  for (const candidate of [entry.name, entry.model]) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim().toLowerCase();
    if (value === wanted || value === withDefault) return true;
  }
  return false;
}

async function observeDigest(
  input: LocalProvenanceInput,
): Promise<
  { readonly digest: LocalModelDigest; readonly source: string } | { readonly detail: string }
> {
  const base = provenanceBaseUrl(input.baseUrl);
  if (base === null) return { detail: "localBaseUrl bukan URL yang bisa diurai." };

  const doFetch = input.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await doFetch(`${base}/api/tags`, { signal: input.signal });
  } catch {
    return { detail: "Runtime lokal tidak mengekspos provenance API yang bisa dihubungi." };
  }
  if (!response.ok) {
    return { detail: `Provenance API membalas ${String(response.status)}.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { detail: "Respons provenance API bukan JSON valid." };
  }

  const models =
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { models?: unknown }).models)
      ? ((payload as { models: unknown[] }).models as OllamaTag[])
      : null;
  if (models === null) return { detail: "Respons provenance API tidak memuat daftar model." };

  for (const entry of models) {
    if (!tagMatches(entry, input.modelTag)) continue;
    const digest = normalizeDigest(entry.digest);
    if (digest === null) {
      return { detail: "Runtime melaporkan model ini tanpa digest yang bisa dipakai." };
    }
    return { digest, source: `${base}/api/tags` };
  }
  return { detail: `Runtime tidak melaporkan model ${JSON.stringify(input.modelTag)}.` };
}

/**
 * Selesaikan identitas lokal. Melempar `LocalModelDigestMismatchError` kalau runtime
 * melayani model yang berbeda dari yang dideklarasikan: itu bukan keadaan yang boleh
 * didegradasi diam-diam jadi "unpinned", karena operator sudah menyatakan keyakinan yang
 * ternyata salah, dan hasilnya akan masuk ke evidence dengan atribusi yang keliru.
 */
export async function resolveLocalModelProvenance(
  input: LocalProvenanceInput,
): Promise<LocalModelProvenance> {
  const declared = input.declaredDigest ?? null;
  const observed = await observeDigest(input);

  if ("detail" in observed) {
    return declared === null
      ? { status: "unverified", digest: null, source: "none", detail: observed.detail }
      : {
          status: "declared-unverified",
          digest: declared,
          source: "operator-declaration",
          detail: observed.detail,
        };
  }

  if (declared === null) {
    return { status: "resolved", digest: observed.digest, source: observed.source };
  }
  if (declared !== observed.digest) {
    throw new LocalModelDigestMismatchError(input.modelTag, declared, observed.digest);
  }
  return { status: "verified", digest: observed.digest, source: observed.source };
}

interface CacheEntry {
  readonly key: string;
  readonly expiresAtMs: number;
  readonly value: LocalModelProvenance;
}

export const DEFAULT_PROVENANCE_TTL_MS = 60_000;

/**
 * Cache ber-TTL pendek. Provenance dibaca lewat jaringan, jadi tidak boleh diminta ulang
 * pada setiap completion; tapi juga tidak boleh disimpan selamanya, karena `ollama pull`
 * bisa mengganti isi tag kapan saja — dan justru itulah yang sedang dijaga.
 */
export class LocalModelProvenanceResolver {
  private entry: CacheEntry | null = null;

  constructor(
    private readonly ttlMs: number = DEFAULT_PROVENANCE_TTL_MS,
    private readonly fetchImpl?: FetchLike | undefined,
    /**
     * Clock monotonik untuk umur cache. Sengaja `performance.now()`, bukan wall clock:
     * TTL di sini mengukur "berapa lama sejak terakhir bertanya", yang tidak boleh
     * bergeser karena NTP atau perubahan zona waktu.
     */
    private readonly now: () => number = () => performance.now(),
  ) {}

  async resolve(input: LocalProvenanceInput): Promise<LocalModelProvenance> {
    const key = `${input.baseUrl} ${input.modelTag} ${input.declaredDigest ?? ""}`;
    const nowMs = this.now();
    const cached = this.entry;
    if (cached !== null && cached.key === key && cached.expiresAtMs > nowMs)
      return cached.value;

    const value = await resolveLocalModelProvenance({
      ...input,
      fetchImpl: input.fetchImpl ?? this.fetchImpl,
    });
    this.entry = { key, expiresAtMs: nowMs + this.ttlMs, value };
    return value;
  }

  invalidate(): void {
    this.entry = null;
  }
}
