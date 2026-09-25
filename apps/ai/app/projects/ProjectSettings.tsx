"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Project, ProjectAutonomyCeiling } from "@ecorione/shared-schema";
import styles from "./Projects.module.css";

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : fallback;
}

export function ProjectSettings(props: {
  readonly project: Project;
  readonly onSaved: (project: Project) => void;
}): React.JSX.Element {
  const [name, setName] = useState(props.project.name);
  const [description, setDescription] = useState(props.project.description);
  const [instruction, setInstruction] = useState(props.project.instruction);
  const [autonomyCeiling, setAutonomyCeiling] = useState<ProjectAutonomyCeiling>(
    props.project.autonomyCeiling,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setName(props.project.name);
    setDescription(props.project.description);
    setInstruction(props.project.instruction);
    setAutonomyCeiling(props.project.autonomyCeiling);
    setFeedback(null);
  }, [props.project]);

  const dirty = useMemo(
    () =>
      name.trim() !== props.project.name ||
      description !== props.project.description ||
      instruction !== props.project.instruction ||
      autonomyCeiling !== props.project.autonomyCeiling,
    [autonomyCeiling, description, instruction, name, props.project],
  );

  function reset(): void {
    setName(props.project.name);
    setDescription(props.project.description);
    setInstruction(props.project.instruction);
    setAutonomyCeiling(props.project.autonomyCeiling);
    setFeedback(null);
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !dirty || name.trim().length === 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(props.project.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceId: props.project.workspaceId,
            name: name.trim(),
            description,
            instruction,
            autonomyCeiling,
          }),
        },
      );
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(errorMessage(body, "Gagal menyimpan Project settings."));
      }
      const updated = body as Project;
      props.onSaved(updated);
      setFeedback("Project settings disimpan.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Gagal menyimpan Project settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.settings}>
      <div className={styles.settingsHeader}>
        <div>
          <h3>Project settings</h3>
          <p>Atur konteks Project tanpa mengubah boundary Workspace atau owner data.</p>
        </div>
      </div>

      <form className={styles.settingsForm} onSubmit={save}>
        <label>
          <span>Name</span>
          <input
            className="ecr-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={160}
            required
          />
        </label>

        <label>
          <span>Description</span>
          <textarea
            className="ecr-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2048}
            rows={3}
            placeholder="Apa tujuan Project ini?"
          />
        </label>

        <label>
          <span>Project instruction</span>
          <textarea
            className="ecr-input"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            maxLength={8000}
            rows={5}
            placeholder="Instruksi yang berlaku saat AI bekerja di Project ini."
          />
        </label>

        <label>
          <span>Autonomy ceiling</span>
          <select
            className="ecr-input"
            value={autonomyCeiling}
            onChange={(event) =>
              setAutonomyCeiling(event.target.value as ProjectAutonomyCeiling)
            }
          >
            <option value="L0">L0</option>
            <option value="L1">L1</option>
            <option value="L2">L2</option>
            <option value="L3">L3</option>
          </select>
          <small>Batas maksimum autonomy request untuk Project ini. V1 berhenti di L3.</small>
        </label>

        <div className={styles.readonlySetting}>
          <span>Memory policy</span>
          <strong>{props.project.memoryPolicy}</strong>
          <small>
            Fixed V1 policy. Global memory yang berizin + memory Project aktif; sibling
            Project tidak digabung otomatis.
          </small>
        </div>

        <div className={styles.settingsActions}>
          <button
            className="ecr-btn ecr-btn--primary"
            type="submit"
            disabled={busy || !dirty || name.trim().length === 0}
          >
            {busy ? "Menyimpan..." : "Simpan settings"}
          </button>
          <button
            className="ecr-btn ecr-btn--secondary"
            type="button"
            disabled={busy || !dirty}
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </form>

      {feedback !== null ? <p className={styles.settingsFeedback}>{feedback}</p> : null}
    </section>
  );
}
