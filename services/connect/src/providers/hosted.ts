import type { StablePrefix } from "@ecorione/context-assembly";
import type { PinnedModelId, TokenUsage } from "@ecorione/shared-telemetry";
import type { HostedProviderId } from "../provider-types.js";
import { callAnthropic, estimateAnthropicReservationUsd } from "./anthropic.js";
import { callOpenAi, estimateOpenAiReservationUsd } from "./openai.js";
import { callOpenRouter, estimateOpenRouterReservationUsd } from "./openrouter.js";

export interface HostedCallInput {
  readonly provider: HostedProviderId;
  readonly apiKey: string;
  readonly model: PinnedModelId;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}

export interface HostedCallResult {
  readonly reply: string;
  readonly model: string;
  readonly usage: TokenUsage;
  readonly providerReportedActualUsd?: number | undefined;
}

type AdapterInput = Omit<HostedCallInput, "provider" | "apiKey">;

export function estimateHostedReservationUsd(
  provider: HostedProviderId,
  input: AdapterInput,
): number {
  switch (provider) {
    case "anthropic":
      return estimateAnthropicReservationUsd(input);
    case "openrouter":
      return estimateOpenRouterReservationUsd(input);
    case "openai":
      return estimateOpenAiReservationUsd(input);
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
  };
  switch (input.provider) {
    case "anthropic":
      return callAnthropic(adapterInput, signal);
    case "openrouter":
      return callOpenRouter(adapterInput, signal);
    case "openai":
      return callOpenAi(adapterInput, signal);
  }
}
