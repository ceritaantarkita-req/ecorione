/**
 * Token desain ecorione — `design.md` §2 (warna), §3 (tipografi), §6 (spacing/radius/elevation).
 *
 * Semua nilai di sini **disalin** dari `design.md`, bukan dikarang. Kalau sebuah nilai perlu
 * berubah, ubah dokumennya dulu — file ini hanya turunannya (`design.md` §10: "turunkan token
 * warna (§2) jadi `packages/shared-ui`").
 *
 * Beberapa token yang dibutuhkan kontrak tema tidak muncul di tabel §2 (tabel dark tidak
 * mencantumkan `surface-3`, tabel light tidak mencantumkan `accent-strong`/`success`/`warning`/
 * `danger`, dan keduanya tidak mencantumkan `border-soft`/`accent-ink`). Nilainya diambil dari
 * mockup yang sudah disetujui (`docs/mockup.html`, eksekusi konkret yang dirujuk §6 dan §7) —
 * tetap transkripsi, bukan improvisasi. Ditandai `[mockup]` di bawah.
 *
 * Gold (`accent`) **tidak pernah** dipakai sebagai warna latar besar (`design.md` §2 baris
 * terakhir) — hanya garis, teks, ikon, dan elemen aksi kecil seperti tombol primer.
 */

/**
 * Mode gelap = identitas utama produk, bukan mode opsional (`design.md` §1 prinsip 1, §9).
 * Karena itu palet inilah yang duduk di `:root` telanjang saat dirender jadi CSS.
 */
export const colorsDark = {
  /** Dasar halaman. */
  bg: "#0B0B0C",
  /** Card/panel. */
  surface: "#151517",
  /** Elemen di atas card. */
  "surface-2": "#1C1C1F",
  /** [mockup] Lapis ketiga (inline code, badge kecil) — tabel §2 dark tidak menyebutnya. */
  "surface-3": "#232326",
  /** Garis pembatas — pemisah utama, lihat `elevation`. */
  border: "#2A2A2D",
  /** [mockup] Hairline yang lebih redup untuk pembatas internal. */
  "border-soft": "#1E1E21",
  /** Teks utama. */
  text: "#EDEAE2",
  /** Teks sekunder. */
  "text-muted": "#8B8880",
  /** Gold — satu-satunya warna yang "berbicara" (`design.md` §1 prinsip 2). */
  accent: "#C9A961",
  /** Hover/active dari gold. */
  "accent-strong": "#DBBE7E",
  /** [mockup] Teks/ikon di atas bidang gold. Satu-satunya tempat gold jadi latar. */
  "accent-ink": "#1B1608",
  /** Status aktif. */
  success: "#5E8770",
  /** Status perlu perhatian. */
  warning: "#B9793E",
  /** Status error. */
  danger: "#A6564A",
} as const satisfies Record<string, string>;

/**
 * Nama token warna, diturunkan dari kunci palet gelap. Konsumen dapat autocomplete dan
 * salah ketik jadi error kompilasi, bukan `undefined` diam-diam di runtime.
 */
export type ColorToken = keyof typeof colorsDark;

/** Urutan stabil untuk emisi CSS — dua tema selalu memancarkan kunci yang sama, berurutan sama. */
export const COLOR_TOKENS = Object.keys(colorsDark) as readonly ColorToken[];

/**
 * Mode terang "quiet luxury" dengan dasar putih penuh (`design.md` §2 revisi v0.5:
 * `--bg` = `--surface` = `#FFFFFF`). Card dibedakan dari latar lewat hairline `border`,
 * bukan lewat beda rona latar — konsisten dengan §6.
 *
 * Tipenya sengaja `Record<ColorToken, string>`: token yang ada di gelap tapi lupa
 * didefinisikan di terang adalah bug theming klasik, dan di sini compiler yang menangkapnya.
 */
export const colorsLight: Record<ColorToken, string> = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  "surface-2": "#F6F5F0",
  "surface-3": "#EFEDE5",
  border: "#E4E0D4",
  /** [mockup] */
  "border-soft": "#EDEAE0",
  text: "#1C1B17",
  "text-muted": "#7C786D",
  accent: "#9C7A3B",
  /** [mockup] Di terang, hover gold justru menggelap supaya kontras tetap naik. */
  "accent-strong": "#7F642F",
  /** [mockup] */
  "accent-ink": "#FFFFFF",
  /** [mockup] */
  success: "#3E6350",
  /** [mockup] */
  warning: "#A15F26",
  /** [mockup] */
  danger: "#883F35",
};

/**
 * Tipografi — `design.md` §3: Fraunces (display) + Manrope (body) + IBM Plex Mono.
 *
 * Mono bukan cuma untuk kode: dipakai juga untuk label field, kode plat, dan penomoran,
 * mengikuti konvensi gambar kerja arsitek (§3 paragraf tambahan, §4).
 *
 * Tiap stack membawa fallback sistem yang nyata — font webfont bisa gagal dimuat, dan
 * halaman tidak boleh jatuh ke serif default browser.
 */
export const typography = {
  display: '"Fraunces", ui-serif, Georgia, serif',
  body: '"Manrope", ui-sans-serif, system-ui, -apple-system, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
} as const satisfies Record<string, string>;

export type FontToken = keyof typeof typography;

/**
 * Spacing pada grid 4px (`design.md` §6). Semua nilai kelipatan {@link SPACING_GRID} —
 * "spacing terhitung" adalah salah satu dari empat prinsip visual (§1 prinsip 4).
 */
export const SPACING_GRID = 4;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const satisfies Record<string, number>;

export type SpacingToken = keyof typeof spacing;

/**
 * Radius 5–14px (`design.md` §6). Rentangnya sempit dengan sengaja: sudut yang terlalu
 * bulat membaca sebagai "friendly app", bukan dokumen perencanaan (§1 prinsip 4).
 */
export const RADIUS_MIN = 5;
export const RADIUS_MAX = 14;

export const radius = {
  /** Tombol, input, chip. */
  sm: 5,
  /** Card, panel, bubble pesan. */
  md: 9,
  /** Plat/kontainer besar. */
  lg: 14,
} as const satisfies Record<string, number>;

export type RadiusToken = keyof typeof radius;

/**
 * Elevation sengaja nyaris kosong (`design.md` §6: "shadow minim, hairline sebagai pemisah
 * utama"). **Pemisah default adalah `border`/`border-soft`, bukan bayangan.** Tidak ada
 * tangga shadow 1–5 di sini karena menambahkannya akan mengundang orang memakainya, dan
 * itu langsung melanggar §6.
 *
 * Satu-satunya "elevation" yang dipakai identitas ini adalah rel emas inset penanda item
 * aktif — garis, bukan blok, sesuai §1 prinsip 2.
 */
export const elevation = {
  none: "none",
  "active-rail": "inset 2px 0 0 var(--accent)",
} as const satisfies Record<string, string>;

export type ElevationToken = keyof typeof elevation;
