"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ProjectSourceExtractResponse,
  ProjectSourceResourceType,
  ProjectUrlIngestResponse,
  ProjectSourceRole,
  ProjectSourceView,
} from "@ecorione/shared-schema";
import styles from "./Projects.module.css";

const RESOURCE_TYPES: Array<{ value: ProjectSourceResourceType; label: string }> = [
  { value: "artifact", label: "Artifact" },
  { value: "space-page", label: "Space page" },
  { value: "flow-graph", label: "Flow graph" },
  { value: "mcp-server", label: "MCP server" },
  { value: "url", label: "URL" },
];

type CatalogResourceType = Exclude<ProjectSourceResourceType, "url">;

interface SourceCatalogItem {
  readonly resourceType: CatalogResourceType;
  readonly resourceId: string;
  readonly label: string;
  readonly detail: string;
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : fallback;
}

export function ProjectSources(props: {
  readonly projectId: string;
  readonly workspaceId: string;
}): React.JSX.Element {
  const [sources, setSources] = useState<ProjectSourceView[]>([]);
  const [sourceCatalog, setSourceCatalog] = useState<SourceCatalogItem[]>([]);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState<ProjectSourceResourceType>("artifact");
  const [resourceId, setResourceId] = useState("");
  const [role, setRole] = useState<ProjectSourceRole>("source");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRole, setUploadRole] = useState<ProjectSourceRole>("source");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const endpoint = `/api/projects/${encodeURIComponent(props.projectId)}/sources`;

  const candidates = useMemo(
    () =>
      resourceType === "url"
        ? []
        : sourceCatalog.filter((item) => item.resourceType === resourceType),
    [resourceType, sourceCatalog],
  );

  const load = useCallback(async () => {
    const response = await fetch(
      `${endpoint}?workspaceId=${encodeURIComponent(props.workspaceId)}`,
      { cache: "no-store" },
    );
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(errorMessage(body, "Gagal memuat Project Sources."));
    setSources((body as { sources: ProjectSourceView[] }).sources);
  }, [endpoint, props.workspaceId]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await fetch(
        `/api/projects/source-catalog?workspaceId=${encodeURIComponent(props.workspaceId)}`,
        { cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal memuat source catalog."));
      const catalog = body as { items: SourceCatalogItem[]; warnings: string[] };
      setSourceCatalog(catalog.items);
      setCatalogWarnings(catalog.warnings);
    } finally {
      setCatalogLoading(false);
    }
  }, [props.workspaceId]);

  useEffect(() => {
    setFeedback(null);
    void Promise.all([load(), loadCatalog()]).catch((error: unknown) =>
      setFeedback(error instanceof Error ? error.message : "Gagal memuat Project Sources."),
    );
  }, [load, loadCatalog]);

  useEffect(() => {
    if (resourceType === "url") return;
    if (!candidates.some((candidate) => candidate.resourceId === resourceId)) {
      setResourceId(candidates[0]?.resourceId ?? "");
    }
  }, [candidates, resourceId, resourceType]);

  async function upload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    if (uploadFile === null || busyKey !== null) return;
    setBusyKey("upload");
    setFeedback(null);
    try {
      const body = new FormData();
      body.set("workspaceId", props.workspaceId);
      body.set("role", uploadRole);
      body.set("file", uploadFile);
      const response = await fetch(`${endpoint}/upload`, {
        method: "POST",
        body,
      });
      const payload: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(payload, "Gagal mengunggah source."));
      setUploadFile(null);
      form.reset();
      await Promise.all([load(), loadCatalog()]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal mengunggah source.");
    } finally {
      setBusyKey(null);
    }
  }

  async function attach(event: FormEvent): Promise<void> {
    event.preventDefault();
    const normalized = resourceId.trim();
    if (normalized.length === 0 || busyKey !== null) return;
    setBusyKey("attach");
    setFeedback(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          resourceType,
          resourceId: normalized,
          role,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal menambahkan source."));
      if (resourceType === "url") setResourceId("");
      await load();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal menambahkan source.");
    } finally {
      setBusyKey(null);
    }
  }

  async function ingestUrl(source: ProjectSourceView): Promise<void> {
    if (
      source.binding.resourceType !== "url" ||
      source.availability !== "AVAILABLE" ||
      busyKey !== null
    ) {
      return;
    }
    const key = `ingest-url:${source.binding.resourceId}:${source.binding.role}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(`${endpoint}/ingest-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          url: source.binding.resourceId,
          role: source.binding.role,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal mengambil URL source."));
      const ingested = body as ProjectUrlIngestResponse;
      setFeedback(
        `URL snapshot tersimpan → Artifact ${ingested.artifact.id}. Gunakan Extract pada Artifact untuk derived Project context.`,
      );
      await Promise.all([load(), loadCatalog()]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal mengambil URL source.");
    } finally {
      setBusyKey(null);
    }
  }

  async function extract(source: ProjectSourceView): Promise<void> {
    if (
      source.binding.resourceType !== "artifact" ||
      source.availability !== "AVAILABLE" ||
      busyKey !== null
    ) {
      return;
    }
    const key = `extract:${source.binding.resourceId}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(`${endpoint}/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          artifactId: source.binding.resourceId,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal mengekstrak source."));
      const extracted = body as ProjectSourceExtractResponse;
      const preview = extracted.result.text.trim().slice(0, 160);
      setFeedback(
        `Extraction ${extracted.task} selesai → Project context ${extracted.contextEpisodeId}.${preview.length === 0 ? "" : ` ${preview}`}`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal mengekstrak source.");
    } finally {
      setBusyKey(null);
    }
  }

  async function detach(source: ProjectSourceView): Promise<void> {
    const key = [
      source.binding.resourceType,
      source.binding.resourceId,
      source.binding.role,
    ].join(":");
    if (busyKey !== null) return;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          resourceType: source.binding.resourceType,
          resourceId: source.binding.resourceId,
          role: source.binding.role,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal melepas source."));
      await load();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal melepas source.");
    } finally {
      setBusyKey(null);
    }
  }

  const selectedCandidate =
    resourceType === "url"
      ? undefined
      : candidates.find((candidate) => candidate.resourceId === resourceId);

  return (
    <section className={styles.sources}>
      <div className={styles.sourcesHeader}>
        <div>
          <h3>Sources</h3>
          <p>Referensi ke owner asli. Konten tidak disalin ke Project.</p>
        </div>
        <button
          className="ecr-btn ecr-btn--secondary"
          type="button"
          disabled={catalogLoading || busyKey !== null}
          onClick={() =>
            void loadCatalog().catch((error: unknown) =>
              setFeedback(
                error instanceof Error ? error.message : "Gagal memuat source catalog.",
              ),
            )
          }
        >
          {catalogLoading ? "Memuat..." : "Refresh picker"}
        </button>
      </div>

      <div className={styles.sourceUpload}>
        <div>
          <strong>Upload file</strong>
          <small>
            Maks. 20 MiB. Disimpan oleh Artifact dan langsung diikat ke Project. Gunakan Extract
            pada Artifact untuk membuat derived context Project; tidak membuat chat/history.
          </small>
        </div>
        <form className={styles.sourceUploadForm} onSubmit={upload}>
          <input
            className="ecr-input"
            type="file"
            aria-label="Upload Project source file"
            disabled={busyKey !== null}
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
          />
          <select
            className="ecr-input"
            defaultValue="source"
            aria-label="Peran uploaded source"
            disabled={busyKey !== null}
            onChange={(event) => setUploadRole(event.target.value as ProjectSourceRole)}
          >
            <option value="source">Source</option>
            <option value="reference">Reference</option>
          </select>
          <button
            className="ecr-btn ecr-btn--primary"
            type="submit"
            disabled={busyKey !== null || uploadFile === null}
          >
            {busyKey === "upload" ? "Mengunggah..." : "Upload"}
          </button>
        </form>
      </div>

      <form className={styles.sourceForm} onSubmit={attach}>
        <select
          className="ecr-input"
          value={resourceType}
          onChange={(event) => {
            const next = event.target.value as ProjectSourceResourceType;
            setResourceType(next);
            setResourceId("");
          }}
          aria-label="Tipe source"
        >
          {RESOURCE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {resourceType === "url" ? (
          <input
            className="ecr-input"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
            placeholder="https://..."
            aria-label="HTTPS URL source"
          />
        ) : (
          <select
            className="ecr-input"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
            aria-label="Pilih resource"
            disabled={catalogLoading || candidates.length === 0}
          >
            {candidates.length === 0 ? (
              <option value="">
                {catalogLoading ? "Memuat resource..." : "Tidak ada resource tersedia"}
              </option>
            ) : (
              candidates.map((candidate) => (
                <option key={candidate.resourceId} value={candidate.resourceId}>
                  {candidate.label} · {candidate.detail}
                </option>
              ))
            )}
          </select>
        )}

        <select
          className="ecr-input"
          value={role}
          onChange={(event) => setRole(event.target.value as ProjectSourceRole)}
          aria-label="Peran source"
        >
          <option value="source">Source</option>
          <option value="reference">Reference</option>
        </select>
        <button
          className="ecr-btn ecr-btn--primary"
          type="submit"
          disabled={busyKey !== null || resourceId.trim().length === 0}
        >
          Tambah
        </button>
      </form>

      {selectedCandidate !== undefined ? (
        <p className={styles.sourcePickerHint}>
          {selectedCandidate.label} · <code>{selectedCandidate.resourceId}</code> ·{" "}
          {selectedCandidate.detail}
        </p>
      ) : null}

      {catalogWarnings.length > 0 ? (
        <p className={styles.sourcePickerWarning}>{catalogWarnings.join(" ")}</p>
      ) : null}

      {feedback !== null ? <p className={styles.feedback}>{feedback}</p> : null}

      {sources.length === 0 ? (
        <p className={styles.empty}>Belum ada source di Project ini.</p>
      ) : (
        <ul className={styles.sourceList}>
          {sources.map((source) => {
            const key = [
              source.binding.resourceType,
              source.binding.resourceId,
              source.binding.role,
            ].join(":");
            const catalogItem = sourceCatalog.find(
              (item) =>
                item.resourceType === source.binding.resourceType &&
                item.resourceId === source.binding.resourceId,
            );
            return (
              <li key={key} className={styles.sourceItem}>
                <div className={styles.sourceInfo}>
                  <div className={styles.sourceTitle}>
                    <span>{catalogItem?.label ?? source.binding.resourceType}</span>
                    <span
                      className={
                        source.availability === "AVAILABLE"
                          ? styles.available
                          : styles.unavailable
                      }
                    >
                      {source.availability.toLowerCase()}
                    </span>
                  </div>
                  <code>{source.binding.resourceId}</code>
                  <small>
                    {source.binding.owner} · {source.binding.role}
                    {catalogItem === undefined ? "" : ` · ${catalogItem.detail}`}
                  </small>
                  {source.unavailableReason !== null ? <p>{source.unavailableReason}</p> : null}
                </div>
                <div className={styles.sourceActions}>
                  {source.binding.resourceType === "url" ? (
                    <button
                      className="ecr-btn ecr-btn--primary"
                      type="button"
                      disabled={busyKey !== null || source.availability !== "AVAILABLE"}
                      onClick={() => void ingestUrl(source)}
                    >
                      {busyKey ===
                      `ingest-url:${source.binding.resourceId}:${source.binding.role}`
                        ? "Ingesting..."
                        : "Ingest snapshot"}
                    </button>
                  ) : null}
                  {source.binding.resourceType === "artifact" ? (
                    <button
                      className="ecr-btn ecr-btn--primary"
                      type="button"
                      disabled={busyKey !== null || source.availability !== "AVAILABLE"}
                      onClick={() => void extract(source)}
                    >
                      {busyKey === `extract:${source.binding.resourceId}`
                        ? "Extracting..."
                        : "Extract"}
                    </button>
                  ) : null}
                  <button
                    className="ecr-btn ecr-btn--secondary"
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => void detach(source)}
                  >
                    Lepas
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
