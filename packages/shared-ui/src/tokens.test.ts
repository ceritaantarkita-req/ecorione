import { describe, expect, it } from "vitest";

import {
  colorsDark,
  colorsLight,
  RADIUS_MAX,
  RADIUS_MIN,
  radius,
  SPACING_GRID,
  spacing,
  typography,
} from "./tokens.js";

/** Hex 6 digit huruf besar — bentuk yang dipakai tabel `design.md` §2. */
const HEX = /^#[0-9A-F]{6}$/;

describe("palet warna", () => {
  it("gelap dan terang punya himpunan token yang identik", () => {
    // Token yang ada di satu tema tapi hilang di tema lain adalah bug theming klasik:
    // var() jatuh ke nilai kosong tanpa error apa pun.
    expect(Object.keys(colorsLight).sort()).toEqual(Object.keys(colorsDark).sort());
  });

  it("semua nilai hex berbentuk sah", () => {
    for (const [token, value] of Object.entries(colorsDark)) {
      expect(value, `dark ${token}`).toMatch(HEX);
    }
    for (const [token, value] of Object.entries(colorsLight)) {
      expect(value, `light ${token}`).toMatch(HEX);
    }
  });

  it("menyalin nilai kunci dari design.md §2 apa adanya", () => {
    expect(colorsDark.bg).toBe("#0B0B0C");
    expect(colorsDark.accent).toBe("#C9A961");
    expect(colorsDark.text).toBe("#EDEAE2");
    // Revisi v0.5: dasar terang putih penuh, sama dengan surface.
    expect(colorsLight.bg).toBe("#FFFFFF");
    expect(colorsLight.surface).toBe(colorsLight.bg);
    expect(colorsLight.accent).toBe("#9C7A3B");
  });
});

describe("tipografi", () => {
  it("memakai tiga keluarga huruf design.md §3, masing-masing dengan fallback", () => {
    expect(typography.display).toContain("Fraunces");
    expect(typography.body).toContain("Manrope");
    expect(typography.mono).toContain("IBM Plex Mono");
    for (const stack of Object.values(typography)) {
      expect(stack.split(",").length).toBeGreaterThan(1);
    }
  });
});

describe("spacing & radius", () => {
  it("spacing selalu kelipatan grid 4px", () => {
    for (const [token, value] of Object.entries(spacing)) {
      expect(value % SPACING_GRID, `space-${token}`).toBe(0);
    }
  });

  it("radius tetap di rentang 5-14px", () => {
    for (const [token, value] of Object.entries(radius)) {
      expect(value, `radius-${token}`).toBeGreaterThanOrEqual(RADIUS_MIN);
      expect(value, `radius-${token}`).toBeLessThanOrEqual(RADIUS_MAX);
    }
  });
});
