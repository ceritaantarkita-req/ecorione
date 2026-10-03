"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DEFAULT_WORKSPACE_ID,
  GoogleDriveConnectionStatusSchema,
  GoogleDriveOAuthStartResponseSchema,
  GoogleDrivePickerSessionResponseSchema,
  ProjectGoogleDriveIngestResponseSchema,
  type GoogleDriveConnectionStatus,
  type ProjectExternalSourceLifecycle,
  type ProjectGoogleDriveIngestResponse,
  type ProjectMcpResourceIngestResponse,
  type ProjectSourceExtractResponse,
  type ProjectSourceResourceType,
  type ProjectUrlIngestResponse,
  type ProjectSourceRole,
  type ProjectSourceView,
} from "@ecorione/shared-schema";
import {
  GoogleDriveOperationError,
  ingestGoogleDriveSelection,
} from "../../lib/google-drive-ingest-batch";
import { pickGoogleDriveFiles } from "../../lib/google-drive-picker-client";
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

function mcpExternalSourceKey(serverId: string, resourceUri: string): string {
  return JSON.stringify([serverId, resourceUri]);
}

function lifecycleLabel(lifecycle: ProjectExternalSourceLifecycle): string {
  switch (lifecycle.state) {
    case "SNAPSHOT_READY":
      return "Snapshot ready";
    case "INDEXED":
      return "Indexed";
    case "DETACHED":
      return "Snapshot detached";
  }
}

interface McpResourceItem {
  readonly uri: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly mimeType?: string | undefined;
}

function errorDetails(
  body: unknown,
  fallback: string,
): { readonly type: string | null; readonly message: string } {
  if (typeof body !== "object" || body === null) return { type: null, message: fallback };
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return { type: null, message: fallback };
  const type = (error as { type?: unknown }).type;
  const message = (error as { message?: unknown }).message;
  return {
    type: typeof type === "string" ? type : null,
    message: typeof message === "string" ? message : fallback,
  };
}

function errorMessage(body: unknown, fallback: string): string {
  return errorDetails(body, fallback).message;
}

