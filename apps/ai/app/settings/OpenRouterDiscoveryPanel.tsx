"use client";

import styles from "./Settings.module.css";

type DiscoveredModel = {
  id: string;
  displayName: string;
  sourceProvider: string;
  contextWindowTokens: number | null;
  inputModalities: string[];
  promptPricePerToken: string | null;
  completionPricePerToken: string | null;
  mutableAlias: boolean;
  admission: "verified-executable" | "verified-selectable" | "unavailable" | "discovered-only";
  selectable: boolean;
  executable: boolean;
  selectionId: string | null;
  unavailableReason: string | null;
  validationPlan?: {
    capUsd: number;
    inputUsdPerMTok: number;
    outputUsdPerMTok: number;
    maxOutputTokens: number;
    reservationUsd: number;
  } | null;
};

type DiscoverySnapshot = {
  cache: "hit" | "refreshed" | "stale";
  stale: boolean;
  fetchedAt: string;
  total: number;
  returned: number;
  models: DiscoveredModel[];
};

interface OpenRouterDiscoveryPanelProps {
  readonly discovery: DiscoverySnapshot | null;
  readonly query: string;
  readonly sourceProvider: string;
  readonly pendingAction: string | null;
  readonly onQueryChange: (value: string) => void;
  readonly onSourceProviderChange: (value: string) => void;
  readonly onDiscover: (forceRefresh: boolean) => void;
  readonly onValidate: (selectionId: string) => void;
}

const admissionReasonLabels: Readonly<Record<string, string>> = {
  "duplicate-runtime-id": "runtime ID duplikat",
  "mutable-alias": "alias mutable",
  "invalid-runtime-slug": "runtime slug tidak valid",
  "missing-context-window": "context window tidak tersedia",
  "text-input-unsupported": "input teks tidak didukung",
  "text-output-unsupported": "output teks tidak didukung",
  "max-tokens-unsupported": "max_tokens tidak didukung",
  "missing-pricing": "harga belum lengkap",
  "invalid-pricing": "harga tidak valid",
  "stale-catalog": "catalog stale; refresh diperlukan",
};

function usdPerMTok(value: string | null): string {
  const perToken = value === null ? Number.NaN : Number(value);
  if (!Number.isFinite(perToken) || perToken < 0) return "harga tidak tersedia";
  return `USD ${(perToken * 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })}/1 juta token`;
}

function admissionLabel(model: DiscoveredModel): string {
  if (model.executable) return "Ready";
  if (model.selectable) return "Perlu test";
  if (model.admission === "unavailable") return "Unavailable";
  return "Discovery only";
}

export function OpenRouterDiscoveryPanel({
  discovery,
  query,
  sourceProvider,
  pendingAction,
  onQueryChange,
  onSourceProviderChange,
  onDiscover,
  onValidate,
}: OpenRouterDiscoveryPanelProps) {
  return (
    <div className={styles.discoveryPanel}>
      <div className={styles.discoveryHeader}>
        <div>
          <span className={styles.eyebrow}>OpenRouter discovery</span>
          <h3>Find models</h3>
        </div>
        {discovery === null ? null : (
          <span className={discovery.stale ? styles.statusBadge : styles.activeBadge}>
            {discovery.stale ? "Stale cache" : discovery.cache}
          </span>
        )}
      </div>
      <p className={styles.muted}>
        Harga input dan output berasal dari katalog OpenRouter per 1 juta token. Model baru baru
        menjadi Ready setelah test yang kamu konfirmasi. Test memakai reservasi maksimal USD
        0.07 dan tetap memakai budget Cloud AI kamu.
      </p>
      <div className={styles.discoveryFilters}>
        <label className={styles.connectField}>
          Search model
          <input
            value={query}
            disabled={pendingAction !== null}
            placeholder="qwen, kimi, deepseek, gemini…"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <label className={styles.connectField}>
          Source provider
          <input
            value={sourceProvider}
            disabled={pendingAction !== null}
            placeholder="qwen"
            onChange={(event) => onSourceProviderChange(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => onDiscover(false)}
        >
          {pendingAction === "openrouter-discovery" ? "Loading…" : "Search catalog"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={pendingAction !== null}
          onClick={() => onDiscover(true)}
        >
          Refresh from OpenRouter
        </button>
      </div>
      {discovery === null ? (
        <p className={styles.discoveryEmpty}>
          Catalog belum dimuat. Search pertama mengambil snapshot live; pencarian berikutnya
          memakai cache sampai TTL habis.
        </p>
      ) : (
        <>
          <p className={styles.discoveryMeta}>
            {discovery.returned} ditampilkan dari {discovery.total} hasil · diambil{" "}
            {new Date(discovery.fetchedAt).toLocaleString()} · cache {discovery.cache}
            {discovery.stale ? " · stale fallback" : ""}
          </p>
          <div className={styles.discoveryResults}>
            {discovery.models.length === 0 ? (
              <p className={styles.discoveryEmpty}>Tidak ada model yang cocok.</p>
            ) : (
              discovery.models.map((model) => {
                const canValidate =
                  model.selectable &&
                  !model.executable &&
                  model.selectionId !== null &&
                  model.validationPlan !== null &&
                  model.validationPlan !== undefined;
                return (
                  <article className={styles.discoveryModel} key={model.id}>
                    <div className={styles.discoveryModelTop}>
                      <div>
                        <strong>{model.displayName}</strong>
                        <code>{model.id}</code>
                      </div>
                      <span
                        className={model.executable ? styles.activeBadge : styles.statusBadge}
                      >
                        {admissionLabel(model)}
                      </span>
                    </div>
                    <div className={styles.discoveryFacts}>
                      <span>source {model.sourceProvider}</span>
                      <span>
                        context{" "}
                        {model.contextWindowTokens === null
                          ? "unknown"
                          : model.contextWindowTokens.toLocaleString()}
                      </span>
                      <span>input {usdPerMTok(model.promptPricePerToken)}</span>
                      <span>output {usdPerMTok(model.completionPricePerToken)}</span>
                      <span>
                        input format{" "}
                        {model.inputModalities.length > 0
                          ? model.inputModalities.join(", ")
                          : "unknown"}
                      </span>
                      {model.validationPlan ? (
                        <span>
                          test: reserve USD {model.validationPlan.reservationUsd.toFixed(2)},
                          maksimal {model.validationPlan.maxOutputTokens} output token
                        </span>
                      ) : null}
                      {model.mutableAlias ? <span>mutable alias</span> : null}
                      {model.unavailableReason ? (
                        <span>
                          alasan{" "}
                          {admissionReasonLabels[model.unavailableReason] ??
                            model.unavailableReason}
                        </span>
                      ) : null}
                    </div>
                    {canValidate ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => onValidate(model.selectionId!)}
                        >
                          Test &amp; enable (maks. USD {model.validationPlan!.capUsd.toFixed(2)}
                          )
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
