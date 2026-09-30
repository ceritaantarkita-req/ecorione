"use client";

import { useWorkspace } from "../WorkspaceProvider";
import { HostedModelPicker } from "./HostedModelPicker";
import { OpenRouterDiscoveryPanel } from "./OpenRouterDiscoveryPanel";
import styles from "./Settings.module.css";
import { useSettingsController, type RuntimeSnapshot } from "./useSettingsController";

export default function SettingsPage() {
  const { workspaceId: activeWorkspaceId } = useWorkspace();
  const {
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
    openRouterDiscovery,
    openRouterPickerModels,
    openRouterPreferenceRequiresExecution,
    openRouterQuery,
    openRouterSourceProvider,
    pendingAction,
    discoverOpenRouterModels,
    validateOpenRouterModel,
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
    setMcpJson,
    setOpenRouterQuery,
    setOpenRouterSourceProvider,
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
  } = useSettingsController(activeWorkspaceId);

  const statusIsWarning = /SPEND_BUDGET|spend budget|plafon spend|COST_KILL_SWITCH/i.test(
    status,
  );
  const cloudAiEnabled =
    spendStatus?.operatorGateOpen === true &&
    runtime?.settings.hostedCallsEnabled === true &&
    !openRouterPreferenceRequiresExecution;

  const closeProviderConnect = () => {
    setConnectProviderId(null);
    setSecret("");
    setCredentialTest(null);
    setStatus("");
  };

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
                  <>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={pendingAction !== null || !runtime?.settings.hostedCallsEnabled}
                      onClick={() => void runCanary("hosted")}
                    >
                      {pendingAction === "canary-hosted" ? "Testing..." : "Test connection"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={pendingAction !== null}
                      onClick={() => beginProviderConnect(provider.id)}
                    >
                      Replace API key
                    </button>
                  </>
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
                <span className={styles.providerMeta}>
                  {runtime?.settings.localRuntime === "ollama"
                    ? "Ollama native runtime"
                    : "OpenAI-compatible runtime"}
                </span>
              </div>
              <span className={localStatus?.ready ? styles.activeBadge : styles.statusBadge}>
                {localStatus === null
                  ? "Checking…"
                  : localStatus.state === "connected"
                    ? "Connected"
                    : localStatus.state === "unreachable"
                      ? "Not connected"
                      : localStatus.state === "model-missing"
                        ? "Model missing"
                        : localStatus.state === "identity-mismatch"
                          ? "Identity mismatch"
                          : "Reachable"}
              </span>
            </div>
            <p className={styles.providerStatus}>
              {localStatus?.message ??
                "Checking the configured local endpoint without running inference…"}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={pendingAction !== null || runtime === null}
                onClick={() => setLocalSetupOpen(true)}
              >
                {localStatus?.ready ? "Manage" : "Set up"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null}
                onClick={() => void checkLocalStatus()}
              >
                {pendingAction === "local-discovery" ? "Checking…" : "Check again"}
              </button>
              {localStatus?.state === "connected" || localStatus?.state === "unsupported" ? (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={pendingAction !== null}
                  onClick={() => void runCanary("local")}
                >
                  {pendingAction === "canary-local" ? "Testing…" : "Test local runtime"}
                </button>
              ) : null}
            </div>
          </article>
        </div>
        {spendStatus && runtime ? (
          <section className={styles.spendPanel} aria-labelledby="cloud-budget-heading">
            <div className={styles.spendHeader}>
              <div>
                <span className={styles.eyebrow}>Cloud AI & Budget</span>
                <h3 id="cloud-budget-heading">Atur batas biaya</h3>
                <p>
                  Angka ini tersimpan lokal dan langsung dipakai untuk semua panggilan AI
                  hosted.
                </p>
              </div>
              <span className={cloudAiEnabled ? styles.activeBadge : styles.statusBadge}>
                {openRouterPreferenceRequiresExecution
                  ? "Pilih model Ready"
                  : cloudAiEnabled
                    ? "Cloud AI aktif"
                    : "Cloud AI mati"}
              </span>
            </div>

            <div className={styles.spendControls}>
              <label className={styles.spendToggle}>
                <input
                  type="checkbox"
                  checked={runtime.settings.hostedCallsEnabled}
                  disabled={pendingAction !== null || openRouterPreferenceRequiresExecution}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setHostedHealth(null);
                    setRuntime({
                      ...runtime,
                      settings: {
                        ...runtime.settings,
                        hostedCallsEnabled: enabled,
                        defaultChatTarget: enabled
                          ? runtime.settings.defaultChatTarget
                          : "local",
                      },
                    });
                  }}
                />
                <span>
                  <strong>Aktifkan Cloud AI</strong>
                  <small>
                    {openRouterPreferenceRequiresExecution
                      ? "Model OpenRouter yang dipilih baru preference. Pilih Recommended atau model Ready untuk mengaktifkan Cloud AI."
                      : "Matikan untuk memblokir semua pemakaian provider berbayar."}
                  </small>
                </span>
              </label>

              <label className={styles.spendField}>
                Budget harian (USD)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Contoh: 0.10"
                  value={spendDraft.dailyUsd}
                  disabled={pendingAction !== null || spendDraft.unlimited}
                  onChange={(event) =>
                    setSpendDraft((current) => ({ ...current, dailyUsd: event.target.value }))
                  }
                />
              </label>

              <label className={styles.spendField}>
                Budget bulanan (USD)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Contoh: 1.00"
                  value={spendDraft.monthlyUsd}
                  disabled={pendingAction !== null || spendDraft.unlimited}
                  onChange={(event) =>
                    setSpendDraft((current) => ({ ...current, monthlyUsd: event.target.value }))
                  }
                />
              </label>

              <label className={[styles.spendToggle, styles.spendUnlimited].join(" ")}>
                <input
                  type="checkbox"
                  checked={spendDraft.unlimited}
                  disabled={pendingAction !== null}
                  onChange={(event) => {
                    const unlimited = event.target.checked;
                    if (
                      unlimited &&
                      !window.confirm(
                        "Mode tanpa batas menonaktifkan plafon biaya harian dan bulanan. Lanjutkan?",
                      )
                    ) {
                      return;
                    }
                    setSpendDraft((current) => ({ ...current, unlimited }));
                  }}
                />
                <span>
                  <strong>Tanpa batas biaya</strong>
                  <small>
                    Berisiko. Budget harian dan bulanan tidak akan membatasi penggunaan.
                  </small>
                </span>
              </label>
            </div>

            <div className={styles.spendFooter}>
              <div className={styles.spendUsage}>
                {spendStatus.policy.unlimited ? (
                  <p>Mode tanpa batas sedang aktif.</p>
                ) : spendStatus.budget ? (
                  <p>
                    Terpakai hari ini {"$"}
                    {spendStatus.budget.dailyCommittedUsd.toFixed(4)} / {"$"}
                    {spendStatus.budget.dailyLimitUsd?.toFixed(2) ?? "—"} · bulan ini {"$"}
                    {spendStatus.budget.monthlyCommittedUsd.toFixed(4)} / {"$"}
                    {spendStatus.budget.monthlyLimitUsd?.toFixed(2) ?? "—"}
                  </p>
                ) : (
                  <p>Belum ada budget aktif. Cloud AI akan ditolak sampai budget disimpan.</p>
                )}
                <small>
                  Emergency kill switch milik operator sistem tetap menang dan tidak bisa dibuka
                  dari halaman ini.
                </small>
              </div>
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => void saveSpendPolicy()}
              >
                {pendingAction === "spend-policy" ? "Menyimpan..." : "Simpan pengaturan"}
              </button>
            </div>
          </section>
        ) : null}

        {localSetupOpen && runtime !== null ? (
          <div className={styles.connectPanel}>
            <div className={styles.connectPanelHeader}>
              <div>
                <span className={styles.eyebrow}>Local AI setup</span>
                <h3>
                  {runtime.settings.localRuntime === "ollama"
                    ? "Ollama native runtime"
                    : "OpenAI-compatible runtime"}
                </h3>
              </div>
              <button
                type="button"
                className={styles.secondary}
                disabled={pendingAction !== null}
                onClick={() => setLocalSetupOpen(false)}
              >
                Close
              </button>
            </div>
            <p className={styles.muted}>
              Pilih Ollama native untuk model yang membutuhkan kontrol thinking/output Ollama.
              Pilih OpenAI-compatible untuk LM Studio, llama.cpp, vLLM, atau runtime kompatibel
              lain.
            </p>
            <div className={styles.localSetupGrid}>
              <label className={styles.connectField}>
                Runtime
                <select
                  value={runtime.settings.localRuntime}
                  disabled={pendingAction !== null}
                  onChange={(event) => {
                    setLocalStatus(null);
                    setRuntime({
                      ...runtime,
                      settings: {
                        ...runtime.settings,
                        localRuntime: event.target
                          .value as RuntimeSnapshot["settings"]["localRuntime"],
                        localModelDigest: null,
                      },
                    });
                  }}
                >
                  <option value="ollama">Ollama (native API · recommended)</option>
                  <option value="openai-compatible">OpenAI-compatible</option>
                </select>
              </label>
              <label className={styles.connectField}>
                Endpoint
                <input
                  value={runtime.settings.localBaseUrl}
                  disabled={pendingAction !== null}
                  placeholder="http://127.0.0.1:11434/v1"
                  onChange={(event) => {
                    setLocalStatus(null);
                    setRuntime({
                      ...runtime,
                      settings: {
                        ...runtime.settings,
                        localBaseUrl: event.target.value,
                        localModelDigest: null,
                      },
                    });
                  }}
                />
              </label>
              <label className={styles.connectField}>
                Model
                <input
                  list="local-model-options"
                  value={runtime.settings.localModelTag}
                  disabled={pendingAction !== null}
                  placeholder="model-id"
                  onChange={(event) => {
                    setLocalStatus(null);
                    setRuntime({
                      ...runtime,
                      settings: {
                        ...runtime.settings,
                        localModelTag: event.target.value,
                        localModelDigest: null,
                      },
                    });
                  }}
                />
                <datalist id="local-model-options">
                  {(localStatus?.models ?? []).map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={
                  pendingAction !== null ||
                  runtime.settings.localBaseUrl.trim().length === 0 ||
                  runtime.settings.localModelTag.trim().length === 0
                }
                onClick={() => void saveLocalSetup()}
              >
                {pendingAction === "local-setup" ? "Saving & checking…" : "Save & check"}
              </button>
              <a className={styles.linkButton} href="#advanced-settings">
                Advanced identity settings
              </a>
            </div>
            <p className={styles.muted}>
              Discovery checks the selected runtime model catalog without running inference. If
              the runtime also exposes verifiable model identity, ECORIONE can pin the digest
              automatically. An explicit canary remains separate.
            </p>
          </div>
        ) : null}

        {connectProvider !== null ? (
          <div
            className={styles.connectOverlay}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && pendingAction === null)
                closeProviderConnect();
            }}
          >
            <section
              className={`${styles.connectPanel} ${styles.connectDialog}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="connect-provider-title"
              onKeyDown={(event) => {
                if (event.key === "Escape" && pendingAction === null) closeProviderConnect();
              }}
            >
              <div className={styles.connectPanelHeader}>
                <div>
                  <span className={styles.eyebrow}>Connect provider</span>
                  <h3 id="connect-provider-title">Connect {connectProvider.displayName}</h3>
                </div>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={pendingAction !== null}
                  onClick={closeProviderConnect}
                >
                  Cancel
                </button>
              </div>
              {status ? (
                <p
                  className={`${styles.dialogStatus}${statusIsWarning ? ` ${styles.statusWarning}` : ""}`}
                  aria-live="assertive"
                  role="alert"
                >
                  {status}
                </p>
              ) : null}
              <label className={styles.connectField}>
                API key
                <input
                  type="password"
                  autoComplete="new-password"
                  autoFocus
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
            </section>
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
            onValidate={(selectionId) => void validateOpenRouterModel(selectionId)}
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
                    Model OpenRouter yang dipilih masih preference dan belum executable. Pilih
                    Recommended atau model Ready sebelum mengaktifkan Hosted.
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
