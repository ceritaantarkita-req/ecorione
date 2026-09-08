/**
 * Fixture untuk test di package ini. Tidak diekspor lewat `index.ts` — ini bukan API publik,
 * cuma cara supaya tiga berkas test tidak menyalin objek yang sama tiga kali.
 *
 * Semua nilai di sini **bebas pola volatil** (tanpa timestamp, UUID, atau angka epoch di
 * dalam prefix) supaya `assertPrefixCacheable` tidak menyala karena fixture-nya sendiri.
 */

import {
  artifactIdFromDigest,
  assertId,
  type ArtifactPointer,
  type CoreMemory,
  type MemoryFact,
  type Provenance,
  type RetrievalHit,
  type Timestamp,
} from "@ecorione/shared-schema";
import type { EpisodicSummary } from "./pack.js";
import type { StablePrefix, ToolDefinition } from "./prefix.js";

export const T0: Timestamp = "2026-09-01T09:00:00Z";
export const NOW: Timestamp = "2026-09-08T10:30:00Z";

export const PROVENANCE: Provenance = {
  sourceApp: "claude-code",
  sessionId: assertId("session", "sess_abc"),
};

export function tool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "memory_search",
    description: "Cari fakta di memori pengguna. Kembalikan k kecil.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
    ...overrides,
  };
}

export function coreMemory(
  value = "Nama panggilan: Rio. Bahasa kerja: Indonesia.",
): CoreMemory {
  return {
    blocks: [
      {
        label: "persona",
        description: "Identitas dan gaya kerja pengguna.",
        value,
        readOnly: false,
        updatedAt: T0,
      },
      {
        label: "proyek_aktif",
        description: "Proyek yang sedang dikerjakan.",
        value: "ecorione — lapisan memori bersama.",
        readOnly: false,
        updatedAt: T0,
      },
    ],
  };
}

export function prefix(overrides: Partial<StablePrefix> = {}): StablePrefix {
  return {
    systemPrompt: "Kamu asisten yang hemat konteks. Jawab ringkas.",
    toolDefinitions: [tool()],
    coreMemory: coreMemory(),
    ...overrides,
  };
}

export function fact(
  id: string,
  text: string,
  overrides: Partial<MemoryFact> = {},
): MemoryFact {
  return {
    id: assertId("memoryFact", id),
    subject: "pengguna",
    predicate: "menyukai",
    object: text,
    text,
    confidence: 0.9,
    salience: 0.7,
    sourceEpisodeIds: [assertId("episode", "epi_1")],
    tValid: T0,
    tInvalid: null,
    supersededBy: null,
    createdAt: T0,
    scope: "personal",
    sensitivity: "INTERNAL",
    syncClass: "LOCAL_ONLY",
    trust: "LOCAL_AGENT",
    provenance: PROVENANCE,
    ...overrides,
  };
}

export function hit(id: string, text: string, score: number): RetrievalHit {
  return { fact: fact(id, text), score, matchedBy: ["vector"] };
}

export function episode(id: string, text: string, ts: Timestamp = T0): EpisodicSummary {
  return { id: assertId("episode", id), ts, text, provenance: PROVENANCE };
}

export function pointer(seed: string, description: string): ArtifactPointer {
  return {
    id: artifactIdFromDigest(seed.repeat(64).slice(0, 64)),
    path: `catatan/${seed}.md`,
    description,
    mimeType: "text/markdown",
    sizeBytes: 4096,
    scope: "personal",
    sensitivity: "INTERNAL",
  };
}
