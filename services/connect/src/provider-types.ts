import { z } from "zod";

export const HOSTED_PROVIDER_IDS = ["anthropic", "openrouter", "openai", "nvidia"] as const;
export const HostedProviderIdSchema = z.enum(HOSTED_PROVIDER_IDS);
export type HostedProviderId = z.infer<typeof HostedProviderIdSchema>;

export const DEFAULT_HOSTED_PROVIDER: HostedProviderId = "anthropic";

export function parseHostedProvider(value: string | undefined): HostedProviderId {
  if (value === undefined || value.trim() === "") return DEFAULT_HOSTED_PROVIDER;
  return HostedProviderIdSchema.parse(value.trim().toLowerCase());
}

export function providerCredentialLabel(provider: HostedProviderId): string {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openrouter":
      return "OPENROUTER_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "nvidia":
      return "NVIDIA_API_KEY";
  }
}
