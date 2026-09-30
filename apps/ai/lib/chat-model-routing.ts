import type { ChatTarget } from "./chat-history";

export type HostedProviderId = "anthropic" | "openrouter" | "openai" | "nvidia";
export type ChatProviderSource = "local" | HostedProviderId;

export type ChatRuntimeSnapshot = {
  revision: number;
  settings: {
    hostedCallsEnabled: boolean;
    hostedProvider: HostedProviderId;
    hostedModel: string;
    openRouterModelSelection?: string;
    openRouterCertifiedModelId?: string;
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
  credentialReady?: boolean;
  connectionTestReady?: boolean;
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
    promptPricePerToken?: string | null;
    completionPricePerToken?: string | null;
  }>;
};

export type ChatProviderOption = {
  id: ChatProviderSource;
  displayName: string;
  available: boolean;
};

export type ChatModelOption = {
  id: string;
  displayName: string;
  available: boolean;
  inputUsdPerMTok?: number;
  outputUsdPerMTok?: number;
};

export type ChatOnboardingProviderOption = {
  id: HostedProviderId;
  displayName: string;
  connected: boolean;
  connectReady: boolean;
};

export type OpenRouterQuickSwitchModel = ChatModelOption;

function isHostedProviderId(value: string): value is HostedProviderId {
  return (
    value === "anthropic" || value === "openrouter" || value === "openai" || value === "nvidia"
  );
}

export function buildChatProviderOptions(
  localRuntime: ChatLocalRuntimeStatus | null,
  providers: readonly ChatProviderCatalogEntry[],
  credentials: ChatCredentialSnapshot,
): ChatProviderOption[] {
  const configured = new Set(credentials.credentials.map((credential) => credential.provider));
  const options: ChatProviderOption[] = [
    { id: "local", displayName: "Local", available: localRuntime?.ready === true },
  ];

  for (const provider of providers) {
    if (
      provider.category !== "ai" ||
      !provider.routingReady ||
      !isHostedProviderId(provider.id)
    ) {
      continue;
    }
    options.push({
      id: provider.id,
      displayName: hostedProviderLabel(provider.id),
      available: configured.has(provider.id),
    });
  }
  return options;
}

export function buildChatOnboardingProviderOptions(
  providers: readonly ChatProviderCatalogEntry[],
  credentials: ChatCredentialSnapshot,
): ChatOnboardingProviderOption[] {
  const connected = new Set(credentials.credentials.map((credential) => credential.provider));
  const options: ChatOnboardingProviderOption[] = [];

  for (const provider of providers) {
    if (
      provider.category !== "ai" ||
      !provider.routingReady ||
      !isHostedProviderId(provider.id)
    ) {
      continue;
    }
    options.push({
      id: provider.id,
      displayName: hostedProviderLabel(provider.id),
      connected: connected.has(provider.id),
      connectReady:
        provider.credentialReady === true && provider.connectionTestReady === true,
    });
  }
  return options;
}

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
  if (selection === "governed") return false;
  if (runtime.settings.hostedModel === selection) return false;

  // Legacy persisted field name: on Session 4E this is the Connect-owned trusted
  // activation marker set only after fresh catalog admission.
  return runtime.settings.openRouterCertifiedModelId !== selection;
}

export function buildOpenRouterQuickSwitchModels(
  runtime: ChatRuntimeSnapshot | null,
  providers: readonly ChatProviderCatalogEntry[],
  discovery: ChatOpenRouterDiscovery | null,
): OpenRouterQuickSwitchModel[] {
  if (runtime?.settings.hostedProvider !== "openrouter") return [];

  const seen = new Set<string>(["governed"]);
  const models: OpenRouterQuickSwitchModel[] = [
    { id: "governed", displayName: "Governed / Recommended", available: true },
  ];
  const provider = providers.find(
    (entry) => entry.id === "openrouter" && entry.category === "ai" && entry.routingReady,
  );
  for (const model of provider?.hostedModels ?? []) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    models.push({ id: model.id, displayName: model.displayName, available: true });
  }

  for (const model of discovery?.models ?? []) {
    // Session 4E normal UX exposes every fresh compatible catalog candidate directly.
    // Connect re-checks capability + price metadata again at selection and dispatch.
    if (!model.selectable || model.selectionId === null || seen.has(model.selectionId))
      continue;

    const inputUsdPerMTok =
      model.promptPricePerToken == null
        ? undefined
        : Number(model.promptPricePerToken) * 1_000_000;
    const outputUsdPerMTok =
      model.completionPricePerToken == null
        ? undefined
        : Number(model.completionPricePerToken) * 1_000_000;

    seen.add(model.selectionId);
    models.push({
      id: model.selectionId,
      displayName: model.displayName,
      available: true,
      ...(Number.isFinite(inputUsdPerMTok) ? { inputUsdPerMTok } : {}),
      ...(Number.isFinite(outputUsdPerMTok) ? { outputUsdPerMTok } : {}),
    });
  }

  const saved = currentOpenRouterPreference(runtime).trim();
  if (saved.length > 0 && saved !== "governed" && !seen.has(saved)) {
    models.push({
      id: saved,
      displayName: saved,
      available:
        runtime.settings.hostedModel === saved ||
        runtime.settings.openRouterCertifiedModelId === saved,
    });
  }

  return models;
}

export function currentHostedModelPreference(runtime: ChatRuntimeSnapshot | null): string {
  if (runtime === null) return "governed";
  return runtime.settings.hostedProvider === "openrouter"
    ? currentOpenRouterPreference(runtime)
    : runtime.settings.hostedModel;
}

export function buildHostedProviderModels(
  runtime: ChatRuntimeSnapshot | null,
  providers: readonly ChatProviderCatalogEntry[],
  discovery: ChatOpenRouterDiscovery | null,
): ChatModelOption[] {
  if (runtime === null) return [];
  if (runtime.settings.hostedProvider === "openrouter") {
    return buildOpenRouterQuickSwitchModels(runtime, providers, discovery);
  }

  const provider = providers.find(
    (entry) =>
      entry.id === runtime.settings.hostedProvider &&
      entry.category === "ai" &&
      entry.routingReady,
  );
  const seen = new Set<string>(["governed"]);
  const models: ChatModelOption[] = [
    { id: "governed", displayName: "Recommended", available: true },
  ];

  for (const model of provider?.hostedModels ?? []) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    models.push({ id: model.id, displayName: model.displayName, available: true });
  }

  const saved = runtime.settings.hostedModel.trim();
  if (saved.length > 0 && !seen.has(saved)) {
    models.push({ id: saved, displayName: saved, available: false });
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
      provider === "openrouter"
        ? currentOpenRouterPreference(runtime)
        : runtime.settings.hostedModel,
    )}`,
    defaultTarget:
      runtime.settings.defaultChatTarget === "hosted" && hostedAvailable ? "hosted" : "local",
  };
}
