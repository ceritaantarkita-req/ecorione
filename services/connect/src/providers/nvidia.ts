import type { StablePrefix } from "@ecorione/context-assembly";
import type { PinnedModelId } from "@ecorione/shared-telemetry";
import {
  callOpenAiCompatibleHosted,
  estimateOpenAiCompatibleReservationUsd,
  type OpenAiCompatibleHostedResult,
} from "./openai-compatible.js";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_RUNTIME_MODELS = new Set<PinnedModelId>(["z-ai/glm-5.3"]);

/**
 * FileSpendBudget requires a strictly positive pre-dispatch reservation.
 * The hosted NVIDIA API Catalog route used here is the free prototype endpoint,
 * so accounting settles to zero provider-token cost while preserving admission-control
 * and ambiguous-failure semantics with the smallest supported reservation unit.
 */
export const NVIDIA_FREE_ENDPOINT_MIN_RESERVATION_USD = 0.000001;

export interface NvidiaCallInput {
  readonly apiKey: string;
  readonly model: PinnedModelId;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}

export function nvidiaRuntimeModel(model: PinnedModelId): string {
  if (!NVIDIA_RUNTIME_MODELS.has(model)) {
    throw new Error(`Pinned model belum punya mapping NVIDIA NIM: ${model}.`);
  }
  return model;
}

function adapterInput(input: Omit<NvidiaCallInput, "apiKey">) {
  return {
    runtimeModel: nvidiaRuntimeModel(input.model),
    costModel: input.model,
    prefix: input.prefix,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
    maxTokensField: "max_tokens" as const,
  };
}

export function estimateNvidiaReservationUsd(input: Omit<NvidiaCallInput, "apiKey">): number {
  return Math.max(
    NVIDIA_FREE_ENDPOINT_MIN_RESERVATION_USD,
    estimateOpenAiCompatibleReservationUsd(adapterInput(input)),
  );
}

export function callNvidia(
  input: NvidiaCallInput,
  signal?: AbortSignal,
): Promise<OpenAiCompatibleHostedResult> {
  return callOpenAiCompatibleHosted(
    {
      endpoint: NVIDIA_CHAT_URL,
      providerName: "NVIDIA",
      apiKey: input.apiKey,
      ...adapterInput(input),
    },
    signal,
  );
}
