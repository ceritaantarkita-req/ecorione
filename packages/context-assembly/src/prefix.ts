/**
 * Prefix stabil — ADR-01, `prd.md` §7 (Connect outbound), `research.md` §2.1.
 *
 * Cache provider dicocokkan lewat **hash prefix**. Satu byte bergeser di antara dua
 * panggilan dan cache tidak pernah kena — **tanpa error, tanpa warning, tanpa apa pun**.
 * Yang terlihat cuma tagihan 10× lipat sebulan kemudian. Modul ini ada supaya kegagalan
 * senyap itu tidak bisa masuk tanpa sengaja.
 *
 * Hierarki invalidasi Anthropic: `tools` → `system` → `messages`. Mengubah definisi tool
 * membatalkan semuanya di bawahnya, jadi ketiganya diperlakukan sebagai satu unit yang
 * di-hash bersama, dengan cache breakpoint tepat di ujungnya (lihat `pack.ts`).
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import type { CoreMemory } from "@ecorione/shared-schema";

// ---------------------------------------------------------------------------
// Bentuk prefix
// ---------------------------------------------------------------------------

/**
 * Definisi tool sebagaimana dikirim ke provider.
 *
 * Tinggal di package ini, bukan di `shared-schema`, karena bentuknya ditentukan oleh
 * kontrak perakitan prefix — bukan oleh model data bersama. Kalau Connect nanti butuh
 * bentuk yang sama untuk hal lain, barulah ia naik ke `shared-schema` (AGENTS.md §Konvensi).
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().min(1),
  /** JSON Schema mentah. Urutan kunci di sini tidak boleh mempengaruhi digest. */
  inputSchema: z.record(z.string(), z.unknown()),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Semua yang berada **di depan** cache breakpoint. Tidak ada satu pun field di sini yang
 * boleh berubah antar panggilan dalam satu sesi.
 */
export interface StablePrefix {
  readonly systemPrompt: string;
  readonly toolDefinitions: readonly ToolDefinition[];
  /** L2 selalu ikut tiap panggilan, jadi ia bagian dari prefix — bukan konten dinamis. */
  readonly coreMemory: CoreMemory;
}

/**
 * Versi skema serialisasi. Menaikkannya **membatalkan seluruh cache yang ada** — itu
 * konsekuensi yang disengaja, dan angka ini yang membuatnya terlihat di diff, bukan
 * jadi kejutan di tagihan.
 */
export const PREFIX_SERIALIZATION_VERSION = 1;

// ---------------------------------------------------------------------------
// Serialisasi deterministik
// ---------------------------------------------------------------------------

export class NonSerializablePrefixError extends Error {
  constructor(path: string, value: unknown) {
    super(
      `Prefix stabil harus JSON-serializable dan deterministik. ` +
        `Nilai di "${path}" bertipe ${describeType(value)} — hilangkan atau ubah jadi string ` +
        `sebelum masuk prefix (ADR-01).`,
    );
    this.name = "NonSerializablePrefixError";
  }
}

function describeType(value: unknown): string {
  if (typeof value === "number") return `number non-finite (${String(value)})`;
  if (value === undefined) return "undefined";
  return typeof value;
}

/**
 * Pembanding kunci yang **tidak** memakai `localeCompare`: urutan locale berbeda antar
 * mesin dan antar versi ICU, jadi memakainya berarti digest yang sama bisa beda di laptop
 * dev dan di CI. Perbandingan code-unit selalu identik di mana pun.
 */
function byCodeUnit(a: readonly [string, unknown], b: readonly [string, unknown]): number {
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
}

/**
 * JSON kanonik: kunci objek diurutkan, tanpa whitespace, `undefined` dibuang persis seperti
 * `JSON.stringify` supaya `{a:1}` dan `{a:1,b:undefined}` menghasilkan byte yang sama.
 * Urutan **array dipertahankan** — urutan tool dan urutan blok memori inti ikut dikirim ke
 * provider, jadi mengurutkannya di sini justru menyembunyikan divergensi yang nyata.
 */
