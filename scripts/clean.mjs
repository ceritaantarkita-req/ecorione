#!/usr/bin/env node
/**
 * Membersihkan artefak build. Tidak menyentuh `node_modules` (itu pekerjaan pnpm) dan
 * tidak pernah menyentuh `data/` — di sana memori pengguna hidup.
 */

import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TARGETS = new Set(["dist", "coverage", ".vitest"]);
const SKIP = new Set(["node_modules", ".git", "data", ".pnpm-store"]);

let removed = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);

    if (TARGETS.has(entry)) {
      rmSync(full, { recursive: true, force: true });
      removed += 1;
      continue;
    }
    if (entry.endsWith(".tsbuildinfo")) {
      rmSync(full, { force: true });
      removed += 1;
      continue;
    }
    if (statSync(full).isDirectory()) walk(full);
  }
}

walk(ROOT);
console.log(`clean: ${removed} artefak dihapus.`);
