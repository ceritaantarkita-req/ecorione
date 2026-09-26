"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientResponseError, readJson } from "../../lib/client-response";
import { credentialSaveReady, type CredentialTestStamp } from "../../lib/credential-onboarding";
import { canaryStatusFromErrorCode, providerHealth } from "../../lib/provider-health";

export type HostedProviderId = "anthropic" | "openrouter" | "openai";
export type HostedModelPreference =
  | "governed"
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-1-20250805"
  | "gpt-5.6-terra"
  | "gpt-5.6-sol";
type HostedModelCatalogEntry = {
  id: Exclude<HostedModelPreference, "governed">;
  displayName: string;
  providerRuntime: string;
};
export type RuntimeSnapshot = {
  revision: number;
  settings: {
    hostedProvider: HostedProviderId;
    hostedModel: HostedModelPreference;
    localRuntime: "openai-compatible";
    localBaseUrl: string;
    localModelTag: string;
    localModelDigest: string | null;
    hostedCallsEnabled: boolean;
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
type HostedCanaryStatus = "connected" | "invalid-key" | "unreachable" | "error";
type LocalRuntimeStatus = {
  runtime: "openai-compatible";
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

export function useSettingsController(initialWorkspaceId: string) {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [secret, setSecret] = useState("");
  const [secretRevision, setSecretRevision] = useState(0);
  const [secretProvider, setSecretProvider] = useState("anthropic");
  const [credentialTest, setCredentialTest] = useState<CredentialTestStamp | null>(null);
  const [connectProviderId, setConnectProviderId] = useState<HostedProviderId | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalRuntimeStatus | null>(null);
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
      const [runtimeResult, providerResult, credentialResult] = await Promise.all([
        json<RuntimeSnapshot>("/api/settings/settings/runtime"),
        json<{ providers: ProviderCatalogEntry[] }>("/api/settings/settings/providers"),
        json<{ credentials: Credential[] }>("/api/settings/settings/credentials"),
      ]);
      setRuntime(runtimeResult);
      setProviders(providerResult.providers);
      setCredentials(credentialResult.credentials);
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
        message: "Local AI · Not connected.",
      });
    });
  }, [refresh, refreshLocalStatus]);

  const mutableLocalModel =
    runtime !== null && /(^|[:@])latest$/i.test(runtime.settings.localModelTag.trim());
  const hostedProviderOptions = providers.filter(
    (provider): provider is ProviderCatalogEntry & { id: HostedProviderId } =>
      provider.category === "ai" &&
      provider.routingReady &&
      (provider.id === "anthropic" || provider.id === "openrouter" || provider.id === "openai"),
  );
  const credentialProviderOptions = providers.filter((provider) => provider.credentialReady);
  const activeHostedProvider =
    runtime === null
      ? null
      : (hostedProviderOptions.find(
          (provider) => provider.id === runtime.settings.hostedProvider,
        ) ?? null);
  const activeHostedModels = activeHostedProvider?.hostedModels ?? [];
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

  async function saveRuntime() {
    if (runtime === null || !beginAction("runtime")) return;
    const requestedHosted = runtime.settings.hostedCallsEnabled;
    setStatus("Saving runtime settings…");
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
          `Runtime revision ${String(result.revision)} saved. Hosted remains OFF because the operator gate is closed.`,
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
    setStatus(`Testing ${selectedProviderOption.displayName} credential without saving…`);
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

  async function activateStoredProvider(provider: HostedProviderId): Promise<void> {
    if (runtime === null || !beginAction("activate-provider")) return;
    setStatus(`Activating ${provider}…`);
    try {
      const result = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hostedProvider: provider,
          hostedModel: "governed",
          hostedCallsEnabled: true,
          defaultChatTarget: "hosted",
        }),
      });
      setRuntime(result);
      setHostedHealth(null);
      setStatus(
        result.settings.hostedCallsEnabled
          ? "Provider aktif. Jalankan test provider bila ingin memverifikasi koneksi saat ini."
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
    setStatus("Saving default provider/model…");
    try {
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
    setStatus("Encrypting credential…");
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
        const activated = await json<RuntimeSnapshot>("/api/settings/settings/runtime", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hostedProvider: provider,
            hostedModel: "governed",
            hostedCallsEnabled: true,
            defaultChatTarget: "hosted",
          }),
        });
        setRuntime(activated);
        setHostedHealth(
          activated.settings.hostedCallsEnabled ? { provider, status: "connected" } : null,
        );
        setConnectProviderId(null);
        setStatus(
          activated.settings.hostedCallsEnabled
            ? "API key terverifikasi, terenkripsi di Connect Vault, dan provider sudah aktif."
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
    setStatus("Removing credential…");
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
    setStatus(target === "local" ? "Running local canary…" : "Running hosted canary…");
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
      // menyatakan digest tapi runtime tidak bisa mengonfirmasinya — itu bukan PINNED.
      const provenance =
        result.modelIdentityProvenance === undefined
          ? ""
          : ` (${result.modelIdentityProvenance})`;
      setStatus(
        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms · identity ${result.modelIdentityPinned ? "PINNED" : "UNPINNED"}${provenance}`,
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
    setStatus("Checking Local AI configuration before saving…");
    try {
      const discovered = await json<LocalRuntimeStatus>(
        "/api/settings/settings/local-runtime/status",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            localRuntime: "openai-compatible",
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
          localRuntime: "openai-compatible",
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
    setStatus("Checking Local AI…");
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
    setStatus("Validating and saving MCP server…");
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
    mcpJson,
    mcpLoading,
    mutableLocalModel,
    pendingAction,
    providerViews,
    refreshMcp,
    removeCredential,
    runCanary,
    runtime,
    saveCredential,
    saveDefaultProviderModel,
    saveLocalSetup,
    saveMcpServer,
    saveRuntime,
    secret,
    secretProvider,
    selectedCredential,
    selectedProviderHealth,
    selectedProviderOption,
    servers,
    setConnectProviderId,
    setCredentialTest,
    setHostedHealth,
    setLocalSetupOpen,
    setLocalStatus,
    setMcpJson,
    setRuntime,
    setSecret,
    setSecretProvider,
    setSecretRevision,
    setStatus,
    setWorkspaceId,
    status,
    testCredential,
    workspaceId,
    workspaceIdRef,
  };
}
