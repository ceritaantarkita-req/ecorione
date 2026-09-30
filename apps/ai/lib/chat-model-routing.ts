import type { ChatTarget } from "./chat-history";

export type HostedProviderId = "anthropic" | "openrouter" | "openai" | "nvidia";

export type ChatRuntimeSnapshot = {
  revision: number;
  settings: {
    hostedCallsEnabled: boolean;
    hostedProvider: HostedProviderId;
    hostedModel: string;
    openRouterModelSelection?: string;
    defaultChatTarget: ChatTarget;
  };
};

export type ChatCredentialSnapshot = {
  credentials: Array<{ provider: string }>;
};

export type ChatLocalRuntimeStatus = {
  ready: boolean;
  state: "connected" | "model-missing" | "identity-mismatch" | "unreachable" | "unsupported";
  configuredModel: string;
  message: string;
};

export type ChatProviderCatalogEntry = {
  id: string;
  displayName: string;
  category: "ai" | "integration";
  routingReady: boolean;
  hostedModels: Array<{
    id: string;
    displayName: string;
  }>;
};

export type ChatOpenRouterDiscovery = {
  stale: boolean;
  models: Array<{
    id: string;
    displayName: string;
    selectable: boolean;
    executable: boolean;
    selectionId: string | null;
  }>;
};

export type OpenRouterQuickSwitchModel = {
  id: string;
  displayName: string;
  executable: boolean;
};

export function hostedProviderLabel(provider: HostedProviderId | undefined): string {
  switch (provider) {
    case "anthropic":
      return "Anthropic";
    case "openrouter":
      return "OpenRouter";
    case "openai":
      return "OpenAI";
    case "nvidia":
      return "NVIDIA";
    default:
      return "Hosted";
  }
}

export function hostedModelLabel(model: string | undefined): string {
  switch (model) {
    case undefined:
    case "governed":
      return "Recommended";
    case "claude-sonnet-4-5-20250929":
      return "Claude Sonnet 4.5";
    case "claude-opus-4-1-20250805":
      return "Claude Opus 4.1";
    case "gpt-5.6-terra":
      return "GPT-5.6 Terra";
    case "gpt-5.6-sol":
      return "GPT-5.6 Sol";
    case "z-ai/glm-5.3":
      return "GLM-5.3";
    default:
      return model;
  }
}

export function currentOpenRouterPreference(runtime: ChatRuntimeSnapshot | null): string {
  if (runtime?.settings.hostedProvider !== "openrouter") return "governed";
  return runtime.settings.openRouterModelSelection ?? runtime.settings.hostedModel;
}

/**
 * A discovered OpenRouter selection may be saved as a preference before it has
 * executable admission. Static and governed selections mirror `hostedModel`;
 * dynamic preferences deliberately leave `hostedModel` as `governed`.
 *
 * Keep this client-side guard even though Connect repairs the durable state. It
 * makes a stale or legacy snapshot fail closed while the page is loading.
 */
export function hasNonExecutableOpenRouterPreference(
  runtime: ChatRuntimeSnapshot | null,
): boolean {
  if (runtime?.settings.hostedProvider !== "openrouter") return false;

  const selection = currentOpenRouterPreference(runtime);
  return selection !== "governed" && runtime.settings.hostedModel !== selection;
}

export function buildOpenRouterQuickSwitchModels(
  runtime: ChatRuntimeSnapshot | null,
  providers: readonly ChatProviderCatalogEntry[],
  discovery: ChatOpenRouterDiscovery | null,
): OpenRouterQuickSwitchModel[] {
  if (runtime?.settings.hostedProvider !== "openrouter") return [];

  const seen = new Set<string>(["governed"]);
  const models: OpenRouterQuickSwitchModel[] = [
    { id: "governed", displayName: "Governed / Recommended", executable: true },
  ];
  const provider = providers.find(
    (entry) => entry.id === "openrouter" && entry.category === "ai" && entry.routingReady,
  );
  for (const model of provider?.hostedModels ?? []) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    models.push({ id: model.id, displayName: model.displayName, executable: true });
  }

  for (const model of discovery?.models ?? []) {
    // Chat only lists models already proven Ready. Models that are merely catalogued are tested from Settings first.
    if (
      !model.selectable ||
      !model.executable ||
      model.selectionId === null ||
      seen.has(model.selectionId)
    )
      continue;
    seen.add(model.selectionId);
    models.push({
      id: model.selectionId,
      displayName: model.displayName,
      executable: model.executable,
    });
  }

  const saved = currentOpenRouterPreference(runtime).trim();
  if (saved.length > 0 && saved !== "governed" && !seen.has(saved)) {
    models.push({
      id: saved,
      displayName: saved,
      executable: runtime.settings.hostedModel === saved,
    });
  }

  return models;
}

export function deriveChatRoutingState(
  runtime: ChatRuntimeSnapshot | null,
  credentials: ChatCredentialSnapshot,
): {
  hostedAvailable: boolean;
  hostedBlockedByOpenRouterPreference: boolean;
  hostedRouteLabel: string;
  defaultTarget: ChatTarget;
} {
  if (runtime === null) {
    return {
      hostedAvailable: false,
      hostedBlockedByOpenRouterPreference: false,
      hostedRouteLabel: "Hosted",
      defaultTarget: "local",
    };
  }
  const provider = runtime.settings.hostedProvider;
  const hasCredential = credentials.credentials.some(
    (credential) => credential.provider === provider,
  );
  const hostedBlockedByOpenRouterPreference = hasNonExecutableOpenRouterPreference(runtime);
  const hostedAvailable =
    runtime.settings.hostedCallsEnabled &&
    hasCredential &&
    !hostedBlockedByOpenRouterPreference;
  return {
    hostedAvailable,
    hostedBlockedByOpenRouterPreference,
    hostedRouteLabel: `Hosted · ${hostedProviderLabel(provider)} · ${hostedModelLabel(
      runtime.settings.hostedModel,
    )}`,
    defaultTarget:
      runtime.settings.defaultChatTarget === "hosted" && hostedAvailable ? "hosted" : "local",
  };
}
