import { z } from "zod";
import type { StablePrefix } from "@ecorione/context-assembly";
import { callLocal, type LocalCallResult } from "./local.js";

export const LOCAL_RUNTIME_IDS = ["openai-compatible"] as const;
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
 * Local runtime is protocol-based, not Ollama-based. Ollama, llama.cpp server, LM Studio,
 * vLLM, or another implementation is acceptable when it exposes the configured
 * OpenAI-compatible chat-completions endpoint.
 */
export function callLocalRuntime(input: LocalRuntimeCallInput): Promise<LocalCallResult> {
  switch (input.runtime) {
    case "openai-compatible":
      return callLocal(input);
  }
}
