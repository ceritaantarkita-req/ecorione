"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatTarget } from "../lib/chat-history";
import {
  buildOpenRouterQuickSwitchModels,
  currentOpenRouterPreference,
  deriveChatRoutingState,
  type ChatCredentialSnapshot,
  type ChatLocalRuntimeStatus,
  type ChatOpenRouterDiscovery,
  type ChatProviderCatalogEntry,
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
              ? getOptionalJson<ChatOpenRouterDiscovery | null>(
                  "/api/settings/settings/providers/openrouter/models?limit=100",
                  null,
                )
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

  const routing = useMemo(
    () => deriveChatRoutingState(runtime, credentials),
    [credentials, runtime],
  );
  const openRouterModels = useMemo(
    () => buildOpenRouterQuickSwitchModels(runtime, providers, openRouterDiscovery),
    [openRouterDiscovery, providers, runtime],
  );
  const openRouterSelection = currentOpenRouterPreference(runtime);
  const hostedProvider: HostedProviderId | undefined = runtime?.settings.hostedProvider;

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
      setRuntime(result.runtime);
      const nextRouting = deriveChatRoutingState(result.runtime, credentials);
      const displayName =
        openRouterModels.find((model) => model.id === selectionId)?.displayName ?? selectionId;

      if (!result.selection.executable) {
        setFeedback({
          kind: "warning",
          message: `${displayName} disimpan sebagai preference. Model belum executable; chat tetap Local.`,
        });
      } else if (result.selection.active && nextRouting.hostedAvailable) {
        setFeedback({
          kind: "success",
          message: `${displayName} aktif untuk Hosted chat.`,
        });
      } else {
        setFeedback({
          kind: "warning",
          message: `${displayName} tersimpan, tetapi Hosted belum tersedia. Chat tetap Local.`,
        });
      }

      return nextRouting.defaultTarget;
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "OpenRouter model quick-switch gagal dan runtime tidak diubah.",
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
    openRouterModels,
    openRouterSelection,
    switching,
    feedback,
    switchOpenRouterModel,
  };
}
