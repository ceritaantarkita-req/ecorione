/**
 * @ecorione/shared-ui
 *
 * Turunan kode dari `design.md`: token warna/tipografi/spacing (§2, §3, §6), kontrak tema
 * terang-gelap (§9), dan perlengkapan dasar (§7). Didefinisikan **sekali** di sini dan
 * diimpor semua modul — jangan menyalin nilai hex atau nama font ke dalam modul.
 *
 * Tanpa dependensi runtime dengan sengaja: paket ini dipakai kode server-rendered maupun
 * browser, dan setiap dependensi di sini jadi dependensi keduanya.
 */

export * from "./tokens.js";
export * from "./css.js";
export * from "./theme.js";
export * from "./components.js";
