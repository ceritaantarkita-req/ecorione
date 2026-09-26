"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { HistorySession, Project, ProjectAutonomyCeiling } from "@ecorione/shared-schema";
import {
  PERSONAL_PROJECT_ID,
  activeProjects,
  resolveActiveProjectId,
} from "../../lib/project-selection";
import { useWorkspace } from "../WorkspaceProvider";
import { ProjectSettings } from "./ProjectSettings";
import { ProjectSources } from "./ProjectSources";
import styles from "./Projects.module.css";

const ALL_ID = "__all__";

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
  const { workspaceId, ready: workspaceReady } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>(PERSONAL_PROJECT_ID);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [name, setName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createInstruction, setCreateInstruction] = useState("");
  const [createAutonomyCeiling, setCreateAutonomyCeiling] =
    useState<ProjectAutonomyCeiling>("L3");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/projects?workspaceId=${workspaceId}`, {
      cache: "no-store",
    });
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(errorMessage(body, "Gagal memuat Projects."));
    const nextProjects = (body as ProjectList).projects;
    setProjects(nextProjects);
    setSelectedId((current) => {
      if (current === ALL_ID) return current;
      return resolveActiveProjectId(current, activeProjects(nextProjects)) ?? ALL_ID;
    });
  }, [workspaceId]);

  const loadSessions = useCallback(async (projectId?: string) => {
    const params = new URLSearchParams({ workspaceId: workspaceId });
    if (projectId !== undefined) params.set("projectId", projectId);
    const res = await fetch(`/api/projects/history?${params.toString()}`, {
      cache: "no-store",
    });
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(errorMessage(body, "Gagal memuat percakapan Project."));
    setSessions((body as SessionList).sessions);
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceReady) return;
    void loadProjects().catch((error: unknown) =>
      setFeedback(error instanceof Error ? error.message : "Gagal memuat Projects."),
    );
  }, [loadProjects, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady) return;
    void loadSessions(selectedId === ALL_ID ? undefined : selectedId).catch((error: unknown) =>
      setFeedback(error instanceof Error ? error.message : "Gagal memuat percakapan."),
    );
  }, [loadSessions, selectedId, workspaceReady]);

  async function createProject(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0 || busy || !workspaceReady) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspaceId,
          name: trimmed,
          description: createDescription,
          instruction: createInstruction,
          autonomyCeiling: createAutonomyCeiling,
        }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw new Error(errorMessage(body, "Gagal membuat Project."));
      const project = body as Project;
      setName("");
      setCreateDescription("");
      setCreateInstruction("");
      setCreateAutonomyCeiling("L3");
      await loadProjects();
      setSelectedId(project.id);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Gagal membuat Project.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveProject(projectId: string): Promise<void> {
    if (busy || !workspaceReady || projectId === PERSONAL_PROJECT_ID) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: workspaceId }),
      });
      const body: unknown = await res.json().catch(() => undefined);
      if (!res.ok) throw new Error(errorMessage(body, "Gagal mengarsipkan Project."));
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
    const target = new URL("/", window.location.origin);
    target.searchParams.set("workspace", workspaceId);
    target.searchParams.set("project", projectId);
    window.location.assign(target);
  }

  function projectSaved(updated: Project): void {
    setProjects((current) =>
      current.map((project) => (project.id === updated.id ? updated : project)),
    );
  }

  const allSelected = selectedId === ALL_ID;
  const selected = allSelected
    ? undefined
    : projects.find((project) => project.id === selectedId);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Organize context</p>
          <h1>Projects</h1>
          <p className={styles.lead}>
            Pisahkan percakapan, memori, dan kerja tanpa membuat Workspace baru.
          </p>
        </div>
        <form className={styles.create} onSubmit={createProject}>
          <div className={styles.createMain}>
            <input
              className="ecr-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama Project"
              aria-label="Nama Project baru"
              maxLength={160}
            />
            <button
              className="ecr-btn ecr-btn--primary"
              type="submit"
              disabled={busy || !name.trim()}
            >
              Buat
            </button>
          </div>
          <details className={styles.createAdvanced}>
            <summary>Initial settings</summary>
            <label>
              <span>Description</span>
              <textarea
                className="ecr-input"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                maxLength={2048}
                rows={2}
                placeholder="Tujuan Project"
              />
            </label>
            <label>
              <span>Project instruction</span>
              <textarea
                className="ecr-input"
                value={createInstruction}
                onChange={(event) => setCreateInstruction(event.target.value)}
                maxLength={8000}
                rows={3}
                placeholder="Instruksi untuk AI di Project ini"
              />
            </label>
            <label>
              <span>Autonomy ceiling</span>
              <select
                className="ecr-input"
                value={createAutonomyCeiling}
                onChange={(event) =>
                  setCreateAutonomyCeiling(event.target.value as ProjectAutonomyCeiling)
                }
              >
                <option value="L0">L0</option>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
              </select>
            </label>
            <small>Memory policy V1 tetap GLOBAL_PLUS_PROJECT.</small>
          </details>
        </form>
      </header>

      {feedback !== null ? <p className={styles.feedback}>{feedback}</p> : null}

      <section className={styles.grid}>
        <aside className={styles.sidebar} aria-label="Daftar Project">
          <button
            className={allSelected ? styles.virtualActive : styles.virtual}
            type="button"
            title="All adalah view virtual"
            aria-pressed={allSelected}
            onClick={() => setSelectedId(ALL_ID)}
          >
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
              <small>{project.id === PERSONAL_PROJECT_ID ? "default" : project.id}</small>
            </button>
          ))}
        </aside>

        <section className={styles.detail}>
          {allSelected ? (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2>All</h2>
                  <p>
                    Ringkasan metadata seluruh Project aktif. Memory dan Sources tetap
                    terisolasi per Project.
                  </p>
                </div>
              </div>

              <div className={styles.meta}>
                <span>Workspace: {workspaceId}</span>
                <span>Projects: {projects.length}</span>
                <span>Recent conversations: {sessions.length}</span>
              </div>

              <section className={styles.recent}>
                <h3>Recent conversations</h3>
                {sessions.length === 0 ? (
                  <p className={styles.empty}>Belum ada percakapan di Workspace ini.</p>
                ) : (
                  <ul>
                    {sessions.slice(0, 12).map((session) => {
                      const project =
                        session.projectId === null
                          ? undefined
                          : projects.find((item) => item.id === session.projectId);
                      const row = (
                        <>
                          <span>{session.title ?? session.id}</span>
                          <small>
                            {project?.name ??
                              (session.projectId === null
                                ? "Unassigned"
                                : "Project unavailable")}
                            {" · "}
                            {session.updatedAt ?? session.createdAt}
                          </small>
                        </>
                      );
                      return (
                        <li key={session.id}>
                          {project === undefined ? (
                            <div className={styles.recentItem}>{row}</div>
                          ) : (
                            <Link
                              href={`/?project=${encodeURIComponent(project.id)}&session=${encodeURIComponent(session.id)}`}
                            >
                              {row}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : selected === undefined ? (
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
                  {selected.id !== PERSONAL_PROJECT_ID ? (
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

              <ProjectSettings project={selected} onSaved={projectSaved} />

              <ProjectSources projectId={selected.id} workspaceId={selected.workspaceId} />

              <section className={styles.recent}>
                <h3>Recent conversations</h3>
                {sessions.length === 0 ? (
                  <p className={styles.empty}>Belum ada percakapan di Project ini.</p>
                ) : (
                  <ul>
                    {sessions.slice(0, 12).map((session) => (
                      <li key={session.id}>
                        <Link
                          href={`/?project=${encodeURIComponent(selected.id)}&session=${encodeURIComponent(session.id)}`}
                        >
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
