/**
 * Penerapan & penyimpanan pilihan tema (`design.md` §9).
 *
 * Kontraknya satu atribut: `data-theme="light" | "dark"` di elemen root. Semua aturan
 * warna sudah dipasang `renderThemeCss()`; di sini hanya soal siapa yang menyetel atribut,
 * kapan, dan bagaimana preferensinya diingat.
 */

import { THEME_CHOICES, type ThemeChoice } from "./css.js";

/** Kunci penyimpanan, sama dengan yang dipakai mockup supaya preferensi lama tetap terbaca. */
export const THEME_STORAGE_KEY = "ecorione-theme-preview";

/**
 * Tema saat preferensi tidak diketahui (belum pernah memilih, atau storage gagal dibaca).
 *
 * Terang, bukan gelap: `design.md` §9 memakai "Terang" sebagai keadaan awal pratinjau, dan
 * bagi pengguna yang OS-nya terang, `prefers-color-scheme` di CSS sudah lebih dulu memberi
 * tampilan terang — nilai ini menjaga JS tidak melawan CSS.
 */
export const DEFAULT_THEME: ThemeChoice = "light";

/**
 * Permukaan minimal `localStorage` yang benar-benar dipakai. Sengaja struktural: paket ini
 * tanpa dependensi dan tanpa `lib.dom` di sisi pemanggil pun tetap bisa mengoper objek
 * apa pun yang bentuknya cocok (termasuk stub di test).
 */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/**
 * Pasang tema ke elemen root.
 *
 * `root` wajib dioper, tidak diam-diam mengambil `document.documentElement`: paket ini juga
 * diimpor kode server-rendered, dan menyentuh `document` di sana melempar.
 */
export function applyTheme(choice: ThemeChoice, root: Element): void {
  root.setAttribute("data-theme", choice);
}

/**
 * Baca preferensi tersimpan.
 *
 * Akses storage dibungkus try/catch karena `localStorage` bukan cuma bisa penuh — di
 * beberapa konteks (iframe pihak ketiga, Safari private mode, browser yang memblokir
 * site data) **mengakses propertinya saja sudah melempar**. Design system yang membuat
 * halaman mati gara-gara mengingat preferensi warna adalah bug, bukan fitur; setiap
 * kegagalan jatuh ke {@link DEFAULT_THEME}.
 */
export function readStoredTheme(storage: ThemeStorage): ThemeChoice {
  try {
    const saved = storage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Simpan preferensi. Gagal menyimpan tidak pernah dipropagasikan — pengguna kehilangan
 * ingatan preferensi, bukan halamannya. Mengembalikan `false` kalau penyimpanan gagal,
 * supaya pemanggil yang peduli bisa tahu tanpa harus menangkap exception sendiri.
 */
export function persistTheme(choice: ThemeChoice, storage: ThemeStorage): boolean {
  try {
    storage.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

/**
 * Snippet inline untuk `<head>`, **sebelum** konten dirender.
 *
 * Kenapa inline dan sinkron: kalau atribut `data-theme` baru dipasang setelah bundle JS
 * dimuat, halaman sempat tampil dengan tema yang salah lalu berkedip ke tema yang benar
 * (FOUT tema). Satu blok kecil tanpa dependensi di `<head>` menghilangkan jendela itu.
 *
 * Ditulis ES5 dan defensif dengan sengaja: ia jalan sebelum apa pun yang lain, jadi ia
 * tidak boleh mengandalkan bundler, polyfill, atau storage yang bisa diakses.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', ${JSON.stringify(DEFAULT_THEME)});
  }
})();`;
