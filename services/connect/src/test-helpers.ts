/**
 * Fixture bersama untuk test Connect. Bukan bagian dari API publik — tidak di-reexport
 * dari `index.ts`.
 */

import { assertId, type OperationId, type Timestamp } from "@ecorione/shared-schema";
import type { StablePrefix } from "@ecorione/context-assembly";

export const NOW: Timestamp = "2026-09-08T10:30:00.000Z" as Timestamp;
export const OPERATION_ID: OperationId = assertId("operation", "op_test");

export function prefix(overrides: Partial<StablePrefix> = {}): StablePrefix {
  return {
    systemPrompt: "Kamu asisten yang hemat konteks. Jawab ringkas.",
    toolDefinitions: [],
    coreMemory: { blocks: [] },
    ...overrides,
  };
}