export function ProjectSources(props: {
  readonly projectId: string;
  readonly workspaceId: string;
}): React.JSX.Element {
  const [sources, setSources] = useState<ProjectSourceView[]>([]);
  const [lifecycles, setLifecycles] = useState<ProjectExternalSourceLifecycle[]>([]);
  const [sourceCatalog, setSourceCatalog] = useState<SourceCatalogItem[]>([]);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState<ProjectSourceResourceType>("artifact");
  const [resourceId, setResourceId] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [role, setRole] = useState<ProjectSourceRole>("source");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRole, setUploadRole] = useState<ProjectSourceRole>("source");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [mcpResources, setMcpResources] = useState<Record<string, McpResourceItem[]>>({});
  const [driveStatus, setDriveStatus] = useState<GoogleDriveConnectionStatus | null>(null);
  const [driveReconnectRequired, setDriveReconnectRequired] = useState(false);
  const [driveRole, setDriveRole] = useState<ProjectSourceRole>("source");
  const [feedback, setFeedback] = useState<string | null>(null);

  const endpoint = `/api/projects/${encodeURIComponent(props.projectId)}/sources`;

  const candidates = useMemo(
    () =>
      resourceType === "url"
        ? []
        : sourceCatalog.filter((item) => item.resourceType === resourceType),
    [resourceType, sourceCatalog],
  );

  const filteredCandidates = useMemo(() => {
    const query = catalogQuery.trim().toLocaleLowerCase();
    if (query.length === 0) return candidates;
    return candidates.filter((item) =>
      [item.label, item.detail, item.resourceId].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [candidates, catalogQuery]);

  const attachedBindingKeys = useMemo(
    () =>
      new Set(
        sources.map((source) =>
          [source.binding.resourceType, source.binding.resourceId, source.binding.role].join(
            ":",
          ),
        ),
      ),
    [sources],
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

  const loadLifecycle = useCallback(async () => {
    const response = await fetch(
      `${endpoint}/lifecycle?workspaceId=${encodeURIComponent(props.workspaceId)}`,
      { cache: "no-store" },
    );
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(errorMessage(body, "Gagal memuat source lifecycle."));
    setLifecycles((body as { lifecycles: ProjectExternalSourceLifecycle[] }).lifecycles);
  }, [endpoint, props.workspaceId]);

  const loadDriveStatus = useCallback(async () => {
    if (props.workspaceId !== DEFAULT_WORKSPACE_ID) {
      setDriveStatus(null);
      return;
    }
    const response = await fetch(
      `/api/integrations/google-drive/status?workspaceId=${encodeURIComponent(props.workspaceId)}`,
      { cache: "no-store" },
    );
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new Error(errorMessage(body, "Gagal memuat status Google Drive."));
    }
    const parsed = GoogleDriveConnectionStatusSchema.safeParse(body);
    if (!parsed.success) throw new Error("Status Google Drive tidak sesuai kontrak.");
    if (!parsed.data.connected) setDriveReconnectRequired(false);
    setDriveStatus(parsed.data);
  }, [props.workspaceId]);

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
    void Promise.all([load(), loadLifecycle(), loadCatalog(), loadDriveStatus()]).catch(
      (error: unknown) =>
        setFeedback(error instanceof Error ? error.message : "Gagal memuat Project Sources."),
    );
  }, [load, loadCatalog, loadDriveStatus, loadLifecycle]);

  async function connectGoogleDrive(): Promise<void> {
    if (
      props.workspaceId !== DEFAULT_WORKSPACE_ID ||
      busyKey !== null ||
      driveStatus?.available !== true
    ) {
      return;
    }
    setBusyKey("drive-connect");
    setFeedback(null);
    try {
      const current = new URL(window.location.href);
      current.searchParams.delete("googleDrive");
      const returnPath = `${current.pathname}${current.search}`;
      const response = await fetch("/api/integrations/google-drive/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          returnPath,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(errorMessage(body, "Gagal memulai koneksi Google Drive."));
      }
      const parsed = GoogleDriveOAuthStartResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Respons OAuth Google Drive tidak sesuai kontrak.");
      const authorization = new URL(parsed.data.authorizationUrl);
      if (
        authorization.origin !== "https://accounts.google.com" ||
        authorization.pathname !== "/o/oauth2/v2/auth"
      ) {
        throw new Error("Tujuan OAuth Google Drive tidak diizinkan.");
      }
      window.location.assign(authorization.toString());
    } catch (error) {
      setBusyKey(null);
      setFeedback(
        error instanceof Error ? error.message : "Gagal memulai koneksi Google Drive.",
      );
    }
  }

  async function disconnectGoogleDrive(): Promise<void> {
    if (props.workspaceId !== DEFAULT_WORKSPACE_ID || busyKey !== null) return;
    setBusyKey("drive-disconnect");
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/integrations/google-drive?workspaceId=${encodeURIComponent(props.workspaceId)}`,
        { method: "DELETE" },
      );
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(errorMessage(body, "Gagal memutus Google Drive."));
      }
      await loadDriveStatus();
      setDriveReconnectRequired(false);
      setFeedback(
        "Google Drive terputus. Snapshot Artifact yang sudah tersimpan tetap tersedia di Project.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal memutus Google Drive.");
    } finally {
      setBusyKey(null);
    }
  }

  async function ingestGoogleDriveFile(
    fileId: string,
    nextRole: ProjectSourceRole,
  ): Promise<ProjectGoogleDriveIngestResponse> {
    const response = await fetch(`${endpoint}/ingest-google-drive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: props.workspaceId,
        fileId,
        role: nextRole,
      }),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const details = errorDetails(body, "Gagal mengambil file Google Drive.");
      throw new GoogleDriveOperationError(details.type, details.message);
    }
    const parsed = ProjectGoogleDriveIngestResponseSchema.safeParse(body);
    if (!parsed.success) throw new Error("Snapshot Google Drive tidak sesuai kontrak.");
    return parsed.data;
  }

  async function openGoogleDrivePicker(): Promise<void> {
    if (
      props.workspaceId !== DEFAULT_WORKSPACE_ID ||
      busyKey !== null ||
      driveStatus?.connected !== true ||
      driveStatus.pickerAvailable !== true
    ) {
      return;
    }
    setBusyKey("drive-picker");
    setFeedback(null);
    try {
      const sessionResponse = await fetch("/api/integrations/google-drive/picker-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: props.workspaceId }),
        cache: "no-store",
      });
      const rawSession: unknown = await sessionResponse.json().catch(() => undefined);
      if (!sessionResponse.ok) {
        const details = errorDetails(rawSession, "Gagal membuat sesi Google Picker.");
        throw new GoogleDriveOperationError(details.type, details.message);
      }
      const session = GoogleDrivePickerSessionResponseSchema.safeParse(rawSession);
      if (!session.success) throw new Error("Sesi Google Picker tidak sesuai kontrak.");

      const selection = await pickGoogleDriveFiles(session.data);
      if (selection === null) {
        setFeedback("Pemilihan Google Drive dibatalkan.");
        return;
      }

      const batch = await ingestGoogleDriveSelection(
        selection.files,
        driveRole,
        ingestGoogleDriveFile,
      );

      if (batch.successes.length > 0) {
        await Promise.all([load(), loadLifecycle(), loadCatalog(), loadDriveStatus()]);
      }
      if (batch.reconnectRequired) setDriveReconnectRequired(true);
      setFeedback(batch.feedback);
    } catch (error) {
      if (
        error instanceof GoogleDriveOperationError &&
        error.type === "GOOGLE_DRIVE_RECONNECT_REQUIRED"
      ) {
        setDriveReconnectRequired(true);
      }
      setFeedback(error instanceof Error ? error.message : "Google Picker gagal dibuka.");
    } finally {
      setBusyKey(null);
    }
  }

  async function refreshGoogleDriveSnapshot(
    lifecycle: ProjectExternalSourceLifecycle,
  ): Promise<void> {
    if (
      lifecycle.sourceType !== "google-drive" ||
      lifecycle.state === "DETACHED" ||
      busyKey !== null
    ) {
      return;
    }
    const key = `drive-refresh:${lifecycle.sourceKey}:${lifecycle.role}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const refreshed = await ingestGoogleDriveFile(lifecycle.sourceKey, lifecycle.role);
      setDriveReconnectRequired(false);
      setFeedback(
        `Google Drive snapshot diperbarui → Artifact ${refreshed.artifact.id}. Index snapshot terbaru bila diperlukan.`,
      );
      await Promise.all([load(), loadLifecycle(), loadCatalog()]);
    } catch (error) {
      if (
        error instanceof GoogleDriveOperationError &&
        error.type === "GOOGLE_DRIVE_RECONNECT_REQUIRED"
      ) {
        setDriveReconnectRequired(true);
      }
      setFeedback(
        error instanceof Error ? error.message : "Gagal memperbarui Google Drive snapshot.",
      );
    } finally {
      setBusyKey(null);
    }
  }

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

  async function attachBinding(
    nextResourceType: ProjectSourceResourceType,
    nextResourceId: string,
    nextRole: ProjectSourceRole,
  ): Promise<void> {
    const normalized = nextResourceId.trim();
    if (normalized.length === 0 || busyKey !== null) return;
    const key = `attach:${nextResourceType}:${normalized}:${nextRole}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          resourceType: nextResourceType,
          resourceId: normalized,
          role: nextRole,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal menambahkan source."));
      if (nextResourceType === "url") setResourceId("");
      await load();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal menambahkan source.");
    } finally {
      setBusyKey(null);
    }
  }

  async function attach(event: FormEvent): Promise<void> {
    event.preventDefault();
    await attachBinding(resourceType, resourceId, role);
  }

  async function browseMcpResources(source: ProjectSourceView): Promise<void> {
    if (
      source.binding.resourceType !== "mcp-server" ||
      source.availability !== "AVAILABLE" ||
      busyKey !== null
    ) {
      return;
    }
    const serverId = source.binding.resourceId;
    const key = `mcp-browse:${serverId}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const params = new URLSearchParams({
        workspaceId: props.workspaceId,
        serverId,
      });
      const response = await fetch(`${endpoint}/mcp-resources?${params.toString()}`, {
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal memuat MCP resources."));
      const discovered = body as {
        resources: McpResourceItem[];
        warning: string | null;
      };
      setMcpResources((current) => ({ ...current, [serverId]: discovered.resources }));
      if (discovered.warning !== null) setFeedback(discovered.warning);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal memuat MCP resources.");
    } finally {
      setBusyKey(null);
    }
  }

  async function ingestMcpResource(
    source: ProjectSourceView,
    resource: McpResourceItem,
  ): Promise<void> {
    if (source.binding.resourceType !== "mcp-server" || busyKey !== null) return;
    const serverId = source.binding.resourceId;
    const key = `mcp-ingest:${serverId}:${resource.uri}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch(`${endpoint}/ingest-mcp-resource`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: props.workspaceId,
          serverId,
          resourceUri: resource.uri,
          role: source.binding.role,
        }),
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(errorMessage(body, "Gagal mengambil MCP resource."));
      const ingested = body as ProjectMcpResourceIngestResponse;
      setFeedback(
        `Connector snapshot tersimpan → Artifact ${ingested.artifact.id}. Gunakan Index pada Artifact untuk derived Project context.`,
      );
      await Promise.all([load(), loadLifecycle(), loadCatalog()]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal mengambil MCP resource.");
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
        `URL snapshot tersimpan → Artifact ${ingested.artifact.id}. Gunakan Index pada Artifact untuk derived Project context.`,
      );
      await Promise.all([load(), loadLifecycle(), loadCatalog()]);
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
        `Index ${extracted.task} selesai → Project context ${extracted.contextEpisodeId}.${preview.length === 0 ? "" : ` ${preview}`}`,
      );
      await loadLifecycle();
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
      await Promise.all([load(), loadLifecycle()]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal melepas source.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className={styles.sources}>
      <div className={styles.sourcesHeader}>
        <div>
          <h3>Sources</h3>
          <p>
            Binding tetap referensi owner; snapshot eksternal disimpan sebagai Artifact
            terpisah.
          </p>
        </div>
        <button
          className="ecr-btn ecr-btn--secondary"
          type="button"
          disabled={catalogLoading || busyKey !== null}
          onClick={() =>
            void Promise.all([loadCatalog(), loadLifecycle()]).catch((error: unknown) =>
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
          <strong>Google Drive</strong>
          <small>
            Pilih file secara eksplisit lewat Google Picker. ECORIONE hanya menyimpan snapshot
            file yang dipilih; tidak mengindeks seluruh Drive atau melakukan sync otomatis.
          </small>
          <small>
            {props.workspaceId !== DEFAULT_WORKSPACE_ID
              ? "Native Drive V1 hanya tersedia di Personal Workspace."
              : driveStatus === null
                ? "Memuat status koneksi..."
                : !driveStatus.available
                  ? "Belum dikonfigurasi operator."
                  : !driveStatus.connected
                    ? "Belum terhubung."
                    : driveReconnectRequired
                      ? "Perlu dihubungkan ulang. Putuskan koneksi lama lalu hubungkan kembali."
                      : driveStatus.pickerAvailable
                        ? "Terhubung · Picker siap."
                        : "Terhubung · konfigurasi Picker belum lengkap."}
          </small>
        </div>
        <div className={styles.sourceUploadForm}>
          <select
            className="ecr-input"
            value={driveRole}
            aria-label="Peran Google Drive source"
            disabled={
              busyKey !== null || driveStatus?.connected !== true || driveReconnectRequired
            }
            onChange={(event) => setDriveRole(event.target.value as ProjectSourceRole)}
          >
            <option value="source">Source</option>
            <option value="reference">Reference</option>
          </select>
          {driveStatus?.connected === true ? (
            <>
              <button
                className="ecr-btn ecr-btn--primary"
                type="button"
                disabled={
                  busyKey !== null ||
                  driveStatus.pickerAvailable !== true ||
                  driveReconnectRequired
                }
                onClick={() => void openGoogleDrivePicker()}
              >
                {busyKey === "drive-picker" ? "Membuka..." : "Pilih file Drive"}
              </button>
              <button
                className="ecr-btn ecr-btn--secondary"
                type="button"
                disabled={busyKey !== null}
                onClick={() => void disconnectGoogleDrive()}
              >
                {busyKey === "drive-disconnect"
                  ? "Memutus..."
                  : driveReconnectRequired
                    ? "Putuskan untuk hubungkan ulang"
                    : "Putuskan"}
              </button>
            </>
          ) : (
            <button
              className="ecr-btn ecr-btn--primary"
              type="button"
              disabled={
                busyKey !== null ||
                props.workspaceId !== DEFAULT_WORKSPACE_ID ||
                driveStatus?.available !== true
              }
              onClick={() => void connectGoogleDrive()}
            >
              {busyKey === "drive-connect" ? "Menghubungkan..." : "Hubungkan Google Drive"}
            </button>
          )}
        </div>
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
            setCatalogQuery("");
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
          <input
            className="ecr-input"
            type="search"
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="Cari nama, detail, atau ID source..."
            aria-label="Cari Project source"
            disabled={catalogLoading || candidates.length === 0}
          />
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
        {resourceType === "url" ? (
          <button
            className="ecr-btn ecr-btn--primary"
            type="submit"
            disabled={busyKey !== null || resourceId.trim().length === 0}
          >
            {busyKey?.startsWith("attach:url:") === true ? "Menambahkan..." : "Tambah URL"}
          </button>
        ) : (
          <span className={styles.sourcePickerInstruction}>
            Pilih source dari daftar di bawah.
          </span>
        )}
      </form>

      {resourceType !== "url" ? (
        <div className={styles.sourcePickerResults} aria-live="polite">
          <div className={styles.sourcePickerSummary}>
            <span>
              {catalogLoading
                ? "Memuat source..."
                : `${String(filteredCandidates.length)} dari ${String(candidates.length)} resource`}
            </span>
            <span>Role: {role === "source" ? "Source" : "Reference"}</span>
          </div>
          {filteredCandidates.length === 0 ? (
            <p className={styles.empty}>
              {catalogLoading
                ? "Memuat resource..."
                : catalogQuery.trim().length > 0
                  ? "Tidak ada source yang cocok dengan pencarian."
                  : "Tidak ada resource tersedia untuk tipe ini."}
            </p>
          ) : (
            <ul className={styles.sourcePickerGrid}>
              {filteredCandidates.map((candidate) => {
                const bindingKey = [candidate.resourceType, candidate.resourceId, role].join(
                  ":",
                );
                const attached = attachedBindingKeys.has(bindingKey);
                const attachKey = `attach:${bindingKey}`;
                return (
                  <li key={candidate.resourceId} className={styles.sourcePickerCard}>
                    <div>
                      <span className={styles.sourcePickerType}>
                        {RESOURCE_TYPES.find((item) => item.value === candidate.resourceType)
                          ?.label ?? candidate.resourceType}
                      </span>
                      <strong>{candidate.label}</strong>
                      <small>{candidate.detail}</small>
                      <code>{candidate.resourceId}</code>
                    </div>
                    <button
                      className={
                        attached ? "ecr-btn ecr-btn--secondary" : "ecr-btn ecr-btn--primary"
                      }
                      type="button"
                      disabled={busyKey !== null || attached}
                      aria-label={`${attached ? "Sudah terpasang" : "Tambahkan"} ${candidate.label}`}
                      onClick={() =>
                        void attachBinding(candidate.resourceType, candidate.resourceId, role)
                      }
                    >
                      {attached
                        ? "Terpasang"
                        : busyKey === attachKey
                          ? "Menambahkan..."
                          : "Tambah"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
            const sourceLifecycle =
              source.binding.resourceType === "url"
                ? lifecycles.find(
                    (item) =>
                      item.sourceType === "url" &&
                      item.sourceKey === source.binding.resourceId &&
                      item.role === source.binding.role,
                  )
                : source.binding.resourceType === "artifact"
                  ? lifecycles.find(
                      (item) => item.latestArtifactId === source.binding.resourceId,
                    )
                  : undefined;
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
                  {sourceLifecycle !== undefined ? (
                    <small className={styles.sourceLifecycle}>
                      {lifecycleLabel(sourceLifecycle)} · refreshed{" "}
                      {new Date(sourceLifecycle.lastRefreshedAt).toLocaleString()}
                      {sourceLifecycle.lastIndexedAt === null
                        ? ""
                        : ` · indexed ${new Date(sourceLifecycle.lastIndexedAt).toLocaleString()}`}
                    </small>
                  ) : null}
                  {source.binding.resourceType === "mcp-server" &&
                  mcpResources[source.binding.resourceId] !== undefined ? (
                    <div className={styles.mcpResourceList}>
                      {mcpResources[source.binding.resourceId]?.length === 0 ? (
                        <small>Tidak ada resource yang diiklankan server ini.</small>
                      ) : (
                        mcpResources[source.binding.resourceId]?.map((resource) => {
                          const resourceLifecycle = lifecycles.find(
                            (item) =>
                              item.sourceType === "mcp-resource" &&
                              item.sourceKey ===
                                mcpExternalSourceKey(source.binding.resourceId, resource.uri) &&
                              item.role === source.binding.role,
                          );
                          return (
                            <div key={resource.uri} className={styles.mcpResourceItem}>
                              <div>
                                <strong>{resource.name ?? resource.uri}</strong>
                                <code>{resource.uri}</code>
                                <small>
                                  {resource.mimeType ?? "mime unknown"}
                                  {resource.description === undefined
                                    ? ""
                                    : ` · ${resource.description}`}
                                </small>
                                {resourceLifecycle !== undefined ? (
                                  <small className={styles.sourceLifecycle}>
                                    {lifecycleLabel(resourceLifecycle)}
                                  </small>
                                ) : null}
                              </div>
                              <button
                                className="ecr-btn ecr-btn--primary"
                                type="button"
                                disabled={busyKey !== null}
                                onClick={() => void ingestMcpResource(source, resource)}
                              >
                                {busyKey ===
                                `mcp-ingest:${source.binding.resourceId}:${resource.uri}`
                                  ? "Refreshing..."
                                  : resourceLifecycle === undefined
                                    ? "Ingest"
                                    : "Refresh"}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
                <div className={styles.sourceActions}>
                  {source.binding.resourceType === "mcp-server" ? (
                    <button
                      className="ecr-btn ecr-btn--secondary"
                      type="button"
                      disabled={busyKey !== null || source.availability !== "AVAILABLE"}
                      onClick={() => void browseMcpResources(source)}
                    >
                      {busyKey === `mcp-browse:${source.binding.resourceId}`
                        ? "Browsing..."
                        : "Browse resources"}
                    </button>
                  ) : null}
                  {source.binding.resourceType === "url" ? (
                    <button
                      className="ecr-btn ecr-btn--primary"
                      type="button"
                      disabled={busyKey !== null || source.availability !== "AVAILABLE"}
                      onClick={() => void ingestUrl(source)}
                    >
                      {busyKey ===
                      `ingest-url:${source.binding.resourceId}:${source.binding.role}`
                        ? "Refreshing..."
                        : sourceLifecycle === undefined
                          ? "Ingest snapshot"
                          : "Refresh snapshot"}
                    </button>
                  ) : null}
                  {source.binding.resourceType === "artifact" &&
                  sourceLifecycle?.sourceType === "google-drive" &&
                  sourceLifecycle.state !== "DETACHED" ? (
                    <button
                      className="ecr-btn ecr-btn--secondary"
                      type="button"
                      disabled={busyKey !== null || driveStatus?.connected !== true}
                      onClick={() => void refreshGoogleDriveSnapshot(sourceLifecycle)}
                    >
                      {busyKey ===
                      `drive-refresh:${sourceLifecycle.sourceKey}:${sourceLifecycle.role}`
                        ? "Refreshing..."
                        : "Refresh Drive snapshot"}
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
                        ? sourceLifecycle === undefined
                          ? "Extracting..."
                          : "Indexing..."
                        : sourceLifecycle === undefined
                          ? "Extract"
                          : sourceLifecycle.state === "INDEXED"
                            ? "Re-index"
                            : "Index"}
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
