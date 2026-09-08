/**
 * Konfigurasi server-side untuk route handler `app/api/*`.
 *
 * Sengaja dibaca lewat `process.env` langsung di sini, bukan lewat file `.env` yang
 * di-bundle — Next.js hanya meng-inline env var yang diprefix `NEXT_PUBLIC_` ke bundle
 * client, jadi `ECORIONE_INTERNAL_TOKEN` (tanpa prefix itu) tidak pernah sampai ke
 * browser selama modul ini hanya diimpor dari kode yang jalan di server (route handler).
 * Jangan impor file ini dari komponen client.
 */

/** Default sama dengan `.env.example` — port Hub 17024. */
const DEFAULT_HUB_URL = "http://127.0.0.1:17024";

export function hubUrl(): string {
  const value = process.env.ECORIONE_HUB_URL;
  return value !== undefined && value.length > 0 ? value : DEFAULT_HUB_URL;
}

/**
 * Token bearer internal. `undefined` kalau kosong/tidak diisi — konsisten dengan
 * `@ecorione/shared-server` (`CreateServerOptions.token`): auth nonaktif di Hub kalau
 * tidak diisi juga, jadi mengirim header tanpa nilai tetap aman untuk dev.
 */
export function internalToken(): string | undefined {
  const value = process.env.ECORIONE_INTERNAL_TOKEN;
  return value !== undefined && value.length > 0 ? value : undefined;
}
