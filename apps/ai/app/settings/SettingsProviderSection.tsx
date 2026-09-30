"use client";

import styles from "./Settings.module.css";
import type { RuntimeSnapshot, SettingsController } from "./useSettingsController";

export function SettingsProviderSection({ controller }: { controller: SettingsController }) {
  const {
    activateStoredProvider,
    beginProviderConnect,
    checkLocalStatus,
    connectProvider,
    credentialReadyToSave,
    credentialTestPassed,
    localSetupOpen,
    localStatus,
    openRouterPreferenceRequiresExecution,
    pendingAction,
    providerViews,
    removeCredentialConnection,
    runCanary,
    runtime,
    saveCredential,
    saveLocalSetup,
    saveSpendPolicy,
    secret,
    spendDraft,
    spendStatus,
    setConnectProviderId,
    setCredentialTest,
    setHostedHealth,
    setLocalSetupOpen,
    setLocalStatus,
    setRuntime,
    setSecret,
    setSecretRevision,
    setSpendDraft,
    setStatus,
    status,
    testCredential,
    updateCredentialConnection,
  } = controller;

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
        {providerViews.map(({ provider, credential, credentials, active, health }) => {
          const minimumPriority =
            credentials.length === 0
              ? 100
              : Math.min(...credentials.map((connection) => connection.priority));
          return (
          <article className={styles.providerCard} key={provider.id}>
            <div className={styles.providerCardTop}>
              <div>
                <strong>{provider.displayName}</strong>
                <span className={styles.providerMeta}>
                  {provider.hostedModels.length} verified model
                  {provider.hostedModels.length === 1 ? "" : "s"} · {credentials.length} API key
                  {credentials.length === 1 ? "" : "s"}
                </span>
              </div>
              <span className={active ? styles.activeBadge : styles.statusBadge}>
                {active ? "Active" : health.status === "connected" ? "Connected" : "Available"}
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
                    Add API key
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
                    Add API key
                  </button>
                </>
              )}
            </div>
            {credentials.length > 0 ? (
              <div className={styles.connectionList} aria-label={`${provider.displayName} AI Connections`}>
                {credentials.map((connection, index) => (
                  <div className={styles.connectionRow} key={connection.connectionId}>
                    <div className={styles.connectionIdentity}>
                      <strong>{connection.label}</strong>
                      <span>
                        {index === 0 && connection.enabled ? "Primary · " : ""}
                        priority {connection.priority} · {connection.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                    <div className={styles.connectionActions}>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          void updateCredentialConnection(provider.id, connection.connectionId, {
                            enabled: !connection.enabled,
                          })
                        }
                      >
                        {connection.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={
                          pendingAction !== null ||
                          connection.priority <= minimumPriority
                        }
                        onClick={() =>
                          void updateCredentialConnection(provider.id, connection.connectionId, {
                            priority: Math.max(0, minimumPriority - 100),
                          })
                        }
                      >
                        Make primary
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={pendingAction !== null}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${connection.label} from ${provider.displayName}?`,
                            )
                          ) {
                            void removeCredentialConnection(
                              provider.id,
                              connection.connectionId,
                            );
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
        })}

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
                Angka ini tersimpan lokal dan langsung dipakai untuk semua panggilan AI hosted.
              </p>
            </div>
            <span className={cloudAiEnabled ? styles.activeBadge : styles.statusBadge}>
              {openRouterPreferenceRequiresExecution
                ? "Pilih model compatible"
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
                      defaultChatTarget: enabled ? runtime.settings.defaultChatTarget : "local",
                    },
                  });
                }}
              />
              <span>
                <strong>Aktifkan Cloud AI</strong>
                <small>
                  {openRouterPreferenceRequiresExecution
                    ? "Model OpenRouter yang dipilih belum punya trusted admission. Simpan model compatible atau pilih Recommended."
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
                <span className={styles.eyebrow}>AI Connection</span>
                <h3 id="connect-provider-title">
                  {providerViews.find((view) => view.provider.id === connectProvider.id)
                    ?.credentials.length
                    ? `Add API key · ${connectProvider.displayName}`
                    : `Connect ${connectProvider.displayName}`}
                </h3>
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
                ? "Test PASS. Key baru belum disimpan sampai Save & activate ditekan."
                : "Test memakai real provider call tanpa menyimpan plaintext. Provider yang sama boleh punya beberapa key."}
            </p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
