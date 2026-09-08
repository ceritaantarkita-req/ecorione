import { describe, expect, it } from "vitest";

import {
  applyTheme,
  DEFAULT_THEME,
  persistTheme,
  readStoredTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  type ThemeStorage,
} from "./theme.js";

function memoryStorage(initial?: string): ThemeStorage {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(THEME_STORAGE_KEY, initial);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** Storage yang melempar bahkan saat dibaca — Safari private mode, iframe yang diblokir. */
const hostileStorage: ThemeStorage = {
  getItem() {
    throw new Error("storage diblokir");
  },
  setItem() {
    throw new Error("storage diblokir");
  },
};

describe("readStoredTheme", () => {
  it("mengembalikan pilihan yang tersimpan", () => {
    expect(readStoredTheme(memoryStorage("dark"))).toBe("dark");
  });

  it("jatuh ke default kalau kosong atau nilainya tidak dikenal", () => {
    expect(readStoredTheme(memoryStorage())).toBe(DEFAULT_THEME);
    // "system" pernah jadi opsi di draf lama; nilainya tidak boleh dihidupkan lagi.
    expect(readStoredTheme(memoryStorage("system"))).toBe(DEFAULT_THEME);
  });

  it("tidak melempar saat storage sendiri melempar", () => {
    // Halaman tidak boleh mati gara-gara mengingat preferensi warna.
    expect(() => readStoredTheme(hostileStorage)).not.toThrow();
    expect(readStoredTheme(hostileStorage)).toBe(DEFAULT_THEME);
  });
});

describe("persistTheme", () => {
  it("menyimpan dan bisa dibaca ulang", () => {
    const storage = memoryStorage();
    expect(persistTheme("dark", storage)).toBe(true);
    expect(readStoredTheme(storage)).toBe("dark");
  });

  it("melaporkan gagal tanpa melempar", () => {
    expect(persistTheme("dark", hostileStorage)).toBe(false);
  });
});

describe("applyTheme", () => {
  it("hanya menyetel data-theme di root yang dioper", () => {
    const seen: string[] = [];
    const root = {
      setAttribute(name: string, value: string) {
        seen.push(`${name}=${value}`);
      },
    } as unknown as Element;
    applyTheme("dark", root);
    expect(seen).toEqual(["data-theme=dark"]);
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  it("sinkron, dibungkus try/catch, dan memakai kunci yang sama", () => {
    // Kalau atribut baru dipasang setelah bundle dimuat, tema salah sempat terlihat.
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("try {");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme");
    expect(THEME_BOOTSTRAP_SCRIPT).not.toContain("await");
  });
});
