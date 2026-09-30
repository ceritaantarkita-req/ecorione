import type { StablePrefix } from "@ecorione/context-assembly";
import type { ModelPrice, PinnedModelId, TokenUsage } from "@ecorione/shared-telemetry";
import type { HostedProviderId } from "../provider-types.js";
import type { CustomOpenAiConfig } from "../runtime-settings.js";
import { callAnthropic, estimateAnthropicReservationUsd } from "./anthropic.js";
import {
  callCustomOpenAi,
  estimateCustomOpenAiReservationUsd,
} from "./custom-openai.js";
import type { OpenAiCompatibleTransport } from "./openai-compatible.js";
import { callNvidia, estimateNvidiaReservationUsd } from "./nvidia.js";
import { callOpenAi, estimateOpenAiReservationUsd } from "./openai.js";
import { callOpenRouter, estimateOpenRouterReservationUsd } from "./openrouter.js";

export interface HostedCallInput {
  readonly provider: HostedProviderId;
  readonly apiKey: string;
  readonly model: string;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
  /** Internal probe-only override. Normal hosted completions leave this undefined. */
  readonly maxOutputTokens?: number | undefined;
  readonly reasoningEffort?: "low" | "high" | "max" | undefined;
  readonly openRouterPriceOverride?: ModelPrice | undefined;
  readonly openRouterAllowFallbacks?: boolean | undefined;
  readonly customOpenAiConfig?: CustomOpenAiConfig | undefined;
  readonly customOpenAiTransport?: OpenAiCompatibleTransport | undefined;
}

export interface HostedCallResult {
  readonly reply: string;
  readonly model: string;
  readonly usage: TokenUsage;
  readonly routingProvider?: string | undefined;
  readonly providerReportedActualUsd?: number | undefined;
}

type AdapterInput = Omit<HostedCallInput, "provider" | "apiKey">;
type StaticAdapterInput = AdapterInput & { readonly model: PinnedModelId };

export function estimateHostedReservationUsd(
  provider: HostedProviderId,
  input: AdapterInput,
): number {
  switch (provider) {
    case "anthropic":
      return estimateAnthropicReservationUsd(input as StaticAdapterInput);
    case "openrouter":
      return estimateOpenRouterReservationUsd(input);
    case "openai":
      return estimateOpenAiReservationUsd(input as StaticAdapterInput);
    case "nvidia":
      return estimateNvidiaReservationUsd(input as StaticAdapterInput);
    case "custom-openai":
      if (input.customOpenAiConfig === undefined) {
        throw new Error("Custom provider config belum tersedia.");
      }
      return estimateCustomOpenAiReservationUsd({
        config: input.customOpenAiConfig,
        model: input.model,
        prefix: input.prefix,
        dynamicText: input.dynamicText,
        userMessage: input.userMessage,
        ...(input.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: input.maxOutputTokens }),
      });
  }
}

export function callHostedProvider(
  input: HostedCallInput,
  signal?: AbortSignal,
): Promise<HostedCallResult> {
  const adapterInput = {
    apiKey: input.apiKey,
    model: input.model,
    prefix: input.prefix,
    dynamicText: input.dynamicText,
    userMessage: input.userMessage,
    ...(input.maxOutputTokens === undefined ? {} : { maxOutputTokens: input.maxOutputTokens }),
    ...(input.reasoningEffort === undefined ? {} : { reasoningEffort: input.reasoningEffort }),
    ...(input.openRouterPriceOverride === undefined
      ? {}
      : { priceOverride: input.openRouterPriceOverride }),
    ...(input.openRouterAllowFallbacks === undefined
      ? {}
      : { allowFallbacks: input.openRouterAllowFallbacks }),
  };
  switch (input.provider) {
    case "anthropic":
      return callAnthropic(adapterInput as Parameters<typeof callAnthropic>[0], signal);
    case "openrouter":
      return callOpenRouter(adapterInput, signal);
    case "openai":
      return callOpenAi(adapterInput as Parameters<typeof callOpenAi>[0], signal);
    case "nvidia":
      return callNvidia(adapterInput as Parameters<typeof callNvidia>[0], signal);
    case "custom-openai":
      if (input.customOpenAiConfig === undefined) {
        throw new Error("Custom provider config belum tersedia.");
      }
      return callCustomOpenAi(
        {
          config: input.customOpenAiConfig,
          apiKey: input.apiKey,
          model: input.model,
          prefix: input.prefix,
          dynamicText: input.dynamicText,
          userMessage: input.userMessage,
          ...(input.maxOutputTokens === undefined
            ? {}
            : { maxOutputTokens: input.maxOutputTokens }),
          ...(input.customOpenAiTransport === undefined
            ? {}
            : { transport: input.customOpenAiTransport }),
        },
        signal,
      );
  }
}
