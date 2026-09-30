"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientResponseError, readJson } from "../../lib/client-response";
import { credentialSaveReady, type CredentialTestStamp } from "../../lib/credential-onboarding";
import { canaryStatusFromErrorCode, providerHealth } from "../../lib/provider-health";

export type HostedProviderId = "anthropic" | "openrouter" | "openai" | "nvidia";
export type HostedModelPreference = string;
type ModelFamily = "gpt" | "gemini" | "qwen" | "deepseek" | "kimi" | "glm" | "other";
type HostedModelCatalogEntry = {
  id: string;
  displayName: string;
  providerRuntime: string;
  sourceProvider?: string;
  family?: ModelFamily;
  verification?: "verified" | "discovered";
  catalogSource?: "static-verified" | "openrouter-discovery";
  verifiedAt?: string | null;
};
export type RuntimeSnapshot = {
  revision: number;
  settings: {
    hostedProvider: HostedProviderId;
    hostedModel: HostedModelPreference;
    openRouterModelSelection?: HostedModelPreference;
    localRuntime: "openai-compatible" | "ollama";
    localBaseUrl: string;
    localModelTag: string;
    localModelDigest: string | null;
    hostedCallsEnabled: boolean;
    spendDailyUsd?: number | null;
    spendMonthlyUsd?: number | null;
    spendUnlimited?: boolean;
    defaultChatTarget: "local" | "hosted";
  };
};
type Credential = { provider: string; purpose: string; generation: number; updatedAt: string };
type ProviderCatalogEntry = {
  id: string;
  displayName: string;
  category: "ai" | "integration";
  credentialPurpose: "messages" | "tokens";
  credentialReady: boolean;
  routingReady: boolean;
  connectionTestReady: boolean;
  hostedModels: HostedModelCatalogEntry[];
};
type OpenRouterDiscoveredModel = {
  id: string;
  displayName: string;
  sourceProvider: string;
  family: ModelFamily;
  contextWindowTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportedParameters: string[];
  promptPricePerToken: string | null;
  completionPricePerToken: string | null;
  mutableAlias: boolean;
  admission: "verified-executable" | "verified-selectable" | "unavailable" | "discovered-only";
  selectable: boolean;
  executable: boolean;
  selectionId: string | null;
  validationPlan?: {
    capUsd: number;
    inputUsdPerMTok: number;
    outputUsdPerMTok: number;
    maxOutputTokens: number;
    reservationUsd: number;
  } | null;
  unavailableReason:
    | "duplicate-runtime-id"
    | "mutable-alias"
    | "invalid-runtime-slug"
    | "missing-context-window"
    | "text-input-unsupported"
    | "text-output-unsupported"
    | "max-tokens-unsupported"
    | "missing-pricing"
    | "invalid-pricing"
    | "stale-catalog"
    | null;
};
type OpenRouterDiscoverySnapshot = {
  source: "openrouter:/api/v1/models";
  families: Array<{ id: Exclude<ModelFamily, "other">; displayName: string }>;
  cache: "hit" | "refreshed" | "stale";
  stale: boolean;
  fetchedAt: string;
  expiresAt: string;
  total: number;
  returned: number;
  models: OpenRouterDiscoveredModel[];
};
type OpenRouterSelectionResult = {
  runtime: RuntimeSnapshot;
  selection: {
    id: string;
    admission: string;
    executable: boolean;
    active: boolean;
    unavailableReason: string | null;
  };
};
type HostedCanaryStatus = "connected" | "invalid-key" | "unreachable" | "timeout" | "error";
type LocalRuntimeStatus = {
  runtime: "openai-compatible" | "ollama";
  state: "connected" | "model-missing" | "identity-mismatch" | "unreachable" | "unsupported";
  reachable: boolean;
  ready: boolean;
  configuredModel: string;
  models: string[];
  modelDigest: string | null;
  identityProvenance: "verified" | "resolved" | "declared-unverified" | "unverified";
  identitySource: string;
  message: string;
};
type SpendStatus = {
  operatorGateOpen: boolean;
  policy: {
    dailyUsd: number | null;
    monthlyUsd: number | null;
    unlimited: boolean;
  };
  budget: null | {
    dailyLimitUsd: number | null;
    monthlyLimitUsd: number | null;
    dailyCommittedUsd: number;
    monthlyCommittedUsd: number;
    unsettledReservations: number;
  };
};
type McpServer = {
  id: string;
  displayName: string;
  enabled: boolean;
  workspaceIds: string[];
  transport: unknown;
  toolPolicies: unknown[];
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  return readJson<T>(response);
}

