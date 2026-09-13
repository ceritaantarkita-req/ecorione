import { describe, expect, it } from "vitest";

import {
  applySidebarCollapsed,
  DEFAULT_SIDEBAR_COLLAPSED,
  persistSidebarCollapsed,
  readStoredSidebarCollapsed,
  SIDEBAR_BOOTSTRAP_SCRIPT,
  SIDEBAR_STORAGE_KEY,
  type SidebarStorage,
} from "./sidebar.js";

function memoryStorage(initial?: string): SidebarStorage {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(SIDEBAR_STORAGE_KEY, initial);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** Storage yang melempar bahkan saat dibaca — Safari private mode, iframe yang diblokir. */
const hostileStorage: SidebarStorage = {
  getItem() {
    throw new Error("storage diblokir");
  },
  setItem() {
    throw new Error("storage diblokir");
  },
};

describe("readStoredSidebarCollapsed", () => {
  it("mengembalikan status tersimpan", () => {
    expect(readStoredSidebarCollapsed(memoryStorage("1"))).toBe(true);
    expect(readStoredSidebarCollapsed(memoryStorage("0"))).toBe(false);
  });

  it("jatuh ke default kalau kosong atau nilainya tidak dikenal", () => {
    expect(readStoredSidebarCollapsed(memoryStorage())).toBe(DEFAULT_SIDEBAR_COLLAPSED);
    expect(readStoredSidebarCollapsed(memoryStorage("expanded"))).toBe(
      DEFAULT_SIDEBAR_COLLAPSED,
    );
  });

  it("tidak melempar saat storage sendiri melempar", () => {
    expect(() => readStoredSidebarCollapsed(hostileStorage)).not.toThrow();
    expect(readStoredSidebarCollapsed(hostileStorage)).toBe(DEFAULT_SIDEBAR_COLLAPSED);
  });
});

describe("persistSidebarCollapsed", () => {
  it("menyimpan dan bisa dibaca ulang", () => {
    const storage = memoryStorage();
    expect(persistSidebarCollapsed(true, storage)).toBe(true);
    expect(readStoredSidebarCollapsed(storage)).toBe(true);
    expect(persistSidebarCollapsed(false, storage)).toBe(true);
    expect(readStoredSidebarCollapsed(storage)).toBe(false);
  });

  it("melaporkan gagal tanpa melempar", () => {
    expect(persistSidebarCollapsed(true, hostileStorage)).toBe(false);
  });
});

describe("applySidebarCollapsed", () => {
  it("menyetel data-sidebar=collapsed saat true", () => {
    const seen: string[] = [];
    const root = {
      setAttribute(name: string, value: string) {
        seen.push(`set ${name}=${value}`);
      },
      removeAttribute(name: string) {
        seen.push(`remove ${name}`);
      },
    } as unknown as Element;
    applySidebarCollapsed(true, root);
    expect(seen).toEqual(["set data-sidebar=collapsed"]);
  });

  it("melepas atribut saat false, tidak menyetel nilai kosong", () => {
    const seen: string[] = [];
    const root = {
      setAttribute(name: string, value: string) {
        seen.push(`set ${name}=${value}`);
      },
      removeAttribute(name: string) {
        seen.push(`remove ${name}`);
      },
    } as unknown as Element;
    applySidebarCollapsed(false, root);
    expect(seen).toEqual(["remove data-sidebar"]);
  });
});

describe("SIDEBAR_BOOTSTRAP_SCRIPT", () => {
  it("sinkron, dibungkus try/catch, dan memakai kunci yang sama", () => {
    // Kalau atribut baru dipasang setelah bundle dimuat, sidebar sempat melompat lebar.
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).toContain(SIDEBAR_STORAGE_KEY);
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).toContain("try {");
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).toContain("data-sidebar");
    expect(SIDEBAR_BOOTSTRAP_SCRIPT).not.toContain("await");
  });
});