function canonicalize(value: unknown, path = "$"): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new NonSerializablePrefixError(path, value);
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        const items = value.map((item, i) =>
          item === undefined ? "null" : canonicalize(item, `${path}[${i}]`),
        );
        return `[${items.join(",")}]`;
      }
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(byCodeUnit);
      const body = entries.map(
        ([k, v]) => `${JSON.stringify(k)}:${canonicalize(v, `${path}.${k}`)}`,
      );
      return `{${body.join(",")}}`;
    }
    default:
      throw new NonSerializablePrefixError(path, value);
  }
}

/**
 * Bentuk prefix yang di-hash. Isinya **persis apa yang dikirim ke provider — tidak lebih,
 * tidak kurang**.
 *
 * Karena itu `updatedAt` dan `readOnly` blok memori inti sengaja tidak ikut: keduanya
 * metadata penyimpanan yang tidak pernah dirender ke model (lihat `render.ts`). Ikut
 * meng-hash-nya berarti `assertPrefixStable` berteriak soal cache yang hilang padahal
 * teks yang dikirim identik — alarm palsu yang cepat membuat orang berhenti percaya alarm.
 */
function prefixShape(prefix: StablePrefix): unknown {
  return {
    v: PREFIX_SERIALIZATION_VERSION,
    systemPrompt: prefix.systemPrompt,
    tools: prefix.toolDefinitions.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    core: prefix.coreMemory.blocks.map((b) => ({
      label: b.label,
      description: b.description,
      value: b.value,
    })),
  };
}

/** Serialisasi deterministik dari prefix. Ini yang di-hash, dan ini yang di-diff. */
export function serializePrefix(prefix: StablePrefix): string {
  return canonicalize(prefixShape(prefix));
}

