"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatTarget } from "../lib/chat-history";
import {
  buildChatOnboardingProviderOptions,
  buildChatProviderOptions,
  buildHostedProviderModels,
  currentHostedModelPreference,
  currentOpenRouterPreference,
  deriveChatRoutingState,
  hostedProviderLabel,
  type ChatCredentialSnapshot,
  type ChatLocalRuntimeStatus,
  type ChatOpenRouterDiscovery,
  type ChatProviderCatalogEntry,
  type ChatProviderSource,
  type ChatRuntimeSnapshot,
  type HostedProviderId,
} from "../lib/chat-model-routing";

type ModelSwitchFeedback = {
  kind: "success" | "warning" | "error";
  message: string;
};

type OpenRouterSelectionResponse = {
  runtime: ChatRuntimeSnapshot;
  selection: {
    id: string;
    admission: string;
    executable: boolean;
    active: boolean;
    unavailableReason: string | null;
  };
};

const EMPTY_CREDENTIALS: ChatCredentialSnapshot = { credentials: [] };

function errorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(errorMessage(body, `HTTP ${String(response.status)}`));
  }
  return body as T;
}

async function getOptionalJson<T>(url: string, fallback: T): Promise<T> {
  try {
    return await getJson<T>(url);
  } catch {
    return fallback;
  }
}

async function fetchOpenRouterDiscovery(): Promise<ChatOpenRouterDiscovery | null> {
  return getOptionalJson<ChatOpenRouterDiscovery | null>(
    "/api/settings/settings/providers/openrouter/models?limit=100",
    null,
  );
}

