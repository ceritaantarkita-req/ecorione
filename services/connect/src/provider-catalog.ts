import { HOSTED_PROVIDER_IDS } from "./provider-types.js";

export const AI_PROVIDER_IDS = [
  "anthropic",
  "openai",
  "openrouter",
  "kimi",
  "gemini",
  "qwen",
  "glm",
  "custom-openai",
] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const CREDENTIAL_PROVIDER_IDS = [...AI_PROVIDER_IDS, "mcp", "webhook"] as const;
export type CredentialProviderId = (typeof CREDENTIAL_PROVIDER_IDS)[number];
export type CredentialPurpose = "messages" | "tokens";

export interface ProviderCatalogEntry {
  readonly id: CredentialProviderId;
  readonly displayName: string;
  readonly category: "ai" | "integration";
  readonly credentialPurpose: CredentialPurpose;
  readonly credentialReady: boolean;
  readonly routingReady: boolean;
  readonly connectionTestReady: boolean;
}

const ROUTING_READY = new Set<string>(HOSTED_PROVIDER_IDS);

function aiProvider(id: AiProviderId, displayName: string): ProviderCatalogEntry {
  const routingReady = ROUTING_READY.has(id);
  return {
    id,
    displayName,
    category: "ai",
    credentialPurpose: "messages",
    credentialReady: true,
    routingReady,
    connectionTestReady: routingReady,
  };
}

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  aiProvider("anthropic", "Claude / Anthropic"),
  aiProvider("openai", "OpenAI / ChatGPT API"),
  aiProvider("openrouter", "OpenRouter"),
  aiProvider("kimi", "Kimi / Moonshot"),
  aiProvider("gemini", "Google Gemini"),
  aiProvider("qwen", "Qwen"),
  aiProvider("glm", "GLM"),
  aiProvider("custom-openai", "Custom OpenAI-compatible"),
  {
    id: "mcp",
    displayName: "MCP token",
    category: "integration",
    credentialPurpose: "tokens",
    credentialReady: true,
    routingReady: false,
    connectionTestReady: false,
  },
  {
    id: "webhook",
    displayName: "Webhook signing root",
    category: "integration",
    credentialPurpose: "tokens",
    credentialReady: true,
    routingReady: false,
    connectionTestReady: false,
  },
] as const;

export function credentialPurposeForProvider(
  provider: CredentialProviderId,
): CredentialPurpose {
  return provider === "mcp" || provider === "webhook" ? "tokens" : "messages";
}
