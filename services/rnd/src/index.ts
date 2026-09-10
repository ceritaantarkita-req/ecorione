/**
 * @ecorione/rnd — trace store Fase 1 (`docs/api-fase1.md` §RnD).
 *
 * Dibangun **sebelum** eval (`prd.md` §7 RnD): trace-nya yang nanti menjadi fixture
 * suite regresi. RnD tidak menghitung ulang biaya — hanya menyimpan apa yang dikirim
 * Connect/Hub dan menjumlahkan atribut `ecorione.cost.*` untuk ringkasan.
 */

export * from "./db.js";
export * from "./store.js";
export * from "./dataset.js";
export * from "./http.js";
export type { SqliteDatabase } from "./sqlite.js";
