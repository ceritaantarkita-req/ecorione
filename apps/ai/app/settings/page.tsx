"use client";

import { useWorkspace } from "../WorkspaceProvider";
import { HostedModelPicker } from "./HostedModelPicker";
import { OpenRouterDiscoveryPanel } from "./OpenRouterDiscoveryPanel";
import { SettingsProviderSection } from "./SettingsProviderSection";
import styles from "./Settings.module.css";
import { useSettingsController, type RuntimeSnapshot } from "./useSettingsController";

export default function SettingsPage() {
  const { workspaceId: activeWorkspaceId } = useWorkspace();
  const controller = useSettingsController(activeWorkspaceId);
  const {
    activeHostedModels,
    credentialProviderOptions,
    credentialReadyToSave,
    hostedProviderOptions,
    mcpJson,
    mcpLoading,
    mutableLocalModel,
    openRouterDiscovery,
    openRouterPickerModels,
    openRouterPreferenceRequiresExecution,
    openRouterQuery,
    openRouterSourceProvider,
    pendingAction,
    discoverOpenRouterModels,
    refreshMcp,
    removeCredential,
    runCanary,
    runtime,
    saveCredential,
    saveDefaultProviderModel,
    saveMcpServer,
    saveRuntime,
    secret,
    secretProvider,
    selectedCredential,
    selectedProviderHealth,
    selectedProviderOption,
    servers,
    setCredentialTest,
    setHostedHealth,
    setMcpJson,
    setOpenRouterQuery,
    setOpenRouterSourceProvider,
    setRuntime,
    setSecret,
    setSecretProvider,
    setSecretRevision,
    setWorkspaceId,
    status,
    testCredential,
    workspaceId,
    workspaceIdRef,
  } = controller;

  const statusIsWarning = /SPEND_BUDGET|spend budget|plafon spend|COST_KILL_SWITCH/i.test(
    status,
  );

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
        <p
          className={`${styles.status}${statusIsWarning ? ` ${styles.statusWarning}` : ""}`}
          aria-live="assertive"
          role="alert"
        >
          {status}
        </p>
      ) : null}

      <SettingsProviderSection controller={controller} />

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
          <HostedModelPicker
            runtime={runtime}
            hostedProviderOptions={hostedProviderOptions}
            activeHostedModels={activeHostedModels}
            openRouterPickerModels={openRouterPickerModels}
            pendingAction={pendingAction}
            onProviderChange={(provider) => {
              setHostedHealth(null);
              setRuntime({
                ...runtime,
                settings: {
                  ...runtime.settings,
                  hostedProvider: provider,
                  hostedModel: "governed",
                  ...(provider === "openrouter"
                    ? { openRouterModelSelection: "governed" }
                    : {}),
                },
              });
            }}
            onModelChange={(selected) => {
              const openRouterModel = openRouterPickerModels.find(
                (model) => model.id === selected,
              );
              const preferenceNeedsExecution =
                runtime.settings.hostedProvider === "openrouter" &&
                selected !== "governed" &&
                openRouterModel?.executable !== true;
              setRuntime({
                ...runtime,
                settings: {
                  ...runtime.settings,
                  ...(runtime.settings.hostedProvider === "openrouter"
                    ? {
                        openRouterModelSelection: selected,
                        ...(preferenceNeedsExecution
                          ? { hostedCallsEnabled: false, defaultChatTarget: "local" }
                          : {}),
                      }
                    : { hostedModel: selected }),
                },
              });
            }}
            onSave={() => void saveDefaultProviderModel()}
          />
        )}

        {runtime?.settings.hostedProvider === "openrouter" ? (
          <OpenRouterDiscoveryPanel
            discovery={openRouterDiscovery}
            query={openRouterQuery}
            sourceProvider={openRouterSourceProvider}
            pendingAction={pendingAction}
            onQueryChange={setOpenRouterQuery}
            onSourceProviderChange={setOpenRouterSourceProvider}
            onDiscover={(forceRefresh) => void discoverOpenRouterModels(forceRefresh)}
          />
        ) : null}
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
                    <option
                      value="hosted"
                      disabled={
                        !runtime.settings.hostedCallsEnabled ||
                        openRouterPreferenceRequiresExecution
                      }
                    >
                      Hosted AI
                    </option>
                  </select>
                </label>
                <label>
                  Local runtime
                  <select
                    value={runtime.settings.localRuntime}
                    disabled={pendingAction !== null}
                    onChange={(event) =>
                      setRuntime({
                        ...runtime,
                        settings: {
                          ...runtime.settings,
                          localRuntime: event.target
                            .value as RuntimeSnapshot["settings"]["localRuntime"],
                          localModelDigest: null,
                        },
                      })
                    }
                  >
                    <option value="ollama">Ollama native</option>
                    <option value="openai-compatible">OpenAI-compatible</option>
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
                    disabled={pendingAction !== null || openRouterPreferenceRequiresExecution}
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
                {openRouterPreferenceRequiresExecution ? (
                  <p className={`${styles.warning} ${styles.wide}`}>
                    Model OpenRouter yang dipilih belum punya trusted admission marker. Refresh
                    katalog atau pilih model lain sebelum mengaktifkan Hosted.
                  </p>
                ) : null}
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
                    disabled={
                      pendingAction !== null ||
                      !runtime.settings.hostedCallsEnabled ||
                      openRouterPreferenceRequiresExecution
                    }
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
                autoFocus
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
