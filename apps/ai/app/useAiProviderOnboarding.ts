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

type ProviderSelectionId = HostedProviderId | "__other__";

type CustomConnectResponse = {
  pass: boolean;
  runtime: ChatRuntimeSnapshot;
  config: {
    name: string;
    baseUrl: string;
    model: string;
    inputUsdPerMTok: number;
    outputUsdPerMTok: number;
  };
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
  const [providerId, setProviderId] = useState<ProviderSelectionId | null>(null);
  const [secret, setSecret] = useState("");
  const [customName, setCustomName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customInputUsdPerMTok, setCustomInputUsdPerMTok] = useState("0");
  const [customOutputUsdPerMTok, setCustomOutputUsdPerMTok] = useState("0");
  const [pending, setPending] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AiProviderOnboardingFeedback | null>(null);
  const inFlightRef = useRef(false);

  const firstConnectableProvider = useMemo(
    () =>
      providers.find((provider) => !provider.connected && provider.connectReady) ??
      providers.find((provider) => provider.connectReady) ??
      null,
    [providers],
  );

  function openDialog(): void {
    if (pending) return;
    setProviderId(firstConnectableProvider?.id ?? null);
    setSecret("");
    setCustomName("");
    setCustomBaseUrl("");
    setCustomModel("");
    setCustomInputUsdPerMTok("0");
    setCustomOutputUsdPerMTok("0");
    setDialogStatus(null);
    setFeedback(null);
    setOpen(true);
  }

  function closeDialog(): void {
    if (pending) return;
    setOpen(false);
    setSecret("");
    setCustomName("");
    setCustomBaseUrl("");
    setCustomModel("");
    setDialogStatus(null);
  }

  async function connect(): Promise<ChatTarget | null> {
    if (inFlightRef.current || providerId === null) return null;

    if (providerId === "__other__") {
      const name = customName.trim();
      const baseUrl = customBaseUrl.trim();
      const model = customModel.trim();
      const inputUsdPerMTok = Number(customInputUsdPerMTok);
      const outputUsdPerMTok = Number(customOutputUsdPerMTok);
      if (name.length === 0 || baseUrl.length === 0 || model.length === 0) {
        setDialogStatus("Lengkapi Name, Base URL, dan Model custom provider.");
        return null;
      }
      if (secret.length === 0) {
        setDialogStatus("Masukkan API key untuk melanjutkan.");
        return null;
      }
      if (
        !Number.isFinite(inputUsdPerMTok) ||
        inputUsdPerMTok < 0 ||
        !Number.isFinite(outputUsdPerMTok) ||
        outputUsdPerMTok < 0
      ) {
        setDialogStatus("Pricing input/output harus angka USD per 1M token yang valid.");
        return null;
      }

      inFlightRef.current = true;
      setPending(true);
      setDialogStatus(`Memvalidasi ${name}…`);
      setFeedback(null);
      try {
        const result = await requestJson<CustomConnectResponse>(
          "/api/settings/settings/providers/custom-openai/connect",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name,
              baseUrl,
              model,
              secret,
              inputUsdPerMTok,
              outputUsdPerMTok,
            }),
          },
        );
        if (!result.pass) throw new Error("Custom provider tidak lolos validasi.");
        setSecret("");
        await refreshRouting();
        const active =
          result.runtime.settings.hostedCallsEnabled === true &&
          result.runtime.settings.hostedProvider === "custom-openai";
        setFeedback({
          kind: active ? "success" : "warning",
          message: active
            ? `${result.config.name} terhubung dan aktif untuk pesan berikutnya.`
            : `${result.config.name} tervalidasi, tetapi Hosted belum dapat diaktifkan oleh kebijakan runtime.`,
        });
        setOpen(false);
        setDialogStatus(null);
        return active ? "hosted" : null;
      } catch (error) {
        setDialogStatus(
          error instanceof Error ? error.message : "Custom provider gagal dihubungkan.",
        );
        return null;
      } finally {
        inFlightRef.current = false;
        setPending(false);
      }
    }

    const selected = providers.find((provider) => provider.id === providerId);
    if (selected === undefined || !selected.connectReady) {
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
        `/api/settings/settings/credentials/${encodeURIComponent(providerId)}/connections`,
        {
          method: "POST",
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
          ? `${selected.displayName} · API key baru terhubung dan aktif untuk pesan berikutnya.`
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
          error instanceof Error
            ? error.message
            : "Aktivasi provider gagal setelah credential tersimpan.";
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
    customName,
    customBaseUrl,
    customModel,
    customInputUsdPerMTok,
    customOutputUsdPerMTok,
    pending,
    dialogStatus,
    feedback,
    firstConnectableProvider,
    openDialog,
    closeDialog,
    connect,
    setProviderId,
    setSecret,
    setCustomName,
    setCustomBaseUrl,
    setCustomModel,
    setCustomInputUsdPerMTok,
    setCustomOutputUsdPerMTok,
  };
}

export type AiProviderOnboardingController = ReturnType<typeof useAiProviderOnboarding>;
