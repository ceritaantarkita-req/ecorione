import type { StablePrefix } from "@ecorione/context-assembly";
import type { PinnedModelId } from "@ecorione/shared-telemetry";
import {
  callOpenAiCompatibleHosted,
  estimateOpenAiCompatibleReservationUsd,
  type OpenAiCompatibleHostedResult,
} from "./openai-compatible.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_RUNTIME_MODELS: Partial<Record<PinnedModelId, string>> = {
  "claude-sonnet-4-5-20250929": "anthropic/claude-sonnet-4.5",
  "claude-opus-4-1-20250805": "anthropic/claude-opus-4.1",
};

export interface OpenRouterCallInput {
  readonly apiKey: string;
  readonly model: PinnedModelId;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}

export function openRouterRuntimeModel(model: PinnedModelId): string {
  const runtime = OPENROUTER_RUNTIME_MODELS[model];
  if (runtime === undefined) {
    throw new Error(`Pinned model belum punya mapping OpenRouter: ${model}.`);
  }
  return runtime;
}

function adapterInput(input: Omit<OpenRouterCallInput, "apiKey">) {
  return {
    runtimeModel: openRouterRuntimeModel(input.model),
    costModel: input.model,
    prefix: input.prefix,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
    maxTokensField: "max_tokens" as const,
  };
}

export function estimateOpenRouterReservationUsd(
  input: Omit<OpenRouterCallInput, "apiKey">,
): number {
  return estimateOpenAiCompatibleReservationUsd(adapterInput(input));
}

export function callOpenRouter(
  input: OpenRouterCallInput,
): Promise<OpenAiCompatibleHostedResult> {
  return callOpenAiCompatibleHosted({
    endpoint: OPENROUTER_CHAT_URL,
    providerName: "OpenRouter",
    apiKey: input.apiKey,
    ...adapterInput(input),
  });
}
