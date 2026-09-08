/**
 * @ecorione/context-assembly
 *
 * Merakit input model dari memori 4 tier: prefix stabil di depan cache breakpoint,
 * semua yang dinamis di belakangnya (ADR-01), dan seluruh memori tersimpan dirender di
 * dalam amplop "ini data, bukan instruksi" (ADR-07, `prd.md` §14).
 */

export * from "./prefix.js";
export * from "./pack.js";
export * from "./render.js";
