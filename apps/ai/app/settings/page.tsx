"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientResponseError, readJson } from "../../lib/client-response";
import { credentialSaveReady, type CredentialTestStamp } from "../../lib/credential-onboarding";
import { canaryStatusFromErrorCode, providerHealth } from "../../lib/provider-health";
import styles from "./Settings.module.css";

type HostedProviderId = "anthropic" | "openrouter" | "openai";
type HostedModelPreference =
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
type RuntimeSnapshot = {
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
type McpServer = {
  id: string;
  displayName: string;
  enabled: boolean;
  workspaceIds: string[];
  transport: unknown;
  toolPolicies: unknown[];
};

const PERSONAL_WORKSPACE_ID = "ws_personal";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  return readJson<T>(response);
}

export default function SettingsPage() {
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workspaceId, setWorkspaceId] = useState(PERSONAL_WORKSPACE_ID);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [secret, setSecret] = useState("");
  const [secretRevision, setSecretRevision] = useState(0);
  const [secretProvider, setSecretProvider] = useState("anthropic");
  const [credentialTest, setCredentialTest] = useState<CredentialTestStamp | null>(null);
  const [connectProviderId, setConnectProviderId] = useState<HostedProviderId | null>(null);
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

  useEffect(() => void refresh(), [refresh]);

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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>AI & Connections</h1>
          <p>
            Hubungkan provider, pilih model default, lalu gunakan Ai tanpa perlu mengatur vault
            atau runtime secara manual.
          </p>
        </div>
      </header>

      {status ? (
        <p className={styles.status} aria-live="polite" role="status">
          {status}
        </p>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>AI Providers</h2>
            <p className={styles.muted}>
              API key diuji dulu, lalu disimpan terenkripsi di Connect Vault. Plaintext tidak
              dikembalikan ke Ai.
            </p>
          </div>
        </div>

        <div className={styles.providerGrid}>
          {providerViews.map(({ provider, credential, active, health }) => (
            <article className={styles.providerCard} key={provider.id}>
              <div className={styles.providerCardTop}>
                <div>
                  <strong>{provider.displayName}</strong>
                  <span className={styles.providerMeta}>
                    {provider.hostedModels.length} verified model
                    {provider.hostedModels.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className={active ? styles.activeBadge : styles.statusBadge}>
                  {active
                    ? "Active"
                    : health.status === "connected"
                      ? "Connected"
                      : "Available"}
                </span>
              </div>
              <p className={styles.providerStatus}>{health.label}</p>
              <div className={styles.actions}>
                {credential === null ? (
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => beginProviderConnect(provider.id)}
                  >
                    Connect
                  </button>
                ) : active ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={pendingAction !== null || !runtime?.settings.hostedCallsEnabled}
                    onClick={() => void runCanary("hosted")}
                  >
                    {pendingAction === "canary-hosted" ? "Testing…" : "Test connection"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => void activateStoredProvider(provider.id)}
                    >
                      {pendingAction === "activate-provider" ? "Activating…" : "Use provider"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={pendingAction !== null}
                      onClick={() => beginProviderConnect(provider.id)}
                    >
                      Replace key
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}

          <article className={styles.providerCard}>
            <div className={styles.providerCardTop}>
              <div>
                <strong>Local AI</strong>
                <span className={styles.providerMeta}>OpenAI-compatible runtime</span>
              </div>
              <span className={styles.statusBadge}>Optional</span>
            </div>
            <p className={styles.providerStatus}>
              Local runtime tetap opsional. Tidak ada fallback diam-diam dari hosted ke local.
            </p>
            <a className={styles.linkButton} href="#advanced-settings">
              Advanced setup
            </a>
          </article>
        </div>

        {connectProvider !== null ? (
          <div className={styles.connectPanel}>
            <div className={styles.connectPanelHeader}>
              <div>
                <span className={styles.eyebrow}>Connect provider</span>
                <h3>{connectProvider.displayName}</h3>
              </div>
              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null}
                onClick={() => {
                  setConnectProviderId(null);
                  setSecret("");
                  setCredentialTest(null);
                  setStatus("");
                }}
              >
                Cancel
              </button>
            </div>
            <label className={styles.connectField}>
              API key
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Paste API key"
                value={secret}
                disabled={pendingAction !== null}
                onChange={(event) => {
                  setSecret(event.target.value);
                  setSecretRevision((current) => current + 1);
                  setCredentialTest(null);
                }}
              />
            </label>
            <div className={styles.connectSteps}>
              <span className={credentialTestPassed ? styles.stepDone : styles.step}>
                1. Test key
              </span>
              <span className={credentialTestPassed ? styles.step : styles.stepMuted}>
                2. Encrypt, save & activate
              </span>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={
                  secret.length === 0 ||
                  pendingAction !== null ||
                  !connectProvider.connectionTestReady
                }
                onClick={() => void testCredential()}
              >
                {pendingAction === "test-credential" ? "Testing…" : "Test API key"}
              </button>
              <button
                type="button"
                disabled={!credentialReadyToSave || pendingAction !== null}
                onClick={() => void saveCredential()}
              >
                {pendingAction === "credential" ? "Saving…" : "Save & activate"}
              </button>
            </div>
            <p className={styles.muted}>
              {credentialTestPassed
                ? "Test PASS. Key belum disimpan sampai Save & activate ditekan."
                : "Test memakai real provider call tanpa menyimpan plaintext."}
            </p>
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Default provider & model</h2>
            <p className={styles.muted}>
              Pilih model verified untuk chat hosted, atau gunakan Governed / Recommended agar
              ECORIONE memilih pinned model sesuai policy.
            </p>
          </div>
        </div>

        {runtime === null ? (
          <p className={styles.muted}>Runtime state is loading.</p>
        ) : (
          <div className={styles.defaultModelPanel}>
            <label>
              Provider
              <select
                value={runtime.settings.hostedProvider}
                disabled={pendingAction !== null}
                onChange={(event) => {
                  const provider = event.target.value as HostedProviderId;
                  setHostedHealth(null);
                  setRuntime({
                    ...runtime,
                    settings: {
                      ...runtime.settings,
                      hostedProvider: provider,
                      hostedModel: "governed",
                    },
                  });
                }}
              >
                {hostedProviderOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                value={runtime.settings.hostedModel}
                disabled={pendingAction !== null}
                onChange={(event) =>
                  setRuntime({
                    ...runtime,
                    settings: {
                      ...runtime.settings,
                      hostedModel: event.target.value as HostedModelPreference,
                    },
                  })
                }
              >
                <option value="governed">Governed / Recommended</option>
                {activeHostedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.defaultModelSummary}>
              <strong>
                {runtime.settings.hostedModel === "governed"
                  ? "Governed / Recommended"
                  : (activeHostedModels.find(
                      (model) => model.id === runtime.settings.hostedModel,
                    )?.displayName ?? runtime.settings.hostedModel)}
              </strong>
              <span>
                {runtime.settings.hostedModel === "governed"
                  ? "Policy dapat memilih pinned model yang sesuai sensitivity dan evidence."
                  : "Pilihan ini dipakai untuk hosted chat normal. RESTRICTED tetap boleh di-override oleh policy."}
              </span>
            </div>
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => void saveDefaultProviderModel()}
            >
              {pendingAction === "default-provider-model" ? "Saving…" : "Save default"}
            </button>
          </div>
        )}
      </section>

      <details className={styles.advanced} id="advanced-settings">
        <summary>Advanced settings</summary>
        <div className={styles.advancedBody}>
          <section className={styles.advancedSection}>
            <h2>Runtime</h2>
            {runtime === null ? (
              <p className={styles.muted}>Runtime state is loading.</p>
            ) : (
              <div className={styles.formGrid}>
                <label>
                  Default AI route
                  <select
                    value={runtime.settings.defaultChatTarget}
                    disabled={pendingAction !== null}
                    onChange={(event) =>
                      setRuntime({
                        ...runtime,
                        settings: {
                          ...runtime.settings,
                          defaultChatTarget: event.target
                            .value as RuntimeSnapshot["settings"]["defaultChatTarget"],
                        },
                      })
                    }
                  >
                    <option value="local">Local AI</option>
                    <option value="hosted" disabled={!runtime.settings.hostedCallsEnabled}>
                      Hosted AI
                    </option>
                  </select>
                </label>
                <label>
                  Local model
                  <input
                    value={runtime.settings.localModelTag}
                    disabled={pendingAction !== null}
                    onChange={(event) =>
                      setRuntime({
                        ...runtime,
                        settings: {
                          ...runtime.settings,
                          localModelTag: event.target.value,
                          localModelDigest: null,
                        },
                      })
                    }
                  />
                </label>
                <label className={styles.wide}>
                  Local model SHA-256
                  <input
                    placeholder="sha256:64-hex"
                    value={runtime.settings.localModelDigest ?? ""}
                    disabled={pendingAction !== null}
                    onChange={(event) =>
                      setRuntime({
                        ...runtime,
                        settings: {
                          ...runtime.settings,
                          localModelDigest:
                            event.target.value.trim().length === 0 ? null : event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className={styles.wide}>
                  Local base URL
                  <input
                    value={runtime.settings.localBaseUrl}
                    disabled={pendingAction !== null}
                    onChange={(event) =>
                      setRuntime({
                        ...runtime,
                        settings: {
                          ...runtime.settings,
                          localBaseUrl: event.target.value,
                          localModelDigest: null,
                        },
                      })
                    }
                  />
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={runtime.settings.hostedCallsEnabled}
                    disabled={pendingAction !== null}
                    onChange={(event) => {
                      setHostedHealth(null);
                      setRuntime({
                        ...runtime,
                        settings: {
                          ...runtime.settings,
                          hostedCallsEnabled: event.target.checked,
                          defaultChatTarget: event.target.checked
                            ? runtime.settings.defaultChatTarget
                            : "local",
                        },
                      });
                    }}
                  />
                  Hosted calls enabled
                </label>
                {mutableLocalModel ? (
                  <p className={`${styles.warning} ${styles.wide}`}>
                    Local model memakai alias mutable{" "}
                    <code>{runtime.settings.localModelTag}</code>. Cocok untuk rehearsal, belum
                    immutable production identity.
                  </p>
                ) : null}
                {runtime.settings.localModelDigest === null ? (
                  <p className={`${styles.warning} ${styles.wide}`}>
                    Local model identity belum dipin dengan SHA-256. Exact-cache lokal dan
                    durable evidence tidak dianggap reproducible.
                  </p>
                ) : (
                  <p className={`${styles.muted} ${styles.wide}`}>
                    Local model identity dipin ke{" "}
                    <code>{runtime.settings.localModelDigest}</code>.
                  </p>
                )}
                <p className={`${styles.muted} ${styles.wide}`}>
                  Operator kill switch selalu menang. Setting UI tidak dapat membuka gate proses
                  yang ditutup operator.
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void saveRuntime()}
                  >
                    {pendingAction === "runtime" ? "Saving…" : "Save runtime"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={pendingAction !== null}
                    onClick={() => void runCanary("local")}
                  >
                    {pendingAction === "canary-local" ? "Running…" : "Test local runtime"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={pendingAction !== null || !runtime.settings.hostedCallsEnabled}
                    onClick={() => void runCanary("hosted")}
                  >
                    {pendingAction === "canary-hosted" ? "Running…" : "Test hosted provider"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles.advancedSection}>
            <h2>Credential vault</h2>
            <p className={styles.muted}>
              Advanced credential management for integrations and manual replacement/removal.
            </p>
            <div className={styles.inline}>
              <select
                aria-label="Credential provider"
                value={secretProvider}
                disabled={pendingAction !== null}
                onChange={(event) => {
                  setSecretProvider(event.target.value);
                  setSecret("");
                  setSecretRevision((current) => current + 1);
                  setCredentialTest(null);
                  setHostedHealth(null);
                }}
              >
                {credentialProviderOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.displayName}
                  </option>
                ))}
              </select>
              <input
                type="password"
                autoComplete="new-password"
                placeholder={selectedCredential === null ? "New secret" : "Replace secret"}
                aria-label="New credential secret"
                value={secret}
                disabled={pendingAction !== null}
                onChange={(event) => {
                  setSecret(event.target.value);
                  setSecretRevision((current) => current + 1);
                  setCredentialTest(null);
                }}
              />
              <button
                type="button"
                className={styles.secondary}
                disabled={
                  secret.length === 0 ||
                  pendingAction !== null ||
                  !selectedProviderOption?.connectionTestReady
                }
                onClick={() => void testCredential()}
              >
                {pendingAction === "test-credential" ? "Testing…" : "Test key"}
              </button>
              <button
                type="button"
                disabled={!credentialReadyToSave || pendingAction !== null}
                onClick={() => void saveCredential()}
              >
                {pendingAction === "credential" ? "Saving…" : "Encrypt & save"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={selectedCredential === null || pendingAction !== null}
                onClick={() => void removeCredential()}
              >
                {pendingAction === "remove-credential" ? "Removing…" : "Remove"}
              </button>
            </div>
            <p className={styles.muted}>
              {selectedProviderHealth.label}
              {selectedCredential === null
                ? ""
                : ` generation ${String(selectedCredential.generation)} · updated ${selectedCredential.updatedAt}.`}
            </p>
          </section>

          <section className={styles.advancedSection}>
            <h2>MCP servers</h2>
            <div className={styles.inline}>
              <input
                aria-label="MCP workspace id"
                value={workspaceId}
                disabled={mcpLoading || pendingAction !== null}
                onChange={(event) => {
                  workspaceIdRef.current = event.target.value;
                  setWorkspaceId(event.target.value);
                }}
              />
              <button
                type="button"
                className={styles.secondary}
                disabled={mcpLoading || pendingAction !== null}
                onClick={() => void refreshMcp()}
              >
                {mcpLoading ? "Loading…" : "Load workspace"}
              </button>
            </div>
            <div className={styles.serverList}>
              {servers.map((server) => (
                <button
                  type="button"
                  className={styles.server}
                  key={server.id}
                  onClick={() => setMcpJson(JSON.stringify(server, null, 2))}
                >
                  <strong>{server.displayName}</strong>
                  <span>
                    {server.enabled ? "enabled" : "disabled"} · {server.id}
                  </span>
                </button>
              ))}
            </div>
            <textarea
              rows={12}
              spellCheck={false}
              value={mcpJson}
              disabled={pendingAction !== null}
              onChange={(event) => setMcpJson(event.target.value)}
              aria-label="MCP server JSON"
              placeholder='{"id":"example","displayName":"Example","enabled":false,"workspaceIds":["ws_personal"],"transport":{"type":"streamable-http","url":"https://example.com/mcp"},"toolPolicies":[]}'
            />
            <div className={styles.actions}>
              <button
                type="button"
                disabled={mcpJson.trim().length === 0 || pendingAction !== null}
                onClick={() => void saveMcpServer()}
              >
                {pendingAction === "mcp" ? "Saving…" : "Validate & save MCP server"}
              </button>
            </div>
            <p className={styles.muted}>
              Saving a server does not grant node/tool authority. Hub governance remains a
              separate execution gate.
            </p>
          </section>
        </div>
      </details>
    </main>
  );
}
