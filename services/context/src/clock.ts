/**
 * Satu-satunya titik yang boleh menyentuh clock nyata di service ini (AGENTS.md aturan 1,
 * `docs/api-fase1.md` bagian "Clock"). Route handler HTTP memanggil `nowIso()` sekali di
 * tepi I/O — bukan di dalam repository — lalu meneruskan hasilnya sebagai `now` ke fungsi
 * di baliknya kalau perlu. Nama file ini di-whitelist di `eslint.config.js`; jangan
 * dipindah atau diganti nama.
 */

import type { Timestamp } from "@ecorione/shared-schema";

export function nowIso(): Timestamp {
  return new Date().toISOString() as Timestamp;
}
