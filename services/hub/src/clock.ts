/**
 * Satu-satunya tempat clock nyata boleh masuk ke kode produksi paket ini (AGENTS.md
 * aturan 1, `eslint.config.js`). Route handler memanggil ini sekali per request lalu
 * meneruskan hasilnya — tidak pernah `Date.now()`/`new Date()` di tempat lain.
 */

import type { Timestamp } from "@ecorione/shared-schema";

export function nowIso(): Timestamp {
  return new Date().toISOString() as Timestamp;
}
