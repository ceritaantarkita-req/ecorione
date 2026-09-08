/**
 * Emisi CSS custom property untuk token `design.md` §2/§3/§6.
 *
 * Paket ini tidak punya dependensi runtime dan tidak menyentuh DOM di sini — fungsi-fungsi
 * ini hanya menghasilkan string, supaya bisa dipakai server-rendered (disisipkan ke `<style>`
 * saat build/SSR) maupun di browser.
 */

import {
  COLOR_TOKENS,
  colorsDark,
  colorsLight,
  elevation,
  radius,
  spacing,
  typography,
  type ColorToken,
} from "./tokens.js";

/**
 * Pilihan tema: **hanya dua**, Terang dan Gelap (`design.md` §9).
 *
 * Opsi ketiga "Sistem" sengaja tidak ada. Hasilnya selalu identik dengan salah satu dari
 * dua opsi ini tergantung OS pengguna, jadi ia menambah satu keputusan tanpa menambah satu
 * hasil — membingungkan tanpa menambah nilai. Jangan tambahkan lagi tanpa merevisi §9 dulu.
 *
 * Catatan penting: tidak adanya opsi "Sistem" **bukan** berarti preferensi OS diabaikan.
 * Pengguna yang belum pernah menyentuh toggle tetap dilayani `prefers-color-scheme` (lihat
 * {@link renderThemeCss}); yang dihapus adalah tombolnya, bukan perilakunya.
 */
export const THEME_CHOICES = ["light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** Label toggle sesuai bahasa produk (`design.md` §9, mockup: "Terang" / "Gelap"). */
export const THEME_LABELS: Record<ThemeChoice, string> = {
  light: "Terang",
  dark: "Gelap",
};

function declarations(entries: readonly (readonly [string, string])[], indent: string): string {
  return entries.map(([name, value]) => `${indent}--${name}: ${value};`).join("\n");
}

function colorDeclarations(palette: Record<ColorToken, string>, indent: string): string {
  // Selalu iterasi COLOR_TOKENS, bukan Object.keys(palette): dua tema wajib memancarkan
  // himpunan kunci yang sama persis, dalam urutan yang sama.
  return declarations(
    COLOR_TOKENS.map((token) => [token, palette[token]] as const),
    indent,
  );
}

/** Token yang tidak bergantung tema — huruf, radius, spacing, elevation. */
function staticDeclarations(indent: string): string {
  const fonts = Object.entries(typography).map(([k, v]) => [`font-${k}`, v] as const);
  const radii = Object.entries(radius).map(([k, v]) => [`radius-${k}`, `${v}px`] as const);
  const spaces = Object.entries(spacing).map(([k, v]) => [`space-${k}`, `${v}px`] as const);
  const shadows = Object.entries(elevation).map(([k, v]) => [`elevation-${k}`, v] as const);
  return declarations([...fonts, ...radii, ...spaces, ...shadows], indent);
}

/**
 * Blok custom property lengkap untuk kedua tema.
 *
 * Strukturnya tiga bagian, dan urutannya tidak bisa ditawar:
 *
 * 1. `:root` telanjang berisi token **gelap**. Dark adalah identitas utama (`design.md` §1
 *    prinsip 1, §9), jadi ia yang jadi nilai dasar — bukan hasil override.
 * 2. `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { … } }` —
 *    melayani pengguna yang OS-nya terang dan belum pernah menyentuh toggle. `:not(...)`
 *    penting supaya pilihan eksplisit "Gelap" tidak ditimpa preferensi OS.
 * 3. `:root[data-theme="light"] { … }` — toggle eksplisit menang di kedua arah.
 *
 * Kenapa token terang harus muncul **dua kali** (bagian 2 dan 3), dan kenapa tiap warna
 * wajib punya definisi di `:root` telanjang: ada tiga keadaan, bukan dua. Kalau sebuah
 * warna hanya didefinisikan di dalam media query atau di dalam blok `[data-theme]`, ia
 * hilang di keadaan ketiga — pengguna dengan setelan OS "system"/gelap dan tanpa atribut
 * `data-theme` — dan halaman merender variabel kosong tanpa error apa pun. `css.test.ts`
 * menjaga invarian ini.
 *
 * Blok `:root[data-theme="dark"]` tidak perlu ditulis: `:root` telanjang sudah gelap, dan
 * bagian 2 sudah mengecualikan `[data-theme="dark"]`.
 */
export function renderThemeCss(): string {
  return [
    "/* ecorione — token tema (design.md §2, §3, §6). Dark = default, bukan override. */",
    ":root {",
    colorDeclarations(colorsDark, "  "),
    "",
    staticDeclarations("  "),
    "}",
    "",
    '/* OS terang + belum ada pilihan eksplisit. :not([data-theme="dark"]) menjaga toggle. */',
    "@media (prefers-color-scheme: light) {",
    '  :root:not([data-theme="dark"]) {',
    colorDeclarations(colorsLight, "    "),
    "  }",
    "}",
    "",
    "/* Pilihan eksplisit Terang — menang atas preferensi OS gelap. */",
    ':root[data-theme="light"] {',
    colorDeclarations(colorsLight, "  "),
    "}",
    "",
  ].join("\n");
}

/**
 * Reset ringan + gaya elemen dasar. Semuanya membaca dari custom property, jadi satu blok
 * ini otomatis benar di kedua tema.
 */
export function renderBaseCss(): string {
  return [
    "*, *::before, *::after { box-sizing: border-box; }",
    "",
    "body {",
    "  margin: 0;",
    "  background: var(--bg);",
    "  color: var(--text);",
    "  font-family: var(--font-body);",
    "  -webkit-font-smoothing: antialiased;",
    "}",
    "",
    "/* Display serif untuk judul, mono untuk data teknis — design.md §3. */",
    "h1, h2, h3 { font-family: var(--font-display); font-weight: 600; margin: 0; text-wrap: balance; }",
    "code, kbd, samp, pre { font-family: var(--font-mono); }",
    "",
    "img, svg, video { max-width: 100%; }",
    "",
    "hr { border: 0; border-top: 1px solid var(--border); }",
    "",
    "/* Seleksi teks: bidang gold kecil, satu-satunya pemakaian gold sebagai latar yang",
    "   diizinkan design.md §2. Jangan pakai --accent untuk latar besar. */",
    "::selection { background: var(--accent); color: var(--accent-ink); }",
    "",
    "/* Focus state harus jelas — design.md §8 (aksesibilitas). */",
    ":focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }",
    "",
  ].join("\n");
}
