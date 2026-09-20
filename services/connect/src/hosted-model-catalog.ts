import type { PinnedModelId } from "@ecorione/shared-telemetry";
import { z } from "zod";
import type { HostedProviderId } from "./provider-types.js";

export const GOVERNED_HOSTED_MODEL = "governed" as const;

export const SELECTABLE_HOSTED_MODEL_IDS = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-1-20250805",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
] as const satisfies readonly PinnedModelId[];

export const HostedModelPreferenceSchema = z.enum([
  GOVERNED_HOSTED_MODEL,
  ...SELECTABLE_HOSTED_MODEL_IDS,
]);
export type HostedModelPreference = z.infer<typeof HostedModelPreferenceSchema>;

export interface HostedModelCatalogEntry {
  readonly id: PinnedModelId;
  readonly displayName: string;
  readonly providerRuntime: string;
}

const VERIFIED_HOSTED_MODELS: Readonly<
  Record<HostedProviderId, readonly HostedModelCatalogEntry[]>
> = Object.freeze({
  anthropic: Object.freeze([
    {
      id: "claude-sonnet-4-5-20250929",
      displayName: "Claude Sonnet 4.5",
      providerRuntime: "claude-sonnet-4-5-20250929",
    },
    {
      id: "claude-opus-4-1-20250805",
      displayName: "Claude Opus 4.1",
      providerRuntime: "claude-opus-4-1-20250805",
    },
  ]),
  openrouter: Object.freeze([
    {
      id: "claude-sonnet-4-5-20250929",
      displayName: "Claude Sonnet 4.5",
      providerRuntime: "anthropic/claude-sonnet-4.5",
    },
    {
      id: "claude-opus-4-1-20250805",
      displayName: "Claude Opus 4.1",
      providerRuntime: "anthropic/claude-opus-4.1",
    },
  ]),
  openai: Object.freeze([
    {
      id: "gpt-5.6-terra",
      displayName: "GPT-5.6 Terra",
      providerRuntime: "gpt-5.6-terra",
    },
    {
      id: "gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
      providerRuntime: "gpt-5.6-sol",
    },
  ]),
});

export function hostedModelCatalog(
  provider: HostedProviderId,
): readonly HostedModelCatalogEntry[] {
  return VERIFIED_HOSTED_MODELS[provider];
}

export function hostedModelSupported(
  provider: HostedProviderId,
  preference: HostedModelPreference,
): boolean {
  if (preference === GOVERNED_HOSTED_MODEL) return true;
  return VERIFIED_HOSTED_MODELS[provider].some((entry) => entry.id === preference);
}
