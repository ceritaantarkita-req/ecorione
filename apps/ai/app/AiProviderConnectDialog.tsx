"use client";

import type { ChatOnboardingProviderOption, HostedProviderId } from "../lib/chat-model-routing";
import type { AiProviderOnboardingFeedback as Feedback } from "./useAiProviderOnboarding";

export function AiProviderOnboardingFeedback({
  feedback,
}: {
  feedback: Feedback | null;
}) {
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
  open,
  providers,
  providerId,
  secret,
  pending,
  status,
  onProviderChange,
  onSecretChange,
  onConnect,
  onClose,
}: {
  open: boolean;
  providers: readonly ChatOnboardingProviderOption[];
  providerId: HostedProviderId | null;
  secret: string;
  pending: boolean;
  status: string | null;
  onProviderChange: (provider: HostedProviderId) => void;
  onSecretChange: (secret: string) => void;
  onConnect: () => void;
  onClose: () => void;
}) {
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
            onChange={(event) => onProviderChange(event.target.value as HostedProviderId)}
          >
            <option value="" disabled>
              Pilih provider
            </option>
            {providers.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
                disabled={provider.connected || !provider.connectReady}
              >
                {provider.displayName}
                {provider.connected
                  ? " · Sudah terhubung"
                  : !provider.connectReady
                    ? " · Belum tersedia"
                    : ""}
              </option>
            ))}
            <option value="__other__" disabled>
              Lainnya · Segera
            </option>
          </select>
        </label>

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
            disabled={pending || providerId === null || secret.length === 0}
            onClick={onConnect}
          >
            {pending ? "Menghubungkan…" : "Connect"}
          </button>
        </div>
      </section>
    </div>
  );
}
