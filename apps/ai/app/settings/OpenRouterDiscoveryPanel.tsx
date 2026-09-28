"use client";

import styles from "./Settings.module.css";

type DiscoveredModel = {
  id: string;
  displayName: string;
  sourceProvider: string;
  contextWindowTokens: number | null;
  inputModalities: string[];
  mutableAlias: boolean;
  executable: boolean;
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
}

export function OpenRouterDiscoveryPanel({
  discovery,
  query,
  sourceProvider,
  pendingAction,
  onQueryChange,
  onSourceProviderChange,
  onDiscover,
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
        Discovery membaca katalog OpenRouter dan cache di Connect. Model yang ditemukan belum
        otomatis bisa dipilih; activation tetap butuh verification + pricing admission pada sesi
        berikutnya.
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
          Catalog belum dimuat. Search pertama akan mengambil snapshot live lalu pencarian
          berikutnya memakai cache sampai TTL habis.
        </p>
      ) : (
        <>
          <p className={styles.discoveryMeta}>
            {discovery.returned} shown / {discovery.total} matched · fetched{" "}
            {new Date(discovery.fetchedAt).toLocaleString()} · cache {discovery.cache}
            {discovery.stale ? " · stale fallback" : ""}
          </p>
          <div className={styles.discoveryResults}>
            {discovery.models.length === 0 ? (
              <p className={styles.discoveryEmpty}>Tidak ada model yang cocok.</p>
            ) : (
              discovery.models.map((model) => (
                <article className={styles.discoveryModel} key={model.id}>
                  <div className={styles.discoveryModelTop}>
                    <div>
                      <strong>{model.displayName}</strong>
                      <code>{model.id}</code>
                    </div>
                    <span className={model.executable ? styles.activeBadge : styles.statusBadge}>
                      {model.executable ? "Verified · selectable" : "Discovered only"}
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
                    <span>
                      input{" "}
                      {model.inputModalities.length > 0
                        ? model.inputModalities.join(", ")
                        : "unknown"}
                    </span>
                    {model.mutableAlias ? <span>mutable alias</span> : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
