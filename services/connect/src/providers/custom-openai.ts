import { TOKENS_PER_PRICE_UNIT, type ModelPrice } from "@ecorione/shared-telemetry";
import type { StablePrefix } from "@ecorione/context-assembly";
import type { CustomOpenAiConfig } from "../runtime-settings.js";
import {
  callOpenAiCompatibleHosted,
  estimateOpenAiCompatibleReservationUsd,
  type OpenAiCompatibleHostedResult,
  type OpenAiCompatibleTransport,
} from "./openai-compatible.js";
import { createPublicHttpsOpenAiTransport } from "./public-https-transport.js";

export const CUSTOM_OPENAI_MIN_RESERVATION_USD = 0.000001;

export interface CustomOpenAiCallInput {
  readonly config: CustomOpenAiConfig;
  readonly apiKey: string;
  readonly model: string;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
  readonly maxOutputTokens?: number | undefined;
  readonly transport?: OpenAiCompatibleTransport | undefined;
}

function endpoint(config: CustomOpenAiConfig): string {
  return `${config.baseUrl.replace(/\/+$/u, "")}/chat/completions`;
}

function price(config: CustomOpenAiConfig): ModelPrice {
  return {
    inputPerMTok: config.inputUsdPerMTok,
    outputPerMTok: config.outputUsdPerMTok,
    cacheWritePerMTok: config.inputUsdPerMTok,
    cacheReadPerMTok: config.inputUsdPerMTok,
  };
}

function adapterInput(input: Omit<CustomOpenAiCallInput, "apiKey" | "transport">) {
  return {
    runtimeModel: input.model,
    costModel: input.model,
    priceOverride: price(input.config),
    prefix: input.prefix,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
    maxTokensField: "max_tokens" as const,
    ...(input.maxOutputTokens === undefined ? {} : { maxOutputTokens: input.maxOutputTokens }),
  };
}

export function estimateCustomOpenAiReservationUsd(
  input: Omit<CustomOpenAiCallInput, "apiKey" | "transport">,
): number {
  return Math.max(
    CUSTOM_OPENAI_MIN_RESERVATION_USD,
    estimateOpenAiCompatibleReservationUsd(adapterInput(input)),
  );
}

function calculatedActualUsd(
  config: CustomOpenAiConfig,
  result: Pick<OpenAiCompatibleHostedResult, "usage">,
): number {
  const promptLikeTokens =
    result.usage.inputTokens + result.usage.cacheReadTokens + result.usage.cacheWriteTokens;
  return (
    (promptLikeTokens * config.inputUsdPerMTok +
      result.usage.outputTokens * config.outputUsdPerMTok) /
    TOKENS_PER_PRICE_UNIT
  );
}

export async function callCustomOpenAi(
  input: CustomOpenAiCallInput,
  signal?: AbortSignal,
): Promise<OpenAiCompatibleHostedResult> {
  if (input.model !== input.config.model) {
    throw new Error("Model custom provider tidak cocok dengan konfigurasi yang divalidasi.");
  }
  const result = await callOpenAiCompatibleHosted(
    {
      endpoint: endpoint(input.config),
      providerName: input.config.name,
      apiKey: input.apiKey,
      ...adapterInput(input),
      transport: input.transport ?? createPublicHttpsOpenAiTransport(),
    },
    signal,
  );
  return {
    ...result,
    providerReportedActualUsd:
      result.providerReportedActualUsd ?? calculatedActualUsd(input.config, result),
  };
}
