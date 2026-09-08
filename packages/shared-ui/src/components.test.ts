import { describe, expect, it } from "vitest";

import { button, escapeHtml, input, renderComponentCss, statusChip } from "./components.js";

describe("escapeHtml", () => {
  it("menetralkan seluruh karakter penanda markup", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("tidak melakukan double-escape", () => {
    // `&` diproses lewat tabel yang sama, bukan dua lintasan replace.
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("button", () => {
  it("tidak pernah meloloskan tag dari label", () => {
    const html = button({ variant: "primary", label: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("primer memakai gold + accent-ink, sekunder hanya hairline", () => {
    expect(button({ variant: "primary", label: "Hubungkan" })).toContain("ecr-btn--primary");
    expect(button({ variant: "secondary", label: "Batalkan" })).toContain("ecr-btn--secondary");
    const css = renderComponentCss();
    expect(css).toContain(".ecr-btn--primary { background: var(--accent);");
    expect(css).toContain("color: var(--accent-ink); }");
    expect(css).toContain("border-color: var(--border)");
  });

  it("tombol dinonaktifkan terlihat berbeda, dan hover tidak berlaku saat disabled (design.md §8)", () => {
    const css = renderComponentCss();
    expect(css).toContain(".ecr-btn:disabled { cursor: not-allowed; opacity: 0.5; }");
    expect(css).toContain(".ecr-btn--primary:hover:not(:disabled)");
    expect(css).toContain(".ecr-btn--secondary:hover:not(:disabled)");
  });
});

describe("statusChip", () => {
  it("selalu merender label teks, bukan warna saja", () => {
    // design.md §8: status wajib disertai label. Dot-nya aria-hidden karena warna
    // sendirian tidak menyampaikan apa pun ke teknologi bantu.
    for (const status of ["ok", "warn", "err"] as const) {
      const html = statusChip({ status, label: "Perlu setup" });
      expect(html).toContain("Perlu setup");
      expect(html).toContain(`ecr-chip--${status}`);
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("meng-escape label", () => {
    const html = statusChip({ status: "err", label: '<img src=x onerror="1">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("input", () => {
  it("nilai tidak bisa keluar dari atribut", () => {
    const html = input({ value: '" onfocus="alert(1)', name: "koneksi" });
    expect(html).not.toContain('onfocus="alert(1)"');
    expect(html).toContain("&quot; onfocus=&quot;alert(1)");
    expect(html).toContain('name="koneksi"');
  });

  it("memakai huruf mono dan fokus garis emas tipis", () => {
    const css = renderComponentCss();
    expect(css).toContain("font-family: var(--font-mono)");
    expect(css).toContain(".ecr-input:focus-visible {");
    expect(css).toContain("outline: 1px solid var(--accent);");
  });
});
