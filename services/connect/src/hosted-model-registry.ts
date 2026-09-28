import { PRICE_CURRENCY, type PinnedModelId } from "@ecorione/shared-telemetry";
import type { HostedProviderId } from "./provider-types.js";

export const HOSTED_MODEL_CAPABILITIES = ["text", "tools", "reasoning"] as const;
export type HostedModelCapability = (typeof HOSTED_MODEL_CAPABILITIES)[number];
export type HostedPricingAuthority = "snapshot" | "provider-reported";

export interface HostedModelPricingMetadata {
  /** Pinned ECORIONE accounting identity used for pre-dispatch reservation/evidence. */
  readonly costModel: PinnedModelId;
  /**
   * OpenRouter reports authoritative billed usage.cost after a call; direct providers use
   * the pinned ECORIONE pricing snapshot until a stronger provider-billing signal exists.
   */
  readonly authority: HostedPricingAuthority;
  readonly currency: typeof PRICE_CURRENCY;
}

export interface HostedModelRegistryEntry {
  readonly provider: HostedProviderId;
  /** Stable ECORIONE model preference / pricing identity. */
  readonly id: PinnedModelId;
  readonly displayName: string;
  /** Exact runtime slug sent to the configured provider gateway. */
  readonly providerRuntime: string;
  /** Model author/origin, not necessarily the OpenRouter serving endpoint. */
  readonly sourceProvider: string;
  /** Provider-published context window when captured; null means intentionally unclaimed. */
  readonly contextWindowTokens: number | null;
  /** Capabilities ECORIONE has actually admitted at this checkpoint. */
  readonly capabilities: readonly HostedModelCapability[];
  readonly pricing: HostedModelPricingMetadata;
  readonly verification: "verified";
  readonly catalogSource: "static-verified";
  /** Null means this static registry has no external freshness timestamp yet. */
  readonly verifiedAt: string | null;
}

const SNAPSHOT = "snapshot" as const;
const PROVIDER_REPORTED = "provider-reported" as const;
const TEXT_ONLY = ["text"] as const;

const HOSTED_MODEL_REGISTRY = [
  {
    provider: "anthropic",
    id: "claude-sonnet-4-5-20250929",
    displayName: "Claude Sonnet 4.5",
    providerRuntime: "claude-sonnet-4-5-20250929",
    sourceProvider: "anthropic",
    contextWindowTokens: null,
    capabilities: TEXT_ONLY,
    pricing: {
      costModel: "claude-sonnet-4-5-20250929",
      authority: SNAPSHOT,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
  {
    provider: "anthropic",
    id: "claude-opus-4-1-20250805",
    displayName: "Claude Opus 4.1",
    providerRuntime: "claude-opus-4-1-20250805",
    sourceProvider: "anthropic",
    contextWindowTokens: null,
    capabilities: TEXT_ONLY,
    pricing: {
      costModel: "claude-opus-4-1-20250805",
      authority: SNAPSHOT,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
  {
    provider: "openrouter",
    id: "claude-sonnet-4-5-20250929",
    displayName: "Claude Sonnet 4.5",
    providerRuntime: "anthropic/claude-sonnet-4.5",
    sourceProvider: "anthropic",
    contextWindowTokens: null,
    capabilities: TEXT_ONLY,
    pricing: {
      costModel: "claude-sonnet-4-5-20250929",
      authority: PROVIDER_REPORTED,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
  {
    provider: "openrouter",
    id: "claude-opus-4-1-20250805",
    displayName: "Claude Opus 4.1",
    providerRuntime: "anthropic/claude-opus-4.1",
    sourceProvider: "anthropic",
    contextWindowTokens: null,
    capabilities: TEXT_ONLY,
    pricing: {
      costModel: "claude-opus-4-1-20250805",
      authority: PROVIDER_REPORTED,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
  {
    provider: "openai",
    id: "gpt-5.6-terra",
    displayName: "GPT-5.6 Terra",
    providerRuntime: "gpt-5.6-terra",
    sourceProvider: "openai",
    contextWindowTokens: null,
    capabilities: TEXT_ONLY,
    pricing: {
      costModel: "gpt-5.6-terra",
      authority: SNAPSHOT,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
  {
    provider: "openai",
    id: "gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    providerRuntime: "gpt-5.6-sol",
    sourceProvider: "openai",
    contextWindowTokens: null,
    capabilities: TEXT_ONLY,
    pricing: {
      costModel: "gpt-5.6-sol",
      authority: SNAPSHOT,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
  {
    provider: "nvidia",
    id: "z-ai/glm-5.3",
    displayName: "GLM-5.3",
    providerRuntime: "z-ai/glm-5.3",
    sourceProvider: "z-ai",
    contextWindowTokens: null,
    capabilities: ["text", "reasoning"],
    pricing: {
      costModel: "z-ai/glm-5.3",
      authority: SNAPSHOT,
      currency: PRICE_CURRENCY,
    },
    verification: "verified",
    catalogSource: "static-verified",
    verifiedAt: null,
  },
] as const satisfies readonly HostedModelRegistryEntry[];

function registryKey(entry: Pick<HostedModelRegistryEntry, "provider" | "id">): string {
  return `${entry.provider}:${entry.id}`;
}

const seen = new Set<string>();
for (const entry of HOSTED_MODEL_REGISTRY) {
  const key = registryKey(entry);
  if (seen.has(key)) throw new Error(`Duplicate hosted model registry entry: ${key}`);
  seen.add(key);
  if (entry.id !== entry.pricing.costModel) {
    throw new Error(`Hosted model pricing identity mismatch: ${key}`);
  }
}
Object.freeze(HOSTED_MODEL_REGISTRY);

export function hostedModelRegistry(
  provider: HostedProviderId,
): readonly HostedModelRegistryEntry[] {
  return HOSTED_MODEL_REGISTRY.filter((entry) => entry.provider === provider);
}

export function hostedModelRegistryEntry(
  provider: HostedProviderId,
  model: string,
): HostedModelRegistryEntry | undefined {
  return HOSTED_MODEL_REGISTRY.find(
    (entry) => entry.provider === provider && entry.id === model,
  );
}

export function registeredHostedModelIds(): readonly PinnedModelId[] {
  return [...new Set(HOSTED_MODEL_REGISTRY.map((entry) => entry.id))];
}
