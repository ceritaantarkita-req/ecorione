/**
 * Fixture bersama untuk test Context. Bukan bagian dari API publik — tidak di-reexport
 * dari `index.ts`.
 *
 * Semua timestamp konstan dan tidak ada `Date.now()` di mana pun: test yang bergantung
 * pada jam nyata akan menghasilkan peluruhan recency yang berbeda tiap kali dijalankan,
 * dan kegagalan yang cuma muncul kadang-kadang lebih buruk daripada tidak ada test.
 */

import { assertId, type Provenance, type Timestamp } from "@ecorione/shared-schema";
import { openContextDatabase, type ContextDatabase } from "./db.js";
import {
  ContextRepository,
  type InsertFactInput,
  type ProposeFactInput,
} from "./repository.js";
import { createVectorIndex, type VectorIndex } from "./vector.js";
import type { AppendEpisodeInput } from "./repository.js";

export const T0 = "2026-01-01T00:00:00.000Z" as Timestamp;
export const T1 = "2026-02-01T00:00:00.000Z" as Timestamp;
export const T2 = "2026-03-01T00:00:00.000Z" as Timestamp;
export const NOW = "2026-03-15T00:00:00.000Z" as Timestamp;

export const PROVENANCE: Provenance = {
  sourceApp: "cli",
  sessionId: assertId("session", "sess_uji"),
};

export function makeRepo(): { db: ContextDatabase; repo: ContextRepository } {
  const db = openContextDatabase();
  return { db, repo: new ContextRepository(db) };
}

/**
 * `prefer: "brute-force"` disengaja: hasil test tidak boleh bergantung pada apakah
 * ekstensi `sqlite-vec` terpasang di mesin yang menjalankannya.
 */
export function makeRepoWithVectors(dim = 3): {
  db: ContextDatabase;
  repo: ContextRepository;
  vectors: VectorIndex;
} {
  const db = openContextDatabase();
  const vectors = createVectorIndex(db.raw, {
    dim,
    model: "test-embed-1",
    prefer: "brute-force",
  });
  return { db, repo: new ContextRepository(db, vectors), vectors };
}

export function episodeInput(overrides: Partial<AppendEpisodeInput> = {}): AppendEpisodeInput {
  return {
    id: "epi_a",
    ts: T0,
    rawText: "teks episode",
    provenance: PROVENANCE,
    scope: "personal",
    sensitivity: "INTERNAL",
    syncClass: "LOCAL_ONLY",
    trust: "USER",
    ...overrides,
  };
}

export function factInput(overrides: Partial<InsertFactInput> = {}): InsertFactInput {
  return {
    id: "mem_a",
    subject: "Amanda",
    predicate: "tinggal di",
    object: "Jakarta",
    text: "Amanda tinggal di Jakarta",
    confidence: 1,
    salience: 0.5,
    sourceEpisodeIds: ["epi_a"],
    tValid: T0,
    createdAt: T0,
    scope: "personal",
    sensitivity: "INTERNAL",
    syncClass: "LOCAL_ONLY",
    trust: "USER",
    provenance: PROVENANCE,
    ...overrides,
  };
}

export function proposalInput(overrides: Partial<ProposeFactInput> = {}): ProposeFactInput {
  return {
    id: "mem_q",
    proposedText: "Amanda suka kopi",
    proposedAt: T1,
    provenance: { sourceApp: "chatgpt" },
    trust: "HOSTED_AGENT",
    scope: "personal",
    ...overrides,
  };
}

/** Vektor satuan sederhana supaya cosine similarity-nya bisa dihitung di kepala. */
export function vec(...values: number[]): Float32Array {
  return Float32Array.from(values);
}
