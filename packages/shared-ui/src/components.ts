/**
 * "Perlengkapan" (fittings) — `design.md` §7, tabel PRL.01–PRL.03.
 *
 * Sengaja framework-agnostik: fungsi-fungsi ini mengembalikan **string HTML** plus CSS-nya,
 * tanpa React/Vue. Alasannya sama dengan alasan paket ini tanpa dependensi runtime — ia
 * dipakai halaman server-rendered maupun browser, dan mengunci design system ke satu
 * framework berarti fase berikutnya harus menulis ulang tokennya.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape teks sebelum diinterpolasi ke HTML.
 *
 * Bukan kehati-hatian berlebihan: label tombol dan nilai input datang dari nama koneksi,
 * nama provider, dan isi memori — data tak-tepercaya (AGENTS.md aturan 2). Design system
 * yang memancarkan string mentah adalah vektor XSS yang tersebar ke seluruh aplikasi.
 * `&` diganti lewat tabel yang sama supaya tidak terjadi double-escaping.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

export type ButtonVariant = "primary" | "secondary";

export interface ButtonOptions {
  variant: ButtonVariant;
  label: string;
}

/**
 * PRL.01 — tombol utama & sekunder.
 *
 * Primer memakai latar gold dengan teks `--accent-ink`; ini satu-satunya bidang gold yang
 * diizinkan `design.md` §2, dan ukurannya kecil dengan sengaja. Sekunder transparan dengan
 * hairline `--border` — pemisah utama identitas ini adalah garis, bukan bidang warna (§6).
 */
export function button(options: ButtonOptions): string {
  const cls = `ecr-btn ecr-btn--${options.variant}`;
  return `<button type="button" class="${cls}">${escapeHtml(options.label)}</button>`;
}

export type StatusTone = "ok" | "warn" | "err";

export interface StatusChipOptions {
  status: StatusTone;
  /**
   * Wajib, bukan opsional. `design.md` §8: status **selalu** disertai label teks. Warna
   * dot sendirian tidak terbaca oleh pengguna buta warna maupun screen reader, jadi
   * tipenya yang menolak — bukan review kode yang harus mengingatkannya tiap kali.
   */
  label: string;
}

/** PRL.02 — indikator status: dot 6px + label teks, tanpa pill besar. */
export function statusChip(options: StatusChipOptions): string {
  const cls = `ecr-chip ecr-chip--${options.status}`;
  // Dot murni dekoratif; yang dibaca teknologi bantu adalah labelnya.
  const dot = `<span class="ecr-chip__dot" aria-hidden="true"></span>`;
  return `<span class="${cls}">${dot}${escapeHtml(options.label)}</span>`;
}

export interface InputOptions {
  value: string;
  name: string;
}

/** PRL.03 — bidang input: huruf mono, hairline border, fokus jadi garis emas tipis. */
export function input(options: InputOptions): string {
  const name = escapeHtml(options.name);
  const value = escapeHtml(options.value);
  return `<input class="ecr-input" type="text" name="${name}" value="${value}" />`;
}

/**
 * CSS untuk ketiga perlengkapan di atas. Semuanya membaca custom property, jadi satu blok
 * ini benar di kedua tema tanpa cabang tambahan.
 */
export function renderComponentCss(): string {
  return [
    ".ecr-btn {",
    "  font-family: var(--font-body);",
    "  font-weight: 600;",
    "  font-size: 12.5px;",
    "  border-radius: var(--radius-sm);",
    "  height: 33px;",
    "  padding: 0 15px;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  cursor: pointer;",
    "  border: 1px solid transparent;",
    "}",
    // Tombol dinonaktifkan (mis. kirim tanpa draft, forget yang sedang diproses) harus
    // terlihat berbeda — bukan cuma kehilangan interaktivitas secara diam-diam (design.md §8).
    ".ecr-btn:disabled { cursor: not-allowed; opacity: 0.5; }",
    "",
    "/* Satu-satunya bidang gold yang diizinkan design.md §2 — kecil, elemen aksi. */",
    ".ecr-btn--primary { background: var(--accent); color: var(--accent-ink); }",
    ".ecr-btn--primary:hover:not(:disabled) { background: var(--accent-strong); }",
    "",
    ".ecr-btn--secondary { background: transparent; border-color: var(--border); color: var(--text); }",
    ".ecr-btn--secondary:hover:not(:disabled) { border-color: var(--accent); }",
    "",
    ".ecr-chip {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 7px;",
    "  font-size: 12px;",
    "  color: var(--text-muted);",
    "}",
    ".ecr-chip__dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }",
    ".ecr-chip--ok .ecr-chip__dot { background: var(--success); }",
    ".ecr-chip--warn .ecr-chip__dot { background: var(--warning); }",
    ".ecr-chip--err .ecr-chip__dot { background: var(--danger); }",
    "",
    ".ecr-input {",
    "  font-family: var(--font-mono);",
    "  font-size: 12px;",
    "  height: 32px;",
    "  padding: 0 10px;",
    "  color: var(--text);",
    "  background: var(--surface-2);",
    "  border: 1px solid var(--border);",
    "  border-radius: var(--radius-sm);",
    "}",
    "",
    "/* Fokus = garis emas tipis (design.md §7 PRL.03, §8 focus state jelas). */",
    ".ecr-input:focus-visible {",
    "  border-color: var(--accent);",
    "  outline: 1px solid var(--accent);",
    "  outline-offset: 1px;",
    "}",
    "",
  ].join("\n");
}
