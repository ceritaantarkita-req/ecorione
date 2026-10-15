"use client";

import { useState } from "react";
import styles from "./Projects.module.css";

const FAILURE_LABELS = {
  LOCAL_MODEL_ERROR: "Model ekstraksi lokal gagal atau tidak merespons.",
  INVALID_JSON: "Model lokal tidak menghasilkan JSON valid.",
  INVALID_SCHEMA: "Struktur JSON fakta tidak sesuai format.",
  SOURCE_EPISODE_REQUIRED: "Fakta tidak mencantumkan referensi episode.",
  SOURCE_EPISODE_UNKNOWN: "Referensi episode dari model tidak cocok.",
  SOURCE_EPISODE_UNTRUSTED: "Fakta tidak berasal dari pesan pengguna.",
  PROMOTION_REJECTED: "Penyimpanan fakta ditolak oleh validasi.",
  UNEXPECTED_FAILURE: "Proses konsolidasi mengalami gangguan internal.",
} as const;

type MemoryHealth = {
  projectId: string;
  pendingEpisodes: number;
  consolidatedEpisodes: number;
  savedFacts: number;
  localOnlyFacts: number;
  cloudEligibleFacts: number;
  processing: boolean;
  queued: boolean;
  lastAttempt: "unknown" | "failed" | "complete";
  lastFailureCodes?: readonly (keyof typeof FAILURE_LABELS)[];
};

export function ProjectMemoryStatus({
  projectId,
  workspaceId,
}: {
  readonly projectId: string;
  readonly workspaceId: string;
}): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<MemoryHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(signal?: AbortSignal): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams({ workspaceId, projectId });
      const response = await fetch(`/api/projects/memory-status?${query.toString()}`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("Status Memory tidak bisa diambil.");
      const body = (await response.json()) as MemoryHealth;
      if (body.projectId !== projectId) throw new Error("Respons Project tidak cocok.");
      if (!signal?.aborted) setSnapshot(body);
    } catch {
      if (!signal?.aborted) {
        setSnapshot(null);
        setError("Status Memory belum tersedia. Riwayat chat tetap terpisah dari Memory L1.");
      }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }

  const state =
    snapshot === null
      ? "Belum diperiksa"
      : snapshot.processing
        ? "Processing"
        : snapshot.lastAttempt === "failed"
          ? "Failed — retry pending"
          : snapshot.pendingEpisodes > 0
            ? "Pending"
            : snapshot.savedFacts > 0
              ? "Saved"
              : "Belum ada fakta";

  return (
    <section className={styles.memoryStatus} aria-label="Status Project Memory">
      <div className={styles.memoryStatusHeader}>
        <div>
          <h3>Project Memory</h3>
          <p>Diagnostik penyimpanan, bukan sekadar Memory yang dipakai dalam satu balasan.</p>
        </div>
        <button
          type="button"
          className="ecr-btn ecr-btn--secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Memeriksa..." : "Periksa / Refresh"}
        </button>
      </div>
      <p className={styles.memoryStatusState}>
        Status: <strong>{state}</strong>
      </p>
      {error !== null ? <p className={styles.memoryStatusHint}>{error}</p> : null}
      {snapshot !== null ? (
        <>
          <div className={styles.memoryStatusCounts}>
            <span>
              Pending episodes: <strong>{snapshot.pendingEpisodes}</strong>
            </span>
            <span>
              Processed episodes: <strong>{snapshot.consolidatedEpisodes}</strong>
            </span>
            <span>
              Saved facts: <strong>{snapshot.savedFacts}</strong>
            </span>
            <span>
              Local Only: <strong>{snapshot.localOnlyFacts}</strong>
            </span>
            <span>
              Cloud Allowed: <strong>{snapshot.cloudEligibleFacts}</strong>
            </span>
          </div>
          {snapshot.lastAttempt === "failed" &&
          (snapshot.lastFailureCodes?.length ?? 0) > 0 ? (
            <p className={styles.memoryStatusHint}>
              Penyebab terakhir:{" "}
              {snapshot.lastFailureCodes
                ?.map((code) => FAILURE_LABELS[code] ?? "Kategori tidak dikenal.")
                .join(" ")}
            </p>
          ) : null}
          <p className={styles.memoryStatusHint}>
            {snapshot.queued ? "Konsolidasi menunggu giliran. " : ""}
            Fakta Local Only tidak boleh dibaca OpenRouter. Saved bukan jaminan setiap
            pertanyaan akan menemukan fakta: retrieval tetap memakai relevansi dan izin.
            {snapshot.lastAttempt === "failed"
              ? " Ekstraksi lokal terakhir gagal; episode belum diproses dapat dicoba lagi."
              : ""}
          </p>
        </>
      ) : null}
    </section>
  );
}
