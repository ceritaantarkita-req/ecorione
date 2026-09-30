import { z } from "zod";
import type { StablePrefix } from "@ecorione/context-assembly";
import { callLocal, type LocalCallResult } from "./local.js";
import { callOllama } from "./ollama.js";

export const LOCAL_RUNTIME_IDS = ["openai-compatible", "ollama"] as const;
export const LocalRuntimeIdSchema = z.enum(LOCAL_RUNTIME_IDS);
export type LocalRuntimeId = z.infer<typeof LocalRuntimeIdSchema>;

export function parseLocalRuntime(value: string | undefined): LocalRuntimeId {
  if (value === undefined || value.trim() === "") return "openai-compatible";
  return LocalRuntimeIdSchema.parse(value.trim().toLowerCase());
}

export interface LocalRuntimeCallInput {
  readonly runtime: LocalRuntimeId;
  readonly baseUrl: string;
  readonly modelTag: string;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}

/**
 * OpenAI-compatible remains the portable local contract. Ollama may be selected explicitly
 * when its native endpoint is required for a model's thinking/output controls.
 */
export function callLocalRuntime(
  input: LocalRuntimeCallInput,
  signal?: AbortSignal,
): Promise<LocalCallResult> {
  switch (input.runtime) {
    case "openai-compatible":
      return callLocal(input, signal);
    case "ollama":
      return callOllama(input, signal);
  }
}
