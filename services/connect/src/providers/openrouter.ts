import type { StablePrefix } from "@ecorione/context-assembly";
import type { ModelPrice } from "@ecorione/shared-telemetry";
import { hostedModelRegistryEntry } from "../hosted-model-registry.js";
import { ProviderResponseError } from "./errors.js";
import {
  callOpenAiCompatibleHosted,
  estimateOpenAiCompatibleReservationUsd,
  type OpenAiCompatibleHostedResult,
  type OpenAiCompatibleProviderRouting,
} from "./openai-compatible.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_PROVIDER_ONLY_ENV = "ECORIONE_OPENROUTER_PROVIDER_ONLY";

export interface OpenRouterCallInput {
  readonly apiKey: string;
  readonly model: string;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
  /** Internal probe-only override. Normal chat keeps the 4096-token baseline. */
  readonly maxOutputTokens?: number | undefined;
  readonly reasoningEffort?: "low" | "high" | "max" | undefined;
  readonly providerOnly?: readonly string[] | undefined;
  /** Exact model execution/validation explicitly disables upstream provider fallback. */
  readonly allowFallbacks?: boolean | undefined;
  readonly priceOverride?: ModelPrice | undefined;
}

export function openRouterRuntimeModel(model: string): string {
  const entry = hostedModelRegistryEntry("openrouter", model);
  if (entry !== undefined) return entry.providerRuntime;
  if (!/^[a-z0-9][a-z0-9._:/-]{0,255}$/u.test(model)) {
    throw new Error(`OpenRouter runtime model tidak valid: ${model}.`);
  }
  return model;
}

function normalizeProviderOnly(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  if (normalized.length === 0) {
    throw new Error("OpenRouter provider-only routing tidak boleh kosong.");
  }
  for (const value of normalized) {
    if (!/^[a-z0-9][a-z0-9/-]*$/u.test(value)) {
      throw new Error(`OpenRouter provider slug tidak valid: ${value}`);
    }
  }
  return [...new Set(normalized)];
}

export function openRouterProviderRouting(
  input: Pick<OpenRouterCallInput, "providerOnly" | "allowFallbacks">,
  env: Readonly<Record<string, string | undefined>> = process.env,
): OpenAiCompatibleProviderRouting | undefined {
  const explicit = input.providerOnly;
  if (explicit !== undefined) {
    return { only: normalizeProviderOnly(explicit), allow_fallbacks: false };
  }
  if (input.allowFallbacks === false) return { allow_fallbacks: false };

  const configured = env[OPENROUTER_PROVIDER_ONLY_ENV]?.trim();
  if (!configured) return undefined;
  return {
    only: normalizeProviderOnly(configured.split(",")),
    allow_fallbacks: false,
  };
}

function adapterInput(input: Omit<OpenRouterCallInput, "apiKey">) {
  return {
    runtimeModel: openRouterRuntimeModel(input.model),
    costModel: input.model,
    ...(input.priceOverride === undefined ? {} : { priceOverride: input.priceOverride }),
    prefix: input.prefix,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
    maxTokensField: "max_tokens" as const,
    ...(input.maxOutputTokens === undefined ? {} : { maxOutputTokens: input.maxOutputTokens }),
    ...(input.reasoningEffort === undefined ? {} : { reasoningEffort: input.reasoningEffort }),
    providerRouting: openRouterProviderRouting(input),
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
  const expectedRuntimeModel = openRouterRuntimeModel(input.model);
  if (input.allowFallbacks === false && result.model !== expectedRuntimeModel) {
    throw new ProviderResponseError(
      `Respons OpenRouter tidak cocok dengan exact model yang diminta: expected=${expectedRuntimeModel} response=${result.model}.`,
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
