/**
 * Registry modul — `prd.md` §6.
 *
 * Sebelas modul internal. **Tanpa prefix "InMy"** (ADR di §19 PRD): ecorione adalah satu
 * sistem, bukan federasi produk bermerek sendiri-sendiri.
 */

import { z } from "zod";

export const MODULE_NAMES = [
  "Ai",
  "Hub",
  "Connect",
  "Context",
  "Sync",
  "Space",
  "Flow",
  "Artifact",
  "Sandbox",
  "RnD",
  "AutoClick",
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];
export const ModuleNameSchema = z.enum(MODULE_NAMES);

export const PRIORITY = ["P0", "P1", "P2"] as const;
export type Priority = (typeof PRIORITY)[number];
export const PrioritySchema = z.enum(PRIORITY);

export interface ModuleSpec {
  readonly name: ModuleName;
  readonly priority: Priority;
  /** Nama folder di monorepo. */
  readonly slug: string;
  readonly role: string;
}

export const MODULES: Readonly<Record<ModuleName, ModuleSpec>> = {
  Ai: { name: "Ai", priority: "P0", slug: "ai", role: "Interface chat/agent utama" },
  Hub: {
    name: "Hub",
    priority: "P0",
    slug: "hub",
    role: "Policy engine, approval gate, durable state, audit log",
  },
  Connect: {
    name: "Connect",
    priority: "P0",
    slug: "connect",
    role: "Outbound: provider + optimizer. Inbound: server MCP",
  },
  Context: { name: "Context", priority: "P0", slug: "context", role: "Memori 4 tier (L0–L3)" },
  Sync: {
    name: "Sync",
    priority: "P1",
    slug: "sync",
    role: "Relay lintas device + jembatan HTTPS untuk AI hosted",
  },
  Space: {
    name: "Space",
    priority: "P1",
    slug: "space",
    role: "Workspace + editor memori inti L2",
  },
  Flow: {
    name: "Flow",
    priority: "P1",
    slug: "flow",
    role: "Workflow di atas durable execution yang diadopsi",
  },
  Artifact: {
    name: "Artifact",
    priority: "P1",
    slug: "artifact",
    role: "Content-addressed storage (tier L3)",
  },
  Sandbox: {
    name: "Sandbox",
    priority: "P1",
    slug: "sandbox",
    role: "Eksekusi terisolasi: WASM default, Docker+WSL2 eskalasi",
  },
  RnD: { name: "RnD", priority: "P1", slug: "rnd", role: "Trace store + eval harness" },
  AutoClick: {
    name: "AutoClick",
    priority: "P2",
    slug: "autoclick",
    role: "RPA — escape hatch, bukan jalur utama",
  },
} as const;

/**
 * Nama modul lama yang **tidak boleh** muncul lagi di kode, dokumen, atau UI.
 * Dipakai oleh test konvensi supaya penamaan lama tidak menyelinap balik.
 */
export const RETIRED_MODULE_NAMES = [
  // naming-gate:allow — daftar ini memang harus menyebut nama yang dilarang.
  "InMyAI", // naming-gate:allow
  "InMyHub", // naming-gate:allow
  "InMyConnect", // naming-gate:allow
  "InMyContext", // naming-gate:allow
  "InMySync", // naming-gate:allow
  "InMySpace", // naming-gate:allow
  "InMyFlow", // naming-gate:allow
  "InMyArtifact", // naming-gate:allow
  "InMySandbox", // naming-gate:allow
  "InMyRnD", // naming-gate:allow
  "InMyCache", // naming-gate:allow
  "InMyIR", // naming-gate:allow
  "InMyAutoClick", // naming-gate:allow
] as const;

/**
 * Dua modul yang dilebur setelah riset teknis (`research.md` §9.1) — dicatat supaya
 * keputusannya tidak hilang dan tidak dibangun ulang tanpa sadar.
 */
export const FOLDED_MODULES = {
  Cache: {
    into: "Connect" as ModuleName,
    reason:
      "Semantic caching: hit rate 10–20% untuk chat dan mode gagalnya jawaban salah yang " +
      "percaya diri. Yang aman — exact-match hash cache — terlalu kecil untuk jadi modul.",
  },
  IR: {
    into: "Context" as ModuleName,
    reason:
      "Kebutuhan representasi terstruktur sudah dijawab skema fakta L1 dan content-" +
      "addressing di Artifact. Modul terpisah menambah lapisan tanpa menambah kemampuan.",
  },
} as const;

export const ModuleHealthSchema = z.object({
  module: ModuleNameSchema,
  status: z.enum(["ACTIVE", "NEEDS_SETUP", "ERROR", "DISABLED"]),
  /** Endpoint lokal, kalau modul ini punya service. */
  endpoint: z.string().url().nullable().default(null),
  detail: z.string().max(512).nullable().default(null),
  checkedAt: z.string().datetime({ offset: false }),
});
export type ModuleHealth = z.infer<typeof ModuleHealthSchema>;

export function modulesByPriority(priority: Priority): readonly ModuleSpec[] {
  return MODULE_NAMES.map((n) => MODULES[n]).filter((m) => m.priority === priority);
}
