import type { StablePrefix } from "@ecorione/context-assembly";
import type { PinnedModelId } from "@ecorione/shared-telemetry";
import {
  callOpenAiCompatibleHosted,
  estimateOpenAiCompatibleReservationUsd,
  type OpenAiCompatibleHostedResult,
} from "./openai-compatible.js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RUNTIME_MODELS = new Set<PinnedModelId>(["gpt-5.6-sol", "gpt-5.6-terra"]);

export interface OpenAiCallInput {
  readonly apiKey: string;
  readonly model: PinnedModelId;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}

export function openAiRuntimeModel(model: PinnedModelId): string {
  if (!OPENAI_RUNTIME_MODELS.has(model)) {
    throw new Error(`Pinned model belum punya mapping OpenAI: ${model}.`);
  }
  return model;
}

function adapterInput(input: Omit<OpenAiCallInput, "apiKey">) {
  return {
    runtimeModel: openAiRuntimeModel(input.model),
    costModel: input.model,
    prefix: input.prefix,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
    maxTokensField: "max_completion_tokens" as const,
  };
}

export function estimateOpenAiReservationUsd(input: Omit<OpenAiCallInput, "apiKey">): number {
  return estimateOpenAiCompatibleReservationUsd(adapterInput(input));
}

export function callOpenAi(input: OpenAiCallInput): Promise<OpenAiCompatibleHostedResult> {
  return callOpenAiCompatibleHosted({
    endpoint: OPENAI_CHAT_URL,
    providerName: "OpenAI",
    apiKey: input.apiKey,
    ...adapterInput(input),
  });
}