export function useChatModelRouting() {
  const [runtime, setRuntime] = useState<ChatRuntimeSnapshot | null>(null);
  const [credentials, setCredentials] = useState<ChatCredentialSnapshot>(EMPTY_CREDENTIALS);
  const [providers, setProviders] = useState<ChatProviderCatalogEntry[]>([]);
  const [openRouterDiscovery, setOpenRouterDiscovery] =
    useState<ChatOpenRouterDiscovery | null>(null);
  const [localRuntimeStatus, setLocalRuntimeStatus] = useState<ChatLocalRuntimeStatus | null>(
    null,
  );
  const [switching, setSwitching] = useState(false);
  const [feedback, setFeedback] = useState<ModelSwitchFeedback | null>(null);
  const switchInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void getJson<ChatRuntimeSnapshot>("/api/settings/settings/runtime")
      .then(async (runtimeSnapshot) => {
        const [credentialSnapshot, localStatus, providerSnapshot, discoverySnapshot] =
          await Promise.all([
            getOptionalJson<ChatCredentialSnapshot>(
              "/api/settings/settings/credentials",
              EMPTY_CREDENTIALS,
            ),
            getOptionalJson<ChatLocalRuntimeStatus>(
              "/api/settings/settings/local-runtime/status",
              {
                ready: false,
                state: "unreachable",
                configuredModel: "",
                message: "Local AI · Not connected.",
              },
            ),
            getOptionalJson<{ providers: ChatProviderCatalogEntry[] }>(
              "/api/settings/settings/providers",
              { providers: [] },
            ),
            runtimeSnapshot.settings.hostedProvider === "openrouter"
              ? fetchOpenRouterDiscovery()
              : Promise.resolve(null),
          ]);

        if (cancelled) return;
        setRuntime(runtimeSnapshot);
        setCredentials(credentialSnapshot);
        setLocalRuntimeStatus(localStatus);
        setProviders(providerSnapshot.providers);
        setOpenRouterDiscovery(discoverySnapshot);
      })
      .catch(() => {
        if (cancelled) return;
        setRuntime(null);
        setCredentials(EMPTY_CREDENTIALS);
        setProviders([]);
        setOpenRouterDiscovery(null);
        setLocalRuntimeStatus({
          ready: false,
          state: "unreachable",
          configuredModel: "",
          message: "Local AI · Not connected.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRouting(): Promise<ChatRuntimeSnapshot> {
    const runtimeSnapshot = await getJson<ChatRuntimeSnapshot>(
      "/api/settings/settings/runtime",
    );
    const [credentialSnapshot, localStatus, providerSnapshot, discoverySnapshot] =
      await Promise.all([
        getOptionalJson<ChatCredentialSnapshot>(
          "/api/settings/settings/credentials",
          EMPTY_CREDENTIALS,
        ),
        getOptionalJson<ChatLocalRuntimeStatus>("/api/settings/settings/local-runtime/status", {
          ready: false,
          state: "unreachable",
          configuredModel: "",
          message: "Local AI · Not connected.",
        }),
        getOptionalJson<{ providers: ChatProviderCatalogEntry[] }>(
          "/api/settings/settings/providers",
          { providers: [] },
        ),
        runtimeSnapshot.settings.hostedProvider === "openrouter"
          ? fetchOpenRouterDiscovery()
          : Promise.resolve(null),
      ]);

    setRuntime(runtimeSnapshot);
    setCredentials(credentialSnapshot);
    setLocalRuntimeStatus(localStatus);
    setProviders(providerSnapshot.providers);
    setOpenRouterDiscovery(discoverySnapshot);
    return runtimeSnapshot;
  }

  const routing = useMemo(
    () => deriveChatRoutingState(runtime, credentials),
    [credentials, runtime],
  );
  const providerOptions = useMemo(
    () => buildChatProviderOptions(localRuntimeStatus, providers, credentials),
    [credentials, localRuntimeStatus, providers],
  );
  const onboardingProviders = useMemo(
    () => buildChatOnboardingProviderOptions(providers, credentials),
    [credentials, providers],
  );
  const hostedModels = useMemo(
    () => buildHostedProviderModels(runtime, providers, openRouterDiscovery),
    [openRouterDiscovery, providers, runtime],
  );
  const hostedModelSelection = currentHostedModelPreference(runtime);
  const openRouterSelection = currentOpenRouterPreference(runtime);
  const hostedProvider: HostedProviderId | undefined = runtime?.settings.hostedProvider;

  async function activateHostedProvider(
    provider: HostedProviderId,
  ): Promise<ChatRuntimeSnapshot> {
    if (provider === "openrouter") {
      const selectionId =
        runtime?.settings.openRouterModelSelection ??
        (runtime?.settings.hostedProvider === "openrouter"
          ? currentOpenRouterPreference(runtime)
          : "governed");
      const result = await getJson<OpenRouterSelectionResponse>(
        "/api/settings/settings/providers/openrouter/model-selection",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ selectionId }),
        },
      );
      return result.runtime;
    }

    const hostedModel =
      provider === "custom-openai"
        ? (runtime?.settings.customOpenAi?.model ?? "governed")
        : runtime?.settings.hostedProvider === provider
          ? runtime.settings.hostedModel
          : "governed";
    return getJson<ChatRuntimeSnapshot>("/api/settings/settings/runtime", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hostedProvider: provider,
        hostedModel,
        hostedCallsEnabled: true,
        defaultChatTarget: "hosted",
      }),
    });
  }

  async function switchProvider(source: ChatProviderSource): Promise<ChatTarget | null> {
    if (switchInFlightRef.current) return null;
    if (source === "local") {
      setFeedback({
        kind: localRuntimeStatus?.ready === true ? "success" : "warning",
        message:
          localRuntimeStatus?.ready === true
            ? `Local · ${localRuntimeStatus.configuredModel} aktif untuk pesan berikutnya.`
            : "Local AI belum terhubung.",
      });
      return "local";
    }

    if (!credentials.credentials.some((credential) => credential.provider === source)) {
      setFeedback({
        kind: "warning",
        message: `${hostedProviderLabel(source)} belum terhubung. Tambahkan credential dari Settings.`,
      });
      return null;
    }

    switchInFlightRef.current = true;
    setSwitching(true);
    setFeedback(null);
    try {
      const result = await activateHostedProvider(source);
      const discovery = source === "openrouter" ? await fetchOpenRouterDiscovery() : null;
      setRuntime(result);
      setOpenRouterDiscovery(discovery);
      const nextRouting = deriveChatRoutingState(result, credentials);
      setFeedback({
        kind: nextRouting.hostedAvailable ? "success" : "warning",
        message: nextRouting.hostedAvailable
          ? `${hostedProviderLabel(source)} aktif untuk pesan berikutnya.`
          : `${hostedProviderLabel(source)} tersimpan, tetapi Cloud belum tersedia.`,
      });
      return nextRouting.hostedAvailable ? "hosted" : "local";
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Provider gagal diubah dan runtime tidak diubah.",
      });
      return null;
    } finally {
      switchInFlightRef.current = false;
      setSwitching(false);
    }
  }

  async function switchOpenRouterModel(selectionId: string): Promise<ChatTarget | null> {
    if (
      switchInFlightRef.current ||
      runtime?.settings.hostedProvider !== "openrouter" ||
      selectionId.trim().length === 0
    ) {
      return null;
    }

    switchInFlightRef.current = true;
    setSwitching(true);
    setFeedback(null);
    try {
      const result = await getJson<OpenRouterSelectionResponse>(
        "/api/settings/settings/providers/openrouter/model-selection",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ selectionId }),
        },
      );
      const discovery = await fetchOpenRouterDiscovery();
      setRuntime(result.runtime);
      setOpenRouterDiscovery(discovery);
      const nextRouting = deriveChatRoutingState(result.runtime, credentials);
      const displayName =
        hostedModels.find((model) => model.id === selectionId)?.displayName ?? selectionId;

      if (!result.selection.executable) {
        setFeedback({
          kind: "warning",
          message: `${displayName} tidak tersedia untuk Cloud saat ini. Pilih model lain.`,
        });
      } else if (result.selection.active && nextRouting.hostedAvailable) {
        setFeedback({
          kind: "success",
          message: `${displayName} aktif untuk pesan berikutnya.`,
        });
      } else {
        setFeedback({
          kind: "warning",
          message: `${displayName} tersimpan, tetapi Cloud belum tersedia.`,
        });
      }

      return nextRouting.hostedAvailable ? "hosted" : "local";
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "OpenRouter model switch gagal dan runtime tidak diubah.",
      });
      return null;
    } finally {
      switchInFlightRef.current = false;
      setSwitching(false);
    }
  }

  async function switchHostedModel(selectionId: string): Promise<ChatTarget | null> {
    if (
      runtime === null ||
      selectionId.trim().length === 0 ||
      !hostedModels.some((model) => model.id === selectionId && model.available)
    ) {
      return null;
    }
    if (runtime.settings.hostedProvider === "openrouter") {
      return switchOpenRouterModel(selectionId);
    }
    if (switchInFlightRef.current) return null;

    switchInFlightRef.current = true;
    setSwitching(true);
    setFeedback(null);
    try {
      const result = await getJson<ChatRuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hostedProvider: runtime.settings.hostedProvider,
          hostedModel: selectionId,
          hostedCallsEnabled: true,
          defaultChatTarget: "hosted",
        }),
      });
      setRuntime(result);
      const nextRouting = deriveChatRoutingState(result, credentials);
      const displayName =
        hostedModels.find((model) => model.id === selectionId)?.displayName ?? selectionId;
      setFeedback({
        kind: nextRouting.hostedAvailable ? "success" : "warning",
        message: nextRouting.hostedAvailable
          ? `${displayName} aktif untuk pesan berikutnya.`
          : `${displayName} tersimpan, tetapi Cloud belum tersedia.`,
      });
      return nextRouting.hostedAvailable ? "hosted" : "local";
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Model gagal diubah dan runtime tidak diubah.",
      });
      return null;
    } finally {
      switchInFlightRef.current = false;
      setSwitching(false);
    }
  }

  return {
    runtime,
    hostedProvider,
    hostedAvailable: routing.hostedAvailable,
    hostedBlockedByOpenRouterPreference: routing.hostedBlockedByOpenRouterPreference,
    hostedRouteLabel: routing.hostedRouteLabel,
    defaultTarget: routing.defaultTarget,
    localRuntimeStatus,
    providerOptions,
    onboardingProviders,
    hostedModels,
    hostedModelSelection,
    openRouterSelection,
    switching,
    feedback,
    refreshRouting,
    switchProvider,
    switchHostedModel,
    switchOpenRouterModel,
  };
}