function openRouterPreferenceNeedsExecution(runtime: RuntimeSnapshot | null): boolean {
  if (runtime?.settings.hostedProvider !== "openrouter") return false;
  const selection = runtime.settings.openRouterModelSelection ?? runtime.settings.hostedModel;
  return selection !== "governed" && runtime.settings.hostedModel !== selection;
}

export function useSettingsController(initialWorkspaceId: string) {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [spendStatus, setSpendStatus] = useState<SpendStatus | null>(null);
  const [spendDraft, setSpendDraft] = useState({
    dailyUsd: "",
    monthlyUsd: "",
    unlimited: false,
  });
  const [secret, setSecret] = useState("");
  const [secretRevision, setSecretRevision] = useState(0);
  const [secretProvider, setSecretProvider] = useState("anthropic");
  const [credentialTest, setCredentialTest] = useState<CredentialTestStamp | null>(null);
  const [connectProviderId, setConnectProviderId] = useState<HostedProviderId | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalRuntimeStatus | null>(null);
  const [openRouterDiscovery, setOpenRouterDiscovery] =
    useState<OpenRouterDiscoverySnapshot | null>(null);
  const [openRouterQuery, setOpenRouterQuery] = useState("");
  const [openRouterSourceProvider, setOpenRouterSourceProvider] = useState("");

  const [localSetupOpen, setLocalSetupOpen] = useState(false);
  const [mcpJson, setMcpJson] = useState("");
  const [status, setStatus] = useState("");
  const [hostedHealth, setHostedHealth] = useState<{
    provider: HostedProviderId;
    status: HostedCanaryStatus;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const actionInFlight = useRef(false);
  const mcpLoadRequestRef = useRef(0);
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => {
    workspaceIdRef.current = initialWorkspaceId;
    setWorkspaceId(initialWorkspaceId);
  }, [initialWorkspaceId]);

  function beginAction(action: string): boolean {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setPendingAction(action);
    return true;
  }

  function finishAction(): void {
    actionInFlight.current = false;
    setPendingAction(null);
  }

  const refresh = useCallback(async () => {
    try {
      const [runtimeResult, providerResult, credentialResult, spendResult] = await Promise.all([
        json<RuntimeSnapshot>("/api/settings/settings/runtime"),
        json<{ providers: ProviderCatalogEntry[] }>("/api/settings/settings/providers"),
        json<{ credentials: Credential[] }>("/api/settings/settings/credentials"),
        json<SpendStatus>("/api/settings/settings/spend-status"),
      ]);
      setRuntime(runtimeResult);
      setProviders(providerResult.providers);
      setCredentials(credentialResult.credentials);
      setSpendStatus(spendResult);
      setSpendDraft({
        dailyUsd: spendResult.policy.dailyUsd?.toString() ?? "",
        monthlyUsd: spendResult.policy.monthlyUsd?.toString() ?? "",
        unlimited: spendResult.policy.unlimited,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const refreshLocalStatus = useCallback(async () => {
    const result = await json<LocalRuntimeStatus>(
      "/api/settings/settings/local-runtime/status",
    );
    setLocalStatus(result);
    return result;
  }, []);

  const refreshCredentials = useCallback(async () => {
    const result = await json<{ credentials: Credential[] }>(
      "/api/settings/settings/credentials",
    );
    setCredentials(result.credentials);
  }, []);

  const refreshMcp = useCallback(async () => {
    const requestId = ++mcpLoadRequestRef.current;
    const requestedWorkspace = workspaceId;
    setMcpLoading(true);
    try {
      const result = await json<{ servers: McpServer[] }>(
        `/api/settings/settings/mcp/servers?workspaceId=${encodeURIComponent(requestedWorkspace)}`,
      );
      if (
        requestId !== mcpLoadRequestRef.current ||
        workspaceIdRef.current !== requestedWorkspace
      )
        return;
      setServers(result.servers);
      setStatus(`Loaded ${String(result.servers.length)} MCP server configuration(s).`);
    } catch (error) {
      if (requestId === mcpLoadRequestRef.current) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (requestId === mcpLoadRequestRef.current) setMcpLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
    void refreshLocalStatus().catch(() => {
      setLocalStatus({
        runtime: "openai-compatible",
        state: "unreachable",
        reachable: false,
        ready: false,
        configuredModel: "",
        models: [],
        modelDigest: null,
        identityProvenance: "unverified",
        identitySource: "none",
        message: "Local AI Ã‚Â· Not connected.",
      });
    });
  }, [refresh, refreshLocalStatus]);

  const mutableLocalModel =
    runtime !== null && /(^|[:@])latest$/i.test(runtime.settings.localModelTag.trim());
  const hostedProviderOptions = providers.filter(
    (provider): provider is ProviderCatalogEntry & { id: HostedProviderId } =>
      provider.category === "ai" &&
      provider.routingReady &&
      (provider.id === "anthropic" ||
        provider.id === "openrouter" ||
        provider.id === "openai" ||
        provider.id === "nvidia"),
  );
  const credentialProviderOptions = providers.filter((provider) => provider.credentialReady);
  const activeHostedProvider =
    runtime === null
      ? null
      : (hostedProviderOptions.find(
          (provider) => provider.id === runtime.settings.hostedProvider,
        ) ?? null);
  const activeHostedModels = activeHostedProvider?.hostedModels ?? [];
  const openRouterPickerModels = (() => {
    if (runtime?.settings.hostedProvider !== "openrouter") return [];
    const seen = new Set<string>();
    const models: Array<{ id: string; displayName: string; executable: boolean }> = [];
    for (const model of activeHostedModels) {
      if (seen.has(model.id)) continue;
      seen.add(model.id);
      models.push({ id: model.id, displayName: model.displayName, executable: true });
    }
    for (const model of openRouterDiscovery?.models ?? []) {
      if (!model.selectable || model.selectionId === null || seen.has(model.selectionId))
        continue;
      seen.add(model.selectionId);
      models.push({
        id: model.selectionId,
        displayName: model.displayName,
        executable: model.executable,
      });
    }
    const saved = runtime.settings.openRouterModelSelection?.trim();
    if (saved && saved !== "governed" && !seen.has(saved)) {
      models.push({
        id: saved,
        displayName: saved,
        executable: runtime.settings.hostedModel === saved,
      });
    }
    return models;
  })();
  const connectProvider =
    connectProviderId === null
      ? null
      : (hostedProviderOptions.find((provider) => provider.id === connectProviderId) ?? null);
  const providerViews = hostedProviderOptions.map((provider) => {
    const credential = credentials.find((item) => item.provider === provider.id) ?? null;
    const canaryStatus =
      hostedHealth !== null && hostedHealth.provider === provider.id
        ? hostedHealth.status
        : undefined;
    return {
      provider,
      credential,
      active:
        runtime?.settings.hostedProvider === provider.id && runtime.settings.hostedCallsEnabled,
      health: providerHealth({
        hasCredential: credential !== null,
        routingReady: provider.routingReady,
        isCurrentHostedProvider: runtime?.settings.hostedProvider === provider.id,
        hostedCallsEnabled: runtime?.settings.hostedCallsEnabled ?? false,
        canaryStatus,
      }),
    };
  });
  const selectedCredential =
    credentials.find((item) => item.provider === secretProvider) ?? null;
  const selectedProviderOption =
    providers.find((provider) => provider.id === secretProvider) ?? null;
  const selectedProviderRequiresTest = selectedProviderOption?.connectionTestReady ?? false;
  const credentialTestPassed =
    selectedProviderRequiresTest &&
    credentialTest?.pass === true &&
    credentialTest.provider === secretProvider &&
    credentialTest.revision === secretRevision;
  const credentialReadyToSave =
    selectedProviderOption !== null &&
    selectedProviderOption.credentialReady &&
    credentialSaveReady({
      secret,
      provider: secretProvider,
      revision: secretRevision,
      connectionTestReady: selectedProviderRequiresTest,
      test: credentialTest,
    });
  const selectedProviderHealth = providerHealth({
    hasCredential: selectedCredential !== null,
    routingReady: selectedProviderOption?.routingReady ?? false,
    isCurrentHostedProvider: runtime?.settings.hostedProvider === secretProvider,
    hostedCallsEnabled: runtime?.settings.hostedCallsEnabled ?? false,
    canaryStatus:
      hostedHealth !== null && hostedHealth.provider === secretProvider
        ? hostedHealth.status
        : undefined,
  });
  const openRouterPreferenceRequiresExecution = openRouterPreferenceNeedsExecution(runtime);

  async function discoverOpenRouterModels(forceRefresh = false): Promise<void> {
    if (!beginAction("openrouter-discovery")) return;
    setStatus(
      forceRefresh
        ? "Refreshing OpenRouter model catalogÃ¢â‚¬Â¦"
        : "Searching OpenRouter model catalogÃ¢â‚¬Â¦",
    );
    try {
      const params = new URLSearchParams();
      const q = openRouterQuery.trim();
      const sourceProvider = openRouterSourceProvider.trim().toLowerCase();
      if (q.length > 0) params.set("q", q);
      if (sourceProvider.length > 0) params.set("sourceProvider", sourceProvider);
      params.set("limit", "40");
      if (forceRefresh) params.set("refresh", "1");
      const result = await json<OpenRouterDiscoverySnapshot>(
        `/api/settings/settings/providers/openrouter/models?${params.toString()}`,
      );
      setOpenRouterDiscovery(result);
      setStatus(
        `OpenRouter catalog: ${String(result.returned)} shown / ${String(result.total)} matched Ã‚Â· ${result.cache}${
          result.stale ? " (stale fallback)" : ""
        }.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function validateOpenRouterModel(selectionId: string): Promise<void> {
    const candidate = openRouterDiscovery?.models.find(
      (model) => model.selectionId === selectionId,
    );
    if (candidate?.validationPlan === null || candidate?.validationPlan === undefined) {
      setStatus("Model ini belum memiliki rencana test yang aman dari catalog OpenRouter.");
      return;
    }
    const confirmed = window.confirm(
      `Test ${candidate.displayName}? Reservasi maksimum USD ${candidate.validationPlan.reservationUsd.toFixed(2)} (batas test USD ${candidate.validationPlan.capUsd.toFixed(2)}). Biaya aktual OpenRouter dan budget akan dicatat.`,
    );
    if (!confirmed || !beginAction("openrouter-model-validation")) return;
    setStatus(`Testing ${candidate.displayName} dengan batas USD ${candidate.validationPlan.capUsd.toFixed(2)}…`);
    try {
      const result = await json<{
        pass: boolean;
        ready: boolean;
        selectionId: string;
        runtime?: RuntimeSnapshot;
        test: { actualUsd: number; reservedUsd: number; latencyMs: number };
      }>(
        `/api/settings/settings/providers/openrouter/models/${encodeURIComponent(selectionId)}/validate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        },
      );
      if (result.runtime !== undefined) setRuntime(result.runtime);
      setOpenRouterDiscovery((current) =>
        current === null
          ? current
          : {
              ...current,
              models: current.models.map((model) =>
                model.selectionId === result.selectionId
                  ? { ...model, executable: true, validationPlan: null }
                  : model,
              ),
            },
      );
      setHostedHealth(null);
      setStatus(
        result.pass && result.ready
          ? `${candidate.displayName} Ready. Test ${result.test.latencyMs.toFixed(0)}ms; biaya aktual USD ${result.test.actualUsd.toFixed(6)} (reservasi USD ${result.test.reservedUsd.toFixed(6)}).`
          : `${candidate.displayName} belum menjadi Ready.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function saveRuntime() {
    if (runtime === null || !beginAction("runtime")) return;
    const requestedHosted = runtime.settings.hostedCallsEnabled;
    setStatus("Saving runtime settingsÃ¢â‚¬Â¦");
    try {
      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(runtime.settings),
      });
      setRuntime(result);
      setHostedHealth(null);
      if (requestedHosted && !result.settings.hostedCallsEnabled) {
        setStatus(
          openRouterPreferenceNeedsExecution(result)
            ? `Runtime revision ${String(result.revision)} saved. Model OpenRouter ini belum executable, jadi Cloud AI tetap OFF.`
            : `Runtime revision ${String(result.revision)} saved. Hosted remains OFF because the operator gate is closed.`,
        );
      } else {
        setStatus(`Runtime settings saved at revision ${String(result.revision)}.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function saveSpendPolicy() {
    if (runtime === null || !beginAction("spend-policy")) return;
    const parseBudget = (label: string, value: string): number | null => {
      if (value.trim() === "") return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(label + " harus berupa angka USD positif.");
      }
      return parsed;
    };

    setStatus("Menyimpan pengaturan Cloud AI dan budget...");
    try {
      const dailyUsd = parseBudget("Budget harian", spendDraft.dailyUsd);
      const monthlyUsd = parseBudget("Budget bulanan", spendDraft.monthlyUsd);
      if (!spendDraft.unlimited && dailyUsd === null && monthlyUsd === null) {
        throw new Error(
          "Isi minimal budget harian atau bulanan, atau aktifkan mode tanpa batas secara eksplisit.",
        );
      }

      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hostedCallsEnabled: runtime.settings.hostedCallsEnabled,
          defaultChatTarget: runtime.settings.hostedCallsEnabled
            ? runtime.settings.defaultChatTarget
            : "local",
          spendDailyUsd: dailyUsd,
          spendMonthlyUsd: monthlyUsd,
          spendUnlimited: spendDraft.unlimited,
        }),
      });
      const nextSpendStatus = await json<SpendStatus>("/api/settings/settings/spend-status");
      setRuntime(result);
      setSpendStatus(nextSpendStatus);
      setSpendDraft({
        dailyUsd: nextSpendStatus.policy.dailyUsd?.toString() ?? "",
        monthlyUsd: nextSpendStatus.policy.monthlyUsd?.toString() ?? "",
        unlimited: nextSpendStatus.policy.unlimited,
      });
      setHostedHealth(null);
      if (runtime.settings.hostedCallsEnabled && !result.settings.hostedCallsEnabled) {
        setStatus(
          openRouterPreferenceNeedsExecution(result)
            ? "Budget tersimpan. Cloud AI tetap mati karena model OpenRouter yang dipilih belum executable."
            : "Budget tersimpan, tetapi Cloud AI tetap mati karena emergency kill switch operator tertutup.",
        );
      } else {
        setStatus(
          nextSpendStatus.policy.unlimited
            ? "Cloud AI disimpan dalam mode tanpa batas."
            : "Budget Cloud AI berhasil disimpan dan langsung aktif.",
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function testCredential() {
    if (selectedProviderOption === null || !selectedProviderOption.connectionTestReady) {
      setStatus("Connection test belum tersedia untuk provider ini.");
      return;
    }
    if (secret.length === 0) {
      setStatus("Paste API key terlebih dahulu sebelum menjalankan test.");
      return;
    }
    if (!beginAction("test-credential")) return;

    const provider = secretProvider;
    const revision = secretRevision;
    setCredentialTest(null);
    setStatus(`Testing ${selectedProviderOption.displayName} credential without savingÃ¢â‚¬Â¦`);
    try {
      const result = await json<{
        pass: boolean;
        persisted: boolean;
        provider: string;
        model: string;
        latencyMs: number;
      }>(`/api/settings/settings/credentials/${encodeURIComponent(provider)}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const pass = result.pass && !result.persisted;
      setCredentialTest({ provider, revision, pass });
      setStatus(
        pass
          ? `Credential test PASS: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms. Secret belum disimpan.`
          : "Credential test gagal. Secret belum disimpan.",
      );
    } catch (error) {
      setCredentialTest({ provider, revision, pass: false });
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  function beginProviderConnect(provider: HostedProviderId): void {
    if (pendingAction !== null) return;
    setConnectProviderId(provider);
    setSecretProvider(provider);
    setSecret("");
    setSecretRevision((current) => current + 1);
    setCredentialTest(null);
    setHostedHealth(null);
    setStatus("");
  }

  async function activateProviderRuntime(provider: HostedProviderId): Promise<RuntimeSnapshot> {
    if (provider === "openrouter") {
      const result = await json<OpenRouterSelectionResult>(
        "/api/settings/settings/providers/openrouter/model-selection",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ selectionId: "governed" }),
        },
      );
      return result.runtime;
    }

    return json<RuntimeSnapshot>("/api/settings/settings/runtime", {
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

  async function activateStoredProvider(provider: HostedProviderId): Promise<void> {
    if (runtime === null || !beginAction("activate-provider")) return;
    setStatus(`Activating ${provider}Ã¢â‚¬Â¦`);
    try {
      const result = await activateProviderRuntime(provider);
      setRuntime(result);
      setHostedHealth(null);
      setStatus(
        result.settings.hostedCallsEnabled
          ? provider === "openrouter"
            ? "OpenRouter aktif menggunakan Recommended. Jalankan test provider bila ingin memverifikasi koneksi saat ini."
            : "Provider aktif. Jalankan test provider bila ingin memverifikasi koneksi saat ini."
          : "Provider tersimpan, tetapi hosted tetap OFF karena operator gate sedang tertutup.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function saveDefaultProviderModel(): Promise<void> {
    if (runtime === null || !beginAction("default-provider-model")) return;
    setStatus("Saving default provider/modelÃ¢â‚¬Â¦");
    try {
      if (runtime.settings.hostedProvider === "openrouter") {
        const selectionId = runtime.settings.openRouterModelSelection ?? "governed";
        const result = await json<OpenRouterSelectionResult>(
          "/api/settings/settings/providers/openrouter/model-selection",
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ selectionId }),
          },
        );
        setRuntime(result.runtime);
        setHostedHealth(null);
        setStatus(
          result.selection.executable
            ? result.selection.active
              ? "Default OpenRouter model saved and active."
              : "Default OpenRouter model saved, tetapi hosted tetap OFF karena operator gate sedang tertutup."
            : "OpenRouter model selection saved. Hosted execution is disabled until this model has separate executable validation.",
        );
        return;
      }

      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hostedProvider: runtime.settings.hostedProvider,
          hostedModel: runtime.settings.hostedModel,
          hostedCallsEnabled: true,
          defaultChatTarget: "hosted",
        }),
      });
      setRuntime(result);
      setHostedHealth(null);
      setStatus(
        result.settings.hostedCallsEnabled
          ? "Default hosted provider/model saved."
          : "Default saved, tetapi hosted tetap OFF karena operator gate sedang tertutup.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function saveCredential() {
    if (selectedProviderOption === null || !selectedProviderOption.credentialReady) {
      setStatus("Provider credential metadata belum tersedia.");
      return;
    }
    if (!credentialReadyToSave) {
      setStatus(
        selectedProviderRequiresTest
          ? "Test API key dan pastikan hasilnya PASS sebelum menyimpan."
          : "Paste credential terlebih dahulu.",
      );
      return;
    }
    if (!beginAction("credential")) return;
    setStatus("Encrypting credentialÃ¢â‚¬Â¦");
    try {
      await json(`/api/settings/settings/credentials/${encodeURIComponent(secretProvider)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      setSecret("");
      setSecretRevision((current) => current + 1);
      setCredentialTest(null);
      setHostedHealth((current) => (current?.provider === secretProvider ? null : current));
      await refreshCredentials();
      if (selectedProviderOption.routingReady && runtime !== null) {
        const provider = secretProvider as HostedProviderId;
        const activated = await activateProviderRuntime(provider);
        setRuntime(activated);
        setHostedHealth(
          activated.settings.hostedCallsEnabled ? { provider, status: "connected" } : null,
        );
        setConnectProviderId(null);
        setStatus(
          activated.settings.hostedCallsEnabled
            ? provider === "openrouter"
              ? "API key terverifikasi, terenkripsi di Connect Vault, dan OpenRouter Recommended sudah aktif."
              : "API key terverifikasi, terenkripsi di Connect Vault, dan provider sudah aktif."
            : "API key terverifikasi dan tersimpan, tetapi hosted tetap OFF karena operator gate.",
        );
      } else {
        setStatus("Credential encrypted in Connect vault. Plaintext was not returned.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function removeCredential() {
    if (selectedCredential === null || !beginAction("remove-credential")) return;
    setStatus("Removing credentialÃ¢â‚¬Â¦");
    try {
      await json(`/api/settings/settings/credentials/${encodeURIComponent(secretProvider)}`, {
        method: "DELETE",
      });
      setSecret("");
      setSecretRevision((current) => current + 1);
      setCredentialTest(null);
      setHostedHealth((current) => (current?.provider === secretProvider ? null : current));
      await refreshCredentials();
      setStatus("Credential removed from Connect vault.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function runCanary(target: "local" | "hosted") {
    if (!beginAction(`canary-${target}`)) return;
    setStatus(target === "local" ? "Running local canaryÃ¢â‚¬Â¦" : "Running hosted canaryÃ¢â‚¬Â¦");
    const testedProvider = runtime?.settings.hostedProvider;
    try {
      const result = await json<{
        pass: boolean;
        latencyMs: number;
        provider: string;
        model: string;
        modelIdentity: string;
        modelIdentityPinned: boolean;
        modelIdentityProvenance?: string;
      }>("/api/settings/ops/provider-canary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (target === "hosted" && testedProvider !== undefined) {
        setHostedHealth({
          provider: testedProvider,
          status: result.pass ? "connected" : "error",
        });
      }
      // Provenance ditampilkan apa adanya: `declared-unverified` berarti operator
      // menyatakan digest tapi runtime tidak bisa mengonfirmasinya Ã¢â‚¬â€ itu bukan PINNED.
      const provenance =
        result.modelIdentityProvenance === undefined
          ? ""
          : ` (${result.modelIdentityProvenance})`;
      setStatus(
        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms Ã‚Â· identity ${result.modelIdentityPinned ? "PINNED" : "UNPINNED"}${provenance}`,
      );
    } catch (error) {
      if (target === "hosted" && testedProvider !== undefined) {
        if (
          error instanceof ClientResponseError &&
          error.code === "PROVIDER_CREDENTIAL_MISSING"
        ) {
          setHostedHealth(null);
          try {
            await refreshCredentials();
          } catch {
            // Preserve the original canary failure as the user-facing result.
          }
        } else {
          setHostedHealth({
            provider: testedProvider,
            status:
              error instanceof ClientResponseError
                ? (canaryStatusFromErrorCode(error.code) ?? "error")
                : "error",
          });
        }
      }
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function saveLocalSetup(): Promise<void> {
    if (runtime === null || !beginAction("local-setup")) return;
    setStatus("Checking Local AI configuration before savingÃ¢â‚¬Â¦");
    try {
      const discovered = await json<LocalRuntimeStatus>(
        "/api/settings/settings/local-runtime/status",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            localRuntime: runtime.settings.localRuntime,
            localBaseUrl: runtime.settings.localBaseUrl,
            localModelTag: runtime.settings.localModelTag,
          }),
        },
      );
      setLocalStatus(discovered);

      if (!discovered.ready) {
        setStatus(discovered.message);
        return;
      }
      if (mutableLocalModel && discovered.modelDigest === null) {
        setStatus(
          "Runtime terhubung, tetapi tag model mutable belum punya digest terverifikasi. Pilih model ID immutable atau gunakan Advanced identity settings.",
        );
        return;
      }

      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          localRuntime: runtime.settings.localRuntime,
          localBaseUrl: runtime.settings.localBaseUrl,
          localModelTag: runtime.settings.localModelTag,
          localModelDigest: discovered.modelDigest,
        }),
      });
      setRuntime(result);
      setStatus(
        discovered.modelDigest === null
          ? discovered.message
          : `${discovered.message} Identity pinned automatically.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function checkLocalStatus(): Promise<void> {
    if (!beginAction("local-discovery")) return;
    setStatus("Checking Local AIÃ¢â‚¬Â¦");
    try {
      const discovered = await refreshLocalStatus();
      setStatus(discovered.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  async function saveMcpServer() {
    if (!beginAction("mcp")) return;
    setStatus("Validating and saving MCP serverÃ¢â‚¬Â¦");
    try {
      const parsed = JSON.parse(mcpJson) as McpServer;
      await json(`/api/settings/settings/mcp/servers/${encodeURIComponent(parsed.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      await refreshMcp();
      setStatus(
        "MCP server configuration saved. Execution permission is still evaluated separately.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      finishAction();
    }
  }

  return {
    activateStoredProvider,
    activeHostedModels,
    beginProviderConnect,
    checkLocalStatus,
    connectProvider,
    credentialProviderOptions,
    credentialReadyToSave,
    credentialTestPassed,
    hostedProviderOptions,
    localSetupOpen,
    localStatus,
    openRouterDiscovery,
    openRouterPickerModels,
    openRouterQuery,
    openRouterSourceProvider,
    openRouterPreferenceRequiresExecution,
    mcpJson,
    mcpLoading,
    mutableLocalModel,
    pendingAction,
    providerViews,
    refreshMcp,
    removeCredential,
    discoverOpenRouterModels,
    validateOpenRouterModel,
    runCanary,
    runtime,
    saveCredential,
    saveDefaultProviderModel,
    saveLocalSetup,
    saveMcpServer,
    saveRuntime,
    saveSpendPolicy,
    secret,
    secretProvider,
    selectedCredential,
    selectedProviderHealth,
    selectedProviderOption,
    servers,
    spendDraft,
    spendStatus,
    setConnectProviderId,
    setCredentialTest,
    setHostedHealth,
    setLocalSetupOpen,
    setLocalStatus,
    setOpenRouterQuery,
    setOpenRouterSourceProvider,
    setMcpJson,
    setRuntime,
    setSecret,
    setSecretProvider,
    setSecretRevision,
    setSpendDraft,
    setStatus,
    setWorkspaceId,
    status,
    testCredential,
    workspaceId,
    workspaceIdRef,
  };
}