/** SHA-256 hex dari serialisasi kanonik. Identitas prefix untuk keperluan cache. */
export function prefixDigest(prefix: StablePrefix): string {
  return createHash("sha256").update(serializePrefix(prefix), "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Deteksi konten volatil
// ---------------------------------------------------------------------------

export const VOLATILE_KINDS = ["iso-timestamp", "uuid", "unix-epoch", "iso-date"] as const;
export type VolatileKind = (typeof VOLATILE_KINDS)[number];

export interface VolatileFinding {
  readonly kind: VolatileKind;
  readonly match: string;
  readonly index: number;
}

/**
 * Urutan penting: pola paling spesifik lebih dulu, lalu tumpang-tindih dibuang. Tanpa itu
 * `2026-09-08T10:00:00Z` akan dilaporkan dua kali (sebagai timestamp *dan* sebagai tanggal).
 */
const VOLATILE_PATTERNS: ReadonlyArray<{ kind: VolatileKind; re: RegExp; why: string }> = [
  {
    kind: "iso-timestamp",
    re: /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    why: "timestamp ISO-8601 — berubah tiap panggilan",
  },
  {
    kind: "uuid",
    re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    why: "UUID — request/session ID yang bocor ke prefix",
  },
  {
    // 10–13 digit: detik atau milidetik epoch. Inilah bentuk `Date.now()` yang disuntikkan.
    kind: "unix-epoch",
    re: /(?<![\d.])\d{10,13}(?![\d.])/g,
    why: "angka mirip Unix epoch — kemungkinan besar hasil Date.now()",
  },
  {
    kind: "iso-date",
    re: /\d{4}-\d{2}-\d{2}/g,
    why: "tanggal telanjang — berubah tiap hari, cache mati tiap tengah malam",
  },
];

/** Penjelasan satu baris per jenis temuan, dipakai di pesan error. */
export function explainVolatileKind(kind: VolatileKind): string {
  return VOLATILE_PATTERNS.find((p) => p.kind === kind)?.why ?? kind;
}

/**
 * Memindai teks untuk konten yang membunuh prefix caching. Dipakai untuk **gagal keras
 * lebih awal**, karena kegagalan alaminya justru senyap sepenuhnya.
 *
 * Heuristik, jadi bisa false-positive (mis. tanggal yang memang bagian dari fakta tetap).
 * Itu trade-off yang benar arahnya: alarm palsu murah, cache yang hilang diam-diam mahal.
 */
export function findVolatilePatterns(text: string): VolatileFinding[] {
  const found: VolatileFinding[] = [];
  for (const { kind, re } of VOLATILE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const index = m.index;
      const match = m[0];
      const overlaps = found.some(
        (f) => index < f.index + f.match.length && f.index < index + match.length,
      );
      if (!overlaps) found.push({ kind, match, index });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

export interface VolatileLocation extends VolatileFinding {
  /** Di mana persisnya, mis. `coreMemory.blocks["persona"].value`. */
  readonly path: string;
}

/** Memindai seluruh permukaan prefix, bukan cuma satu string. */
export function findVolatileInPrefix(prefix: StablePrefix): VolatileLocation[] {
  const out: VolatileLocation[] = [];
  const scan = (path: string, text: string): void => {
    for (const f of findVolatilePatterns(text)) out.push({ ...f, path });
  };

  scan("systemPrompt", prefix.systemPrompt);
  for (const tool of prefix.toolDefinitions) {
    scan(`toolDefinitions[${quote(tool.name)}].description`, tool.description);
    scan(`toolDefinitions[${quote(tool.name)}].inputSchema`, canonicalize(tool.inputSchema));
  }
  for (const block of prefix.coreMemory.blocks) {
    scan(`coreMemory.blocks[${quote(block.label)}].description`, block.description);
    scan(`coreMemory.blocks[${quote(block.label)}].value`, block.value);
  }
  return out;
}

export class VolatilePrefixError extends Error {
  readonly findings: readonly VolatileLocation[];

  constructor(findings: readonly VolatileLocation[]) {
    super(formatVolatileReport(findings));
    this.name = "VolatilePrefixError";
    this.findings = findings;
  }
}

function formatVolatileReport(findings: readonly VolatileLocation[]): string {
  const lines = [
    `Prefix stabil mengandung ${findings.length} nilai yang berubah tiap panggilan (ADR-01).`,
    `Provider mencocokkan cache lewat hash prefix — nilai seperti ini membuat cache tidak`,
    `pernah kena, dan provider tidak melaporkan apa pun soal itu.`,
    "",
  ];
  for (const f of findings) {
    lines.push(
      `  ${f.path} @${f.index}: ${JSON.stringify(f.match)} — ${explainVolatileKind(f.kind)}`,
    );
  }
  lines.push(
    "",
    "Perbaikan: pindahkan nilai ini ke bagian dinamis context pack (setelah cache",
    "breakpoint), atau injeksikan lewat parameter `now` saat render — bukan ke system",
    "prompt, definisi tool, atau blok memori inti.",
  );
  return lines.join("\n");
}

/** Gerbang keras: dipanggil sebelum prefix dikirim ke provider pertama kali. */
export function assertPrefixCacheable(prefix: StablePrefix): void {
  const findings = findVolatileInPrefix(prefix);
  if (findings.length > 0) throw new VolatilePrefixError(findings);
}

// ---------------------------------------------------------------------------
// Diagnosis divergensi
// ---------------------------------------------------------------------------

export interface PrefixDivergence {
  /** Jalur persis yang berbeda, mis. `toolDefinitions["memory_search"].description`. */
  readonly path: string;
  readonly before: string;
  readonly after: string;
  /** Indeks karakter pertama yang berbeda; `null` kalau perbedaannya struktural. */
  readonly index: number | null;
}

export class PrefixDivergenceError extends Error {
  readonly divergences: readonly PrefixDivergence[];
  readonly digestBefore: string;
  readonly digestAfter: string;

  constructor(
    divergences: readonly PrefixDivergence[],
    digestBefore: string,
    digestAfter: string,
  ) {
    super(formatDivergenceReport(divergences, digestBefore, digestAfter));
    this.name = "PrefixDivergenceError";
    this.divergences = divergences;
    this.digestBefore = digestBefore;
    this.digestAfter = digestAfter;
  }
}

/**
 * Membandingkan dua prefix yang **seharusnya** identik. Lolos diam-diam kalau digest sama;
 * kalau beda, melempar error yang menyebut bagian mana yang bergeser beserta cuplikan
 * diff-nya — karena "cache miss" tanpa lokasi tidak menolong siapa pun jam 2 pagi.
 */
export function assertPrefixStable(a: StablePrefix, b: StablePrefix): void {
  const digestA = prefixDigest(a);
  const digestB = prefixDigest(b);
  if (digestA === digestB) return;
  throw new PrefixDivergenceError(diffPrefix(a, b), digestA, digestB);
}

/** Daftar semua perbedaan antara dua prefix. Kosong berarti byte-identik. */
export function diffPrefix(a: StablePrefix, b: StablePrefix): PrefixDivergence[] {
  const out: PrefixDivergence[] = [];

  if (a.systemPrompt !== b.systemPrompt) {
    out.push(textDivergence("systemPrompt", a.systemPrompt, b.systemPrompt));
  }

  diffKeyedList(
    "toolDefinitions",
    a.toolDefinitions,
    b.toolDefinitions,
    (t) => t.name,
    (path, x, y) => {
      if (x.description !== y.description) {
        out.push(textDivergence(`${path}.description`, x.description, y.description));
      }
      const sx = canonicalize(x.inputSchema);
      const sy = canonicalize(y.inputSchema);
      if (sx !== sy) out.push(textDivergence(`${path}.inputSchema`, sx, sy));
    },
    out,
  );

  diffKeyedList(
    "coreMemory.blocks",
    a.coreMemory.blocks,
    b.coreMemory.blocks,
    (blk) => blk.label,
    (path, x, y) => {
      if (x.description !== y.description) {
        out.push(textDivergence(`${path}.description`, x.description, y.description));
      }
      if (x.value !== y.value) {
        out.push(textDivergence(`${path}.value`, x.value, y.value));
      }
    },
    out,
  );

  if (out.length === 0) {
    // Jaring pengaman: digest berbeda tapi tidak ada bagian bernama yang berbeda berarti
    // `prefixShape` dan diagnosa ini tidak sinkron lagi. Lebih baik cuplikan mentah
    // daripada error yang bilang "ada yang berubah, entah apa".
    const sa = serializePrefix(a);
    const sb = serializePrefix(b);
    if (sa !== sb) out.push(textDivergence("<serialisasi>", sa, sb));
  }
  return out;
}

/**
 * Membandingkan dua daftar yang diidentifikasi lewat kunci (nama tool, label blok).
 * Urutan ikut dibandingkan: urutan tool dan urutan blok sampai ke provider apa adanya,
 * jadi tool yang sama dalam urutan berbeda tetap prefix yang berbeda.
 */
function diffKeyedList<T>(
  base: string,
  before: readonly T[],
  after: readonly T[],
  keyOf: (item: T) => string,
  compare: (path: string, x: T, y: T) => void,
  out: PrefixDivergence[],
): void {
  const keysBefore = before.map(keyOf);
  const keysAfter = after.map(keyOf);
  const mapBefore = new Map(before.map((item) => [keyOf(item), item]));
  const mapAfter = new Map(after.map((item) => [keyOf(item), item]));

  for (const key of keysBefore) {
    if (!mapAfter.has(key)) {
      out.push({ path: `${base}[${quote(key)}]`, before: "ada", after: "hilang", index: null });
    }
  }
  for (const key of keysAfter) {
    if (!mapBefore.has(key)) {
      out.push({ path: `${base}[${quote(key)}]`, before: "hilang", after: "ada", index: null });
    }
  }

  const shared = keysBefore.filter((k) => mapAfter.has(k));
  const sharedAfter = keysAfter.filter((k) => mapBefore.has(k));
  if (shared.join(" ") !== sharedAfter.join(" ")) {
    out.push({
      path: `${base}[urutan]`,
      before: shared.join(", "),
      after: sharedAfter.join(", "),
      index: null,
    });
  }

  for (const key of shared) {
    const x = mapBefore.get(key);
    const y = mapAfter.get(key);
    if (x === undefined || y === undefined) continue;
    compare(`${base}[${quote(key)}]`, x, y);
  }
}

function quote(key: string): string {
  return JSON.stringify(key);
}

function textDivergence(path: string, before: string, after: string): PrefixDivergence {
  return { path, before, after, index: firstDifference(before, after) };
}

/** Indeks karakter pertama yang berbeda. String identik tidak pernah sampai ke sini. */
function firstDifference(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return max;
}

const EXCERPT_RADIUS = 28;

/**
 * Cuplikan satu baris di sekitar titik perbedaan, dengan lebar karakter yang dipertahankan
 * (newline/tab jadi satu simbol) supaya penanda `^` benar-benar menunjuk kolom yang tepat.
 */
export function excerptAround(
  text: string,
  index: number,
  radius = EXCERPT_RADIUS,
): { readonly text: string; readonly caret: number } {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  const head = start > 0 ? "…" : "";
  const tail = end < text.length ? "…" : "";
  const body = text.slice(start, end).replaceAll("\n", "⏎").replaceAll("\t", "→");
  return { text: `${head}${body}${tail}`, caret: head.length + (index - start) };
}

const MAX_REPORTED_DIVERGENCES = 4;

function formatDivergenceReport(
  divergences: readonly PrefixDivergence[],
  digestBefore: string,
  digestAfter: string,
): string {
  const lines = [
    "Prefix stabil bergeser antar panggilan (ADR-01, AGENTS.md aturan 1).",
    `Digest: ${digestBefore.slice(0, 12)}… → ${digestAfter.slice(0, 12)}…`,
    "Konsekuensinya senyap: provider tidak akan pernah kena cache dan tidak melaporkan error.",
    "",
  ];

  for (const d of divergences.slice(0, MAX_REPORTED_DIVERGENCES)) {
    lines.push(`  Bagian: ${d.path}`);
    if (d.index === null) {
      lines.push(`    sebelum: ${d.before}`);
      lines.push(`    sesudah: ${d.after}`);
    } else {
      const before = excerptAround(d.before, d.index);
      const after = excerptAround(d.after, d.index);
      const pad = " ".repeat("    sebelum: ".length + before.caret);
      lines.push(`    sebelum: ${before.text}`);
      lines.push(`    sesudah: ${after.text}`);
      lines.push(`${pad}^ karakter ke-${d.index}`);
    }
    for (const hint of volatileHints(d)) lines.push(`    ${hint}`);
    lines.push("");
  }

  if (divergences.length > MAX_REPORTED_DIVERGENCES) {
    const sisa = divergences.length - MAX_REPORTED_DIVERGENCES;
    lines.push(`  … dan ${sisa} perbedaan lain.`, "");
  }

  lines.push(
    "Perbaikan: apa pun yang berubah tiap panggilan — jam, timestamp, UUID, hasil",
    "retrieval — harus pindah ke bagian dinamis context pack, setelah cache breakpoint.",
    "Kalau butuh waktu di dalam prefix, itu tandanya waktunya salah tempat, bukan tandanya",
    "prefix butuh clock.",
  );
  return lines.join("\n");
}

/**
 * Kalau bagian yang bergeser mengandung timestamp/UUID/epoch, sebut langsung — itu
 * penyebabnya di hampir semua kasus nyata, dan menyebutnya memotong sesi debug jadi detik.
 */
function volatileHints(d: PrefixDivergence): string[] {
  const findings = findVolatilePatterns(d.after);
  const source = findings.length > 0 ? findings : findVolatilePatterns(d.before);
  const sisi = findings.length > 0 ? "sesudah" : "sebelum";
  return source
    .slice(0, 2)
    .map(
      (f) =>
        `↳ pola volatil di sisi "${sisi}": ${JSON.stringify(f.match)} @${f.index} — ${explainVolatileKind(f.kind)}`,
    );
}
