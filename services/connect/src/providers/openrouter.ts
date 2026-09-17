import type { StablePrefix } from "@ecorione/context-assembly";
import type { PinnedModelId } from "@ecorione/shared-telemetry";
import { ProviderResponseError } from "./errors.js";
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

export async function callOpenRouter(
  input: OpenRouterCallInput,
  signal?: AbortSignal,
): Promise<OpenAiCompatibleHostedResult> {
  const result = await callOpenAiCompatibleHosted(
    {
      endpoint: OPENROUTER_CHAT_URL,
      providerName: "OpenRouter",
      apiKey: input.apiKey,
      extraHeaders: { "x-openrouter-metadata": "enabled" },
      ...adapterInput(input),
    },
    signal,
  );
  const billedCostUsd = result.providerReportedActualUsd ?? 0;
  if (billedCostUsd <= 0) {
    const routingProvider = result.routingProvider ?? "unavailable";
    throw new ProviderResponseError(
      `Respons OpenRouter untuk pinned paid model ${input.model} melaporkan usage.cost <= 0; ` +
        `billed-cost evidence ditolak fail-closed. diagnostic responseModel=${result.model} ` +
        `finishReason=${result.finishReason ?? "unknown"} routingProvider=${routingProvider} ` +
        `inputTokens=${result.usage.inputTokens} outputTokens=${result.usage.outputTokens} ` +
        `usageCostUsd=${billedCostUsd.toFixed(8)}`,
      {
        responseModel: result.model,
        finishReason: result.finishReason,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        ...(result.routingProvider === undefined
          ? {}
          : { routingProvider: result.routingProvider }),
        providerReportedActualUsd: billedCostUsd,
      },
    );
  }
  return result;
}
