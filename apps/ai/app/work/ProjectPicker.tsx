"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Project } from "@ecorione/shared-schema";
import styles from "./Work.module.css";

interface ProjectPickerProps {
  readonly workspaceId: string;
  readonly projects: readonly Project[];
  readonly projectId: string;
  readonly onChoose: (projectId: string) => void;
  readonly onCreated: (project: Project) => void;
}

function projectError(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

export function ProjectPicker(props: ProjectPickerProps) {
  const selected = props.projects.find((project) => project.id === props.projectId);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setQuery(selected?.name ?? props.projectId);
  }, [props.projectId, selected?.name]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (needle.length === 0) return props.projects;
    return props.projects.filter((project) =>
      `${project.name}\n${project.id}`.toLocaleLowerCase("id-ID").includes(needle),
    );
  }, [props.projects, query]);

  function choose(project: Project): void {
    props.onChoose(project.id);
    setQuery(project.name);
    setOpen(false);
    setFeedback(null);
  }

  async function createProject(event: FormEvent): Promise<void> {
    event.preventDefault();
    const name = newName.trim();
    if (name.length === 0 || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: props.workspaceId, name }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null) {
        throw new Error(\n          projectError(body, `Project create gagal (HTTP ${String(response.status)}).`),\n        );
      }
      const project = body as Project;
      props.onCreated(project);
      setNewName("");
      setCreating(false);
      setOpen(false);
      setQuery(project.name);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Project create gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.projectPicker}>
      <span>Project</span>
      <div className={styles.projectCombobox}>
        <input
          role="combobox"
          aria-label="Search Project"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="work-project-options"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(selected?.name ?? props.projectId);
            }
            if (event.key === "Enter" && open && filtered.length === 1) {
              event.preventDefault();
              const only = filtered[0];
              if (only !== undefined) choose(only);
            }
          }}
        />
        <button
          type="button"
          aria-label="Toggle Project options"
          onClick={() => setOpen((current) => !current)}
        >
          ▾
        </button>
      </div>

      {open ? (
        <div className={styles.projectOptions} id="work-project-options" role="listbox">
          {filtered.map((project) => (
            <button
              type="button"
              role="option"
              aria-selected={project.id === props.projectId}
              key={project.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(project)}
            >
              <strong>{project.name}</strong>
              <small>{project.id}</small>
            </button>
          ))}
          {filtered.length === 0 ? <span>No matching Project</span> : null}
          <button
            type="button"
            className={styles.projectCreateToggle}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setCreating(true);
              setOpen(false);
              setFeedback(null);
            }}
          >
            + New Project
          </button>
        </div>
      ) : null}

      {creating ? (
        <form className={styles.projectCreateInline} onSubmit={createProject}>
          <input
            autoFocus
            aria-label="New Project name"
            value={newName}
            maxLength={160}
            placeholder="Project name"
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" disabled={busy || newName.trim().length === 0}>
            {busy ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCreating(false);
              setNewName("");
              setFeedback(null);
            }}
          >
            Cancel
          </button>
        </form>
      ) : null}

      <small>{selected?.id ?? props.projectId}</small>
      {feedback !== null ? (\n        <small className={styles.projectPickerError}>{feedback}</small>\n      ) : null}
    </div>
  );
}
