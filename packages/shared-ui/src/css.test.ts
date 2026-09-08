import { describe, expect, it } from "vitest";

import { renderBaseCss, renderThemeCss, THEME_CHOICES } from "./css.js";

const css = renderThemeCss();

/** Ambil isi satu blok deklarasi, dicocokkan dari selector sampai `}` pertama. */
function block(pattern: RegExp): string {
  const match = css.match(pattern);
  expect(match, `blok tidak ditemukan: ${pattern.source}`).not.toBeNull();
  return match?.[1] ?? "";
}

function customProperties(source: string): string[] {
  return [...source.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] ?? "").sort();
}

// `:root {` dengan spasi hanya cocok ke root telanjang; `:root[...]` dan `:root:not(...)`
// punya karakter lain setelah `:root`.
const bareRoot = block(/^:root \{([\s\S]*?)^\}/m);
const mediaLight = block(
  /@media \(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme="dark"\]\) \{([\s\S]*?)\n {2}\}/,
);
const explicitLight = block(/^:root\[data-theme="light"\] \{([\s\S]*?)^\}/m);

describe("struktur tema tiga bagian", () => {
  it("memancarkan ketiga blok yang diwajibkan design.md §9", () => {
    expect(css).toContain(":root {");
    expect(css).toContain("@media (prefers-color-scheme: light) {");
    expect(css).toContain(':root:not([data-theme="dark"]) {');
    expect(css).toContain(':root[data-theme="light"] {');
  });

  it(":root telanjang berisi token gelap — dark adalah default, bukan override", () => {
    expect(bareRoot).toContain("--bg: #0B0B0C;");
    expect(bareRoot).toContain("--accent: #C9A961;");
  });

  it("preferensi OS terang tidak menimpa pilihan eksplisit Gelap", () => {
    // Tanpa :not([data-theme="dark"]), pengguna yang memilih Gelap di OS terang akan
    // mendapat tema terang — toggle-nya jadi tidak berfungsi.
    expect(css).toContain(':root:not([data-theme="dark"])');
  });
});

describe("regresi: tidak ada warna yang hanya hidup di dalam media query", () => {
  it("setiap custom property di blok terang juga ada di :root telanjang", () => {
    // Ada tiga keadaan, bukan dua: OS gelap/terang, dan OS "system" tanpa atribut
    // data-theme. Token yang cuma didefinisikan di dalam media query atau blok
    // [data-theme] hilang di keadaan ketiga dan merender var() kosong tanpa error.
    const root = new Set(customProperties(bareRoot));
    for (const prop of customProperties(mediaLight)) {
      expect(root.has(prop), `${prop} hanya ada di dalam media query`).toBe(true);
    }
    for (const prop of customProperties(explicitLight)) {
      expect(root.has(prop), `${prop} hanya ada di blok [data-theme="light"]`).toBe(true);
    }
  });

  it("kedua blok terang mendefinisikan token yang sama persis", () => {
    expect(customProperties(explicitLight)).toEqual(customProperties(mediaLight));
  });
});

describe("pilihan tema", () => {
  it("tepat dua opsi, dan 'system' bukan salah satunya", () => {
    // design.md §9: opsi ketiga selalu identik dengan salah satu dari dua ini tergantung
    // OS — menambah keputusan tanpa menambah hasil.
    expect(THEME_CHOICES).toHaveLength(2);
    expect(THEME_CHOICES).toEqual(["light", "dark"]);
    expect(THEME_CHOICES as readonly string[]).not.toContain("system");
  });
});

describe("base css", () => {
  it("mengambil warna dan huruf dari token, bukan nilai literal", () => {
    expect(renderBaseCss()).toContain("background: var(--bg)");
    expect(renderBaseCss()).toContain("color: var(--text)");
    expect(renderBaseCss()).toContain("font-family: var(--font-body)");
    expect(renderBaseCss()).toContain("img, svg, video { max-width: 100%; }");
    expect(renderBaseCss()).toContain("::selection { background: var(--accent);");
  });
});
