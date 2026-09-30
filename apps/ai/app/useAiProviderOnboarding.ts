"use client";

import { useMemo, useRef, useState } from "react";
import type { ChatTarget } from "../lib/chat-history";
import type {
  ChatOnboardingProviderOption,
  ChatRuntimeSnapshot,
  HostedProviderId,
} from "../lib/chat-model-routing";

export type AiProviderOnboardingFeedback = {
  kind: "success" | "warning" | "error";
  message: string;
};

type CredentialTestResult = {
  pass: boolean;
  persisted?: boolean;
  provider: string;
  model: string;
  latencyMs: number;
};

type OpenRouterSelectionResponse = {
  runtime: ChatRuntimeSnapshot;
};

function responseError(body: unknown, fallback: string): string {
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(responseError(body, `HTTP ${String(response.status)}`));
  }
  return body as T;
}

async function activateProvider(provider: HostedProviderId): Promise<ChatRuntimeSnapshot> {
  if (provider === "openrouter") {
    const result = await requestJson<OpenRouterSelectionResponse>(
      "/api/settings/settings/providers/openrouter/model-selection",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selectionId: "governed" }),
      },
    );
    return result.runtime;
  }

  return requestJson<ChatRuntimeSnapshot>("/api/settings/settings/runtime", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hostedProvider: provider,
      hostedModel: "governed",
      hostedCallsEnabled: true,
      defaultChatTarget: "hosted",
    }),
  });
}

export function useAiProviderOnboarding(
  providers: readonly ChatOnboardingProviderOption[],
  refreshRouting: () => Promise<ChatRuntimeSnapshot>,
) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState<HostedProviderId | null>(null);
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AiProviderOnboardingFeedback | null>(null);
  const inFlightRef = useRef(false);

  const firstConnectableProvider = useMemo(
    () => providers.find((provider) => !provider.connected && provider.connectReady) ?? null,
    [providers],
  );

  function openDialog(): void {
    if (pending) return;
    setProviderId(firstConnectableProvider?.id ?? null);
    setSecret("");
    setDialogStatus(null);
    setFeedback(null);
    setOpen(true);
  }

  function closeDialog(): void {
    if (pending) return;
    setOpen(false);
    setSecret("");
    setDialogStatus(null);
  }

  async function connect(): Promise<ChatTarget | null> {
    if (inFlightRef.current || providerId === null) return null;
    const selected = providers.find((provider) => provider.id === providerId);
    if (selected === undefined || selected.connected || !selected.connectReady) {
      setDialogStatus("Provider ini belum tersedia untuk koneksi baru dari Ai.");
      return null;
    }
    if (secret.length === 0) {
      setDialogStatus("Masukkan API key untuk melanjutkan.");
      return null;
    }

    inFlightRef.current = true;
    setPending(true);
    setDialogStatus(`Menghubungkan ${selected.displayName}…`);
    setFeedback(null);

    let credentialSaved = false;
    try {
      const test = await requestJson<CredentialTestResult>(
        `/api/settings/settings/credentials/${encodeURIComponent(providerId)}/test`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret }),
        },
      );
      if (!test.pass || test.persisted === true) {
        throw new Error("API key tidak lolos validasi. Credential belum disimpan.");
      }

      await requestJson(
        `/api/settings/settings/credentials/${encodeURIComponent(providerId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret }),
        },
      );
      credentialSaved = true;
      setSecret("");

      const runtime = await activateProvider(providerId);
      await refreshRouting();

      const active =
        runtime.settings.hostedCallsEnabled === true &&
        runtime.settings.hostedProvider === providerId;
      setFeedback({
        kind: active ? "success" : "warning",
        message: active
          ? `${selected.displayName} terhubung dan aktif untuk pesan berikutnya.`
          : `${selected.displayName} terhubung, tetapi Cloud belum dapat diaktifkan oleh kebijakan runtime.`,
      });
      setOpen(false);
      setDialogStatus(null);
      return active ? "hosted" : null;
    } catch (error) {
      if (credentialSaved) {
        setSecret("");
        await refreshRouting().catch(() => undefined);
        const message =
          error instanceof Error ? error.message : "Aktivasi provider gagal setelah credential tersimpan.";
        setFeedback({
          kind: "warning",
          message: `Credential tersimpan di Connect Vault, tetapi provider belum aktif: ${message}`,
        });
        setOpen(false);
        setDialogStatus(null);
        return null;
      }

      setDialogStatus(error instanceof Error ? error.message : "Provider gagal dihubungkan.");
      return null;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }

  return {
    providers,
    open,
    providerId,
    secret,
    pending,
    dialogStatus,
    feedback,
    firstConnectableProvider,
    openDialog,
    closeDialog,
    connect,
    setProviderId,
    setSecret,
  };
}

export type AiProviderOnboardingController = ReturnType<typeof useAiProviderOnboarding>;
