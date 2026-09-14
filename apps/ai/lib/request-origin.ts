/**
 * Batas same-origin untuk seluruh permukaan HTTP `apps/ai`.
 *
 * Route handler Ai menyuntikkan `ECORIONE_INTERNAL_TOKEN` server-side ke Hub/Connect,
 * jadi browser tidak perlu memegang kredensial apa pun. Konsekuensinya: setiap request
 * yang sampai ke handler sudah terautentikasi dari sudut pandang Hub/Connect, termasuk
 * request yang dipicu oleh halaman web lain (classic confused deputy). Tanpa gerbang di
 * sini, situs mana pun yang dibuka user selagi ECORIONE hidup bisa memutasi runtime
 * settings, menulis Context/Artifact, memicu panggilan model, atau menghapus data.
 *
 * Kontrak (lihat ADR-34):
 *   - Method aman (GET/HEAD/OPTIONS) tidak pernah ditolak di sini; handler-nya sendiri
 *     yang tidak boleh punya efek samping.
 *   - Method mutasi wajib membuktikan same-origin lewat `Sec-Fetch-Site` bila header itu
 *     ada (semua browser yang mendukung fetch mengirimnya), atau lewat `Origin` yang
 *     cocok dengan host yang dilayani bila tidak.
 *   - Request tanpa `Sec-Fetch-Site` maupun `Origin` bukan berasal dari browser
 *     (curl, klien native, smoke test launcher). Browser selalu mengirim minimal satu
 *     dari keduanya pada request non-GET, jadi ketiadaan keduanya bukan vektor CSRF.
 *
 * `ECORIONE_AI_ALLOWED_ORIGINS` (dipisah koma) menambah origin tepercaya untuk
 * deployment yang menaruh Ai di belakang reverse proxy dengan hostname berbeda.
 */

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export type OriginVerdict =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

const ALLOWED: OriginVerdict = { allowed: true };

export interface OriginCheckInput {
  readonly method: string;
  /** Nilai header `Sec-Fetch-Site`, `null` bila tidak dikirim. */
  readonly secFetchSite: string | null;
  /** Nilai header `Origin`, `null` bila tidak dikirim. */
  readonly origin: string | null;
  /** Nilai header `Host` — host yang benar-benar dilayani proses ini. */
  readonly host: string | null;
  /** Origin tambahan yang dipercaya, sudah dinormalisasi pemanggil. */
  readonly allowedOrigins?: readonly string[] | undefined;
}

/** `https://Ecorione.Test:3000/` → `https://ecorione.test:3000`; `null` bila bukan URL absolut. */
function normalizeOrigin(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return `${parsed.protocol}//${parsed.host.toLowerCase()}`;
}

/** Daftar origin tepercaya dari env, aman dipanggil saat header belum tentu ada. */
export function parseAllowedOrigins(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.length === 0) return [];
  const out: string[] = [];
  for (const item of raw.split(",")) {
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    const normalized = normalizeOrigin(trimmed);
    if (normalized !== null) out.push(normalized);
  }
  return out;
}

/**
 * Cocokkan `Origin` dengan host yang dilayani. Skema tidak ikut dibandingkan karena
 * proses Ai tidak tahu apakah dirinya diakses lewat http atau https di belakang proxy;
 * yang menentukan adalah authority-nya, dan itulah yang dipakai browser sebagai batas
 * same-origin untuk tujuan CSRF pada deployment loopback.
 */
function originMatchesHost(origin: string, host: string): boolean {
  const parsed = normalizeOrigin(origin);
  if (parsed === null) return false;
  const originHost = parsed.slice(parsed.indexOf("//") + 2);
  return originHost === host.toLowerCase();
}

export function checkRequestOrigin(input: OriginCheckInput): OriginVerdict {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return ALLOWED;

  const allowedOrigins = input.allowedOrigins ?? [];
  const normalizedOrigin = input.origin === null ? null : normalizeOrigin(input.origin);

  if (normalizedOrigin !== null && allowedOrigins.includes(normalizedOrigin)) return ALLOWED;

  const site = input.secFetchSite;
  if (site !== null) {
    if (site === "same-origin") return ALLOWED;
    return {
      allowed: false,
      reason: `Sec-Fetch-Site \`${site}\` bukan \`same-origin\`.`,
    };
  }

  if (input.origin !== null) {
    if (normalizedOrigin === null) {
      return { allowed: false, reason: "Header Origin bukan URL absolut yang valid." };
    }
    if (input.host === null || input.host.length === 0) {
      return {
        allowed: false,
        reason: "Header Host tidak ada, Origin tidak bisa diverifikasi.",
      };
    }
    if (!originMatchesHost(input.origin, input.host)) {
      return { allowed: false, reason: "Header Origin tidak cocok dengan host yang dilayani." };
    }
    return ALLOWED;
  }

  // Tidak ada Sec-Fetch-Site maupun Origin → bukan request yang dibuat browser.
  return ALLOWED;
}
