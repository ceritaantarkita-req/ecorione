"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { HistorySession, Project } from "@ecorione/shared-schema";
import styles from "./Projects.module.css";

const WORKSPACE_ID = "ws_personal";
const PERSONAL_ID = "prj_personal";

type ProjectList = { projects: Project[] };
type SessionList = { sessions: HistorySession[] };

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : fallback;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>(PERSONAL_ID);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/projects?workspaceId=${WORKSPACE_ID}`, { cache: "no-store" });
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(errorMessage(body, "Gagal memuat Projects."));
    setProjects((body as ProjectList).projects);
  }, []);

  const loadSessions = useCallback(async (projectId: string) => {
    const res = await fetch(
      `/api/projects/history?workspaceId=${WORKSPACE_ID}&projectId=${encodeURIComponent(projectId)}`,
      { cache: "no-store" },
    );
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(errorMessage(body, "Gagal memuat percakapan Project."));
    setSessions((body as SessionList).sessions);
  }, []);

  useEffect(() => {
    void loadProjects().catch((error: unknown) =>
      setFeedback(error instanceof Error ? error.message : "Gagal memuat Projects."),
    );
  }, [loadProjects]);

  useEffect(() => {
    void loadSessions(selectedId).catch((error: unknown) =>
      setFeedback(error instanceof Error ? error.message : "Gagal memuat percakapan."),
    );
  }, [loadSessions, selectedId]);

  async function createProject(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0 || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WORKSPACE_ID, name: trimmed }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw new Error(errorMessage(body, "Gagal membuat Project."));
      const project = body as Project;
      setName("");
      await loadProjects();
      setSelectedId(project.id);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal membuat Project.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveProject(projectId: string): Promise<void> {
    if (busy || projectId === PERSONAL_ID) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WORKSPACE_ID }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw new Error(errorMessage(body, "Gagal mengarsipkan Project."));
      if (selectedId === projectId) setSelectedId(PERSONAL_ID);
      await loadProjects();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal mengarsipkan Project.");
    } finally {
      setBusy(false);
    }
  }

  function openProject(projectId: string): void {
    try {
      window.localStorage.setItem("ecorione.projectId", projectId);
    } catch {
      // Explicit query parameter remains sufficient when storage is unavailable.
    }
    window.location.assign(`/?project=${encodeURIComponent(projectId)}`);
  }

  const selected = projects.find((project) => project.id === selectedId);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Context boundaries</p>
          <h1>Projects</h1>
          <p className={styles.lead}>
            Pisahkan percakapan, memori, dan kerja tanpa membuat Workspace baru.
          </p>
        </div>
        <form className={styles.create} onSubmit={createProject}>
          <input
            className="ecr-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nama Project"
            aria-label="Nama Project baru"
            maxLength={160}
          />
          <button className="ecr-btn ecr-btn--primary" type="submit" disabled={busy || !name.trim()}>
            Buat
          </button>
        </form>
      </header>

      {feedback !== null ? <p className={styles.feedback}>{feedback}</p> : null}

      <section className={styles.grid}>
        <aside className={styles.sidebar} aria-label="Daftar Project">
          <button className={styles.virtual} type="button" title="All adalah view virtual">
            <span>All</span>
            <small>Semua Project · virtual</small>
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={project.id === selectedId ? styles.projectActive : styles.project}
              onClick={() => setSelectedId(project.id)}
            >
              <span>{project.name}</span>
              <small>{project.id === PERSONAL_ID ? "default" : project.id}</small>
            </button>
          ))}
        </aside>

        <section className={styles.detail}>
          {selected === undefined ? (
            <p className={styles.empty}>Pilih Project.</p>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.description || "Belum ada deskripsi."}</p>
                </div>
                <div className={styles.actions}>
                  <button
                    className="ecr-btn ecr-btn--primary"
                    type="button"
                    onClick={() => openProject(selected.id)}
                  >
                    Buka Chat
                  </button>
                  {selected.id !== PERSONAL_ID ? (
                    <button
                      className="ecr-btn ecr-btn--secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => void archiveProject(selected.id)}
                    >
                      Arsipkan
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={styles.meta}>
                <span>Workspace: {selected.workspaceId}</span>
                <span>Memory: {selected.memoryPolicy}</span>
                <span>Autonomy ceiling: {selected.autonomyCeiling}</span>
              </div>

              <section className={styles.recent}>
                <h3>Recent conversations</h3>
                {sessions.length === 0 ? (
                  <p className={styles.empty}>Belum ada percakapan di Project ini.</p>
                ) : (
                  <ul>
                    {sessions.slice(0, 12).map((session) => (
                      <li key={session.id}>
                        <Link href={`/?project=${encodeURIComponent(selected.id)}`}>
                          <span>{session.title ?? session.id}</span>
                          <small>{session.updatedAt ?? session.createdAt}</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
