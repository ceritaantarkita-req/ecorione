#!/usr/bin/env node
/**
 * Pemindai kredensial — PRD §8, §20.
 *
 * Ini **jaring pengaman terakhir, bukan izin untuk ceroboh**. Ia berjalan di pre-commit
 * dan CI karena repo ini akan dipublikasikan, dan satu API key yang pernah ke-commit
 * tetap ada di git history selamanya walau file-nya dihapus belakangan.
 *
 * Sengaja tanpa dependensi: alat keamanan yang butuh `pnpm install` sukses lebih dulu
 * tidak bisa dipakai untuk memeriksa apa yang baru saja di-install.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".pnpm-store",
  ".turbo",
]);

/** Biner tidak dipindai isinya — tapi keberadaannya tetap dilaporkan kalau mencurigakan. */
const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".pdf",
  ".zip",
  ".node",
  ".wasm",
  ".db",
  ".sqlite",
]);

/**
 * Pola dipilih untuk sedikit false positive, bukan untuk cakupan maksimal: pemindai yang
 * sering salah akan dimatikan orang, dan pemindai yang mati tidak melindungi apa pun.
 */
const PATTERNS = [
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { name: "OpenRouter API key", re: /\bsk-or-v1-[A-Za-z0-9]{32,}/g },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  {
    name: "Kredensial di URL",
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]{6,}@/gi,
  },
];

/** File yang tidak boleh ada sama sekali di repo publik. */
const FORBIDDEN_FILES = [/^\.env$/, /^\.env\.(?!example$)/, /\.pem$/, /^credentials\.json$/];

/**
 * Baris yang sengaja berisi contoh pola. Tanpa ini, pemindainya sendiri dan dokumentasi
 * keamanan akan selalu gagal — dan orang akan belajar mengabaikan hasilnya.
 */
const ALLOW_MARKER = "secret-scan:allow";

const findings = [];

/**
 * Batas utama scanner adalah apa yang dapat masuk commit: file tracked plus file untracked
 * yang tidak di-ignore Git. File runtime lokal yang memang di-gitignore (mis. `.env`) tidak
 * boleh membuat `pnpm verify` gagal, tetapi file yang pernah/terlanjur di-track tetap muncul
 * lewat `--cached` dan akan diblokir.
 */
function gitCommitCandidates() {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return output.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

function scanFile(rel) {
  const full = join(ROOT, rel);
  if (!existsSync(full)) return;

  const stat = statSync(full);
  if (!stat.isFile()) return;

  const entry = basename(rel);
  if (FORBIDDEN_FILES.some((re) => re.test(entry))) {
    findings.push({ file: rel, line: 0, name: "File kredensial tidak boleh di-commit" });
    return;
  }

  if (SKIP_EXT.has(extname(entry).toLowerCase())) return;
  if (stat.size > 2_000_000) return;

  scan(rel, readFileSync(full, "utf8"));
}

/** Fail-closed fallback untuk source tree yang tidak memiliki metadata Git. */
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      walk(full);
      continue;
    }

    scanFile(rel);
  }
}

function scan(rel, content) {
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      if (re.test(line)) findings.push({ file: rel, line: i + 1, name });
    }
  });
}

const candidates = gitCommitCandidates();
if (candidates === null) {
  console.warn("secret-scan: metadata Git tidak tersedia; memakai full working-tree fallback.");
  walk(ROOT);
} else {
  for (const rel of candidates) scanFile(rel);
}

if (findings.length === 0) {
  console.log("secret-scan: bersih.");
  process.exit(0);
}

console.error(`\nsecret-scan: ${findings.length} temuan.\n`);
for (const f of findings) {
  console.error(`  ${f.file}${f.line > 0 ? `:${f.line}` : ""} — ${f.name}`);
}
console.error(
  "\nKalau ini contoh yang disengaja, tambahkan komentar `" +
    ALLOW_MARKER +
    "` di baris yang sama.\n" +
    "Kalau ini kredensial asli: JANGAN cuma hapus barisnya — kredensialnya sudah harus\n" +
    "dianggap bocor dan wajib dicabut di sisi provider, lalu history-nya dibersihkan.\n",
);
process.exit(1);
