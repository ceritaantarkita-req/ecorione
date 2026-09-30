"use client";

import type { HostedProviderId } from "../lib/chat-model-routing";
import type {
  AiProviderOnboardingController,
  AiProviderOnboardingFeedback as Feedback,
} from "./useAiProviderOnboarding";

export function AiProviderOnboardingFeedback({ feedback }: { feedback: Feedback | null }) {
  if (feedback === null) return null;
  return (
    <p
      className={`ai-model-switch-status ai-model-switch-status--${feedback.kind}`}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

export function AiProviderConnectDialog({
  controller,
  onConnect,
}: {
  controller: AiProviderOnboardingController;
  onConnect: () => void;
}) {
  const {
    open,
    providerId,
    secret,
    customName,
    customBaseUrl,
    customModel,
    customInputUsdPerMTok,
    customOutputUsdPerMTok,
    pending,
    dialogStatus: status,
    closeDialog: onClose,
    setProviderId: onProviderChange,
    setSecret: onSecretChange,
    setCustomName,
    setCustomBaseUrl,
    setCustomModel,
    setCustomInputUsdPerMTok,
    setCustomOutputUsdPerMTok,
  } = controller;

  if (!open) return null;

  return (
    <div
      className="ai-connect-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        className="ai-connect-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-connect-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) onClose();
        }}
      >
        <div className="ai-connect-dialog__header">
          <div>
            <span className="ai-connect-dialog__eyebrow">AI Connection</span>
            <h2 id="ai-connect-title">Tambah AI</h2>
          </div>
          <button
            type="button"
            className="ecr-btn ecr-btn--secondary"
            disabled={pending}
            onClick={onClose}
          >
            Batal
          </button>
        </div>

        <p className="ai-connect-dialog__copy">
          Hubungkan provider tanpa meninggalkan percakapan. Connect akan memvalidasi API key
          sebelum menyimpannya terenkripsi melalui Connect Vault.
        </p>

        <label className="ai-connect-dialog__field">
          Provider
          <select
            aria-label="Provider AI baru"
            value={providerId ?? ""}
            disabled={pending}
            onChange={(event) =>
              onProviderChange(event.target.value as HostedProviderId | "__other__")
            }
          >
            <option value="" disabled>
              Pilih provider
            </option>
            {controller.providers.map((provider) => (
              <option key={provider.id} value={provider.id} disabled={!provider.connectReady}>
                {provider.displayName}
                {!provider.connectReady
                  ? " · Belum tersedia"
                  : provider.connectionCount > 0
                    ? ` · ${String(provider.connectionCount)} key · Tambah lagi`
                    : ""}
              </option>
            ))}
            <option value="__other__">Lainnya / Custom OpenAI-compatible</option>
          </select>
        </label>

        {providerId === "__other__" ? (
          <>
            <label className="ai-connect-dialog__field">
              Name
              <input
                type="text"
                aria-label="Nama custom provider"
                placeholder="Contoh: Provider kantor"
                value={customName}
                disabled={pending}
                onChange={(event) => setCustomName(event.target.value)}
              />
            </label>
            <label className="ai-connect-dialog__field">
              Base URL
              <input
                type="url"
                aria-label="Base URL custom provider"
                placeholder="https://api.example.com/v1"
                value={customBaseUrl}
                disabled={pending}
                onChange={(event) => setCustomBaseUrl(event.target.value)}
              />
            </label>
            <label className="ai-connect-dialog__field">
              Model
              <input
                type="text"
                aria-label="Model custom provider"
                placeholder="model-id"
                value={customModel}
                disabled={pending}
                onChange={(event) => setCustomModel(event.target.value)}
              />
            </label>
            <label className="ai-connect-dialog__field">
              Input USD / 1M token
              <input
                type="number"
                min="0"
                step="0.000001"
                aria-label="Harga input custom provider"
                value={customInputUsdPerMTok}
                disabled={pending}
                onChange={(event) => setCustomInputUsdPerMTok(event.target.value)}
              />
            </label>
            <label className="ai-connect-dialog__field">
              Output USD / 1M token
              <input
                type="number"
                min="0"
                step="0.000001"
                aria-label="Harga output custom provider"
                value={customOutputUsdPerMTok}
                disabled={pending}
                onChange={(event) => setCustomOutputUsdPerMTok(event.target.value)}
              />
            </label>
            <small className="ai-connect-dialog__copy">
              Custom provider harus memakai public HTTPS. Connect memvalidasi endpoint, DNS,
              credential, model, dan pricing sebelum aktivasi.
            </small>
          </>
        ) : null}

        <label className="ai-connect-dialog__field">
          API key
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            aria-label="API key provider"
            placeholder="Paste API key"
            value={secret}
            disabled={pending || providerId === null}
            onChange={(event) => onSecretChange(event.target.value)}
          />
        </label>

        {status !== null ? (
          <p className="ai-connect-dialog__status" role="alert">
            {status}
          </p>
        ) : null}

        <div className="ai-connect-dialog__footer">
          <small>
            Plaintext API key tidak dikembalikan ke Ai. Penggantian key dan pengaturan lanjutan
            tetap tersedia di Settings.
          </small>
          <button
            type="button"
            className="ecr-btn ecr-btn--primary"
            disabled={
              pending ||
              providerId === null ||
              secret.length === 0 ||
              (providerId === "__other__" &&
                (customName.trim().length === 0 ||
                  customBaseUrl.trim().length === 0 ||
                  customModel.trim().length === 0))
            }
            onClick={onConnect}
          >
            {pending ? "Menghubungkan…" : "Connect"}
          </button>
        </div>
      </section>
    </div>
  );
}
