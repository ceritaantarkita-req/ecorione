/**
 * Penerapan & penyimpanan status collapse sidebar navigasi kiri.
 *
 * Pola sama persis dengan `theme.ts`: satu atribut (`data-sidebar="collapsed"` di elemen
 * root), storage dibungkus try/catch supaya kegagalan localStorage tidak pernah mematikan
 * halaman, dan bootstrap script inline supaya lebar sidebar sudah benar sebelum cat pertama
 * (mencegah kedipan lebar sidebar yang salah, sama alasannya dengan `THEME_BOOTSTRAP_SCRIPT`).
 */

/** Kunci penyimpanan — sengaja terpisah dari `THEME_STORAGE_KEY`, dua preferensi independen. */
export const SIDEBAR_STORAGE_KEY = "ecorione-sidebar-collapsed";

/**
 * Status collapse saat preferensi tidak diketahui (belum pernah diubah, atau storage gagal
 * dibaca). Default tidak collapse — sidebar penuh label saat pertama kali dibuka, konsisten
 * dengan `design.md` yang tidak pernah mengasumsikan pengguna sudah tahu ikon mana yang mana.
 */
export const DEFAULT_SIDEBAR_COLLAPSED = false;

/**
 * Permukaan minimal `localStorage` yang benar-benar dipakai. Sama strukturnya dengan
 * `ThemeStorage` di `theme.ts` — dideklarasikan ulang di sini (bukan diimpor) supaya modul ini
 * tetap bisa dibaca berdiri sendiri tanpa harus melompat ke file tema untuk tahu bentuk kontrak
 * storage-nya.
 */
export interface SidebarStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Pasang/lepas status collapse ke elemen root.
 *
 * `root` wajib dioper, tidak diam-diam mengambil `document.documentElement`: paket ini juga
 * diimpor kode server-rendered, dan menyentuh `document` di sana melempar.
 */
export function applySidebarCollapsed(collapsed: boolean, root: Element): void {
  if (collapsed) {
    root.setAttribute("data-sidebar", "collapsed");
  } else {
    root.removeAttribute("data-sidebar");
  }
}

/**
 * Baca preferensi tersimpan.
 *
 * Akses storage dibungkus try/catch karena `localStorage` bukan cuma bisa penuh — di beberapa
 * konteks (iframe pihak ketiga, Safari private mode, browser yang memblokir site data)
 * **mengakses propertinya saja sudah melempar**. Sidebar yang membuat halaman mati gara-gara
 * mengingat preferensi lebar adalah bug, bukan fitur; setiap kegagalan jatuh ke
 * {@link DEFAULT_SIDEBAR_COLLAPSED}.
 */
export function readStoredSidebarCollapsed(storage: SidebarStorage): boolean {
  try {
    return storage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return DEFAULT_SIDEBAR_COLLAPSED;
  }
}

/**
 * Simpan preferensi. Gagal menyimpan tidak pernah dipropagasikan — pengguna kehilangan
 * ingatan preferensi, bukan halamannya. Mengembalikan `false` kalau penyimpanan gagal, supaya
 * pemanggil yang peduli bisa tahu tanpa harus menangkap exception sendiri.
 */
export function persistSidebarCollapsed(collapsed: boolean, storage: SidebarStorage): boolean {
  try {
    storage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

/**
 * Snippet inline untuk `<head>`, **sebelum** konten dirender.
 *
 * Kenapa inline dan sinkron: kalau atribut `data-sidebar` baru dipasang setelah bundle JS
 * dimuat, sidebar sempat tampil lebar penuh lalu melompat ke lebar collapsed (atau
 * sebaliknya) begitu hydration selesai. Satu blok kecil tanpa dependensi di `<head>`
 * menghilangkan jendela lompatan-layout itu — sama alasannya dengan `THEME_BOOTSTRAP_SCRIPT`.
 *
 * Ditulis ES5 dan defensif dengan sengaja: ia jalan sebelum apa pun yang lain, jadi ia tidak
 * boleh mengandalkan bundler, polyfill, atau storage yang bisa diakses.
 */
export const SIDEBAR_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var saved = localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)});
    if (saved === '1') document.documentElement.setAttribute('data-sidebar', 'collapsed');
  } catch (e) {}
})();`;
