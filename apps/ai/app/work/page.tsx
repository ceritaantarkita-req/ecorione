"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  FlowGraphSummary,
  Project,
  RunListItem,
  RunProjection,
  TriggerDefinition,
  TriggerScheduleRuntime,
} from "@ecorione/shared-schema";
import styles from "./Work.module.css";

const WORKSPACE_ID = "ws_personal";
const PERSONAL_PROJECT_ID = "prj_personal";
const PROJECT_STORAGE_KEY = "ecorione.projectId";

type WorkTab = "schedule" | "flows" | "runs";
type CalendarMode = "list" | "day" | "week" | "month";
type TimeConfig = {
  cronExpression: string;
  timezone: string;
  catchupWindowMs: number;
  overlap: "SKIP" | "QUEUE_ONE";
};

type ScheduleDraft = {
  id: string | null;
  revision: number | null;
  name: string;
  graphId: string;
  graphVersion: number;
  requestedAutonomy: "L0" | "L1" | "L2" | "L3";
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  catchupWindowMs: number;
  overlap: "SKIP" | "QUEUE_ONE";
};

const EMPTY_DRAFT: ScheduleDraft = {
  id: null,
  revision: null,
  name: "",
  graphId: "",
  graphVersion: 1,
  requestedAutonomy: "L2",
  enabled: true,
  cronExpression: "0 8 * * *",
  timezone: "Asia/Jakarta",
  catchupWindowMs: 60_000,
  overlap: "SKIP",
};

function errorMessage(body: unknown, fallback: string): string {
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

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || body === null) {
    throw new Error(errorMessage(body, `HTTP ${String(response.status)}`));
  }
  return body;
}

function timeConfig(trigger: TriggerDefinition): TimeConfig | null {
  if (trigger.kind !== "time") return null;
  const config = trigger.configuration as Partial<TimeConfig>;
  if (
    typeof config.cronExpression !== "string" ||
    typeof config.timezone !== "string" ||
    typeof config.catchupWindowMs !== "number" ||
    (config.overlap !== "SKIP" && config.overlap !== "QUEUE_ONE")
  ) {
    return null;
  }
  return {
    cronExpression: config.cronExpression,
    timezone: config.timezone,
    catchupWindowMs: config.catchupWindowMs,
    overlap: config.overlap,
  };
}

function draftFromTrigger(trigger: TriggerDefinition): ScheduleDraft {
  const config = timeConfig(trigger);
  if (config === null) return EMPTY_DRAFT;
  return {
    id: trigger.id,
    revision: trigger.revision,
    name: trigger.name,
    graphId: trigger.graphId,
    graphVersion: trigger.graphVersion,
    requestedAutonomy: trigger.requestedAutonomy,
    enabled: trigger.enabled,
    ...config,
  };
}

function statusClass(status: string): string {
  const key = status.toLowerCase().replaceAll("_", "-");
  return `${styles.status} ${styles[`status_${key}`] ?? ""}`;
}

function formatWhen(iso: string, timezone = "Asia/Jakarta"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

function periodBounds(mode: Exclude<CalendarMode, "list">): [number, number] {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (mode === "day") {
    start.setHours(0, 0, 0, 0);
    end.setHours(24, 0, 0, 0);
  } else if (mode === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  }
  return [start.getTime(), end.getTime()];
}

export default function WorkPage() {
  const [tab, setTab] = useState<WorkTab>("schedule");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("list");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(PERSONAL_PROJECT_ID);
  const [triggers, setTriggers] = useState<TriggerDefinition[]>([]);
  const [graphs, setGraphs] = useState<FlowGraphSummary[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runtimes, setRuntimes] = useState<Record<string, TriggerScheduleRuntime | null>>({});
  const [selectedRun, setSelectedRun] = useState<RunProjection | null>(null);
  const [runTriggerFilter, setRunTriggerFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("Work membaca owner state langsung dari Flow, Temporal, Hub, dan RnD.");
  const requestRef = useRef(0);

  const timeTriggers = useMemo(
    () => triggers.filter((trigger) => trigger.kind === "time"),
    [triggers],
  );

  const occurrences = useMemo(() => {
    const rows: Array<{
      trigger: TriggerDefinition;
      timezone: string;
      when: string;
    }> = [];
    for (const trigger of timeTriggers) {
      const runtime = runtimes[trigger.id];
      const config = timeConfig(trigger);
      if (runtime === null || runtime === undefined || config === null) continue;
      for (const when of runtime.nextActionTimes) {
        rows.push({ trigger, timezone: config.timezone, when });
      }
    }
    return rows.sort((a, b) => a.when.localeCompare(b.when));
  }, [runtimes, timeTriggers]);

  const visibleRuns = useMemo(
    () =>
      runTriggerFilter === null
        ? runs
        : runs.filter((run) => run.triggerId === runTriggerFilter),
    [runTriggerFilter, runs],
  );

  const visibleOccurrences = useMemo(() => {
    if (calendarMode === "list") return occurrences;
    const [start, end] = periodBounds(calendarMode);
    return occurrences.filter((row) => {
      const value = new Date(row.when).getTime();
      return value >= start && value < end;
    });
  }, [calendarMode, occurrences]);

  const loadWork = useCallback(async (nextProjectId: string) => {
    const seq = ++requestRef.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        workspaceId: WORKSPACE_ID,
        projectId: nextProjectId,
      });
      const [triggerBody, graphBody, runBody] = await Promise.all([
        fetch(`/api/flow/triggers?${query}`, { cache: "no-store" }).then((response) =>
          json<{ triggers: TriggerDefinition[] }>(response),
        ),
        fetch(`/api/flow/graphs?${query}`, { cache: "no-store" }).then((response) =>
          json<{ graphs: FlowGraphSummary[] }>(response),
        ),
        fetch(`/api/flow/runs?${query}&limit=50`, { cache: "no-store" }).then((response) =>
          json<{ runs: RunListItem[] }>(response),
        ),
      ]);
      if (seq !== requestRef.current) return;
      setTriggers(triggerBody.triggers);
      setGraphs(graphBody.graphs);
      setRuns(runBody.runs);
      setSelectedRun(null);
      setRunTriggerFilter(null);

      const time = triggerBody.triggers.filter((trigger) => trigger.kind === "time");
      const runtimeEntries = await Promise.all(
        time.map(async (trigger) => {
          try {
            const runtime = await fetch(
              `/api/flow/triggers/${encodeURIComponent(trigger.id)}/schedule?${query}`,
              { cache: "no-store" },
            ).then((response) => json<TriggerScheduleRuntime>(response));
            return [trigger.id, runtime] as const;
          } catch {
            return [trigger.id, null] as const;
          }
        }),
      );
      if (seq === requestRef.current) setRuntimes(Object.fromEntries(runtimeEntries));
    } catch (reason) {
      if (seq !== requestRef.current) return;
      const detail = reason instanceof Error ? reason.message : String(reason);
      setMessage(`Work load gagal: ${detail}`);
      setTriggers([]);
      setGraphs([]);
      setRuns([]);
      setRuntimes({});
    } finally {
      if (seq === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let chosen = PERSONAL_PROJECT_ID;
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (stored !== null && /^prj_[a-z0-9][a-z0-9_-]*$/.test(stored)) chosen = stored;
    } catch {
      // Personal remains the safe fallback.
    }
    setProjectId(chosen);
    void fetch(`/api/projects?workspaceId=${WORKSPACE_ID}`, { cache: "no-store" })
      .then((response) => json<{ projects: Project[] }>(response))
      .then((body) => setProjects(body.projects.filter((project) => project.archivedAt === null)))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    void loadWork(projectId);
  }, [loadWork, projectId]);

  function chooseProject(next: string): void {
    setProjectId(next);
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, next);
    } catch {
      // Selection remains usable for this page even without persistent browser storage.
    }
  }

  function startCreate(): void {
    const first = graphs[0];
    setDraft({
      ...EMPTY_DRAFT,
      graphId: first?.graphId ?? "",
      graphVersion: first?.currentVersion ?? 1,
    });
    setEditing(true);
    setMessage("Buat Schedule baru dengan exact pinned Flow version.");
  }

  function startEdit(trigger: TriggerDefinition): void {
    setDraft(draftFromTrigger(trigger));
    setEditing(true);
    setMessage(`Mengedit ${trigger.name}. Perubahan tetap melewati Hub policy.`);
  }

  function cancelEdit(): void {
    setDraft(EMPTY_DRAFT);
    setEditing(false);
  }

  async function saveSchedule(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending !== null || draft.graphId.length === 0) return;
    setPending("save");
    try {
      const base = {
        workspaceId: WORKSPACE_ID,
        projectId,
        name: draft.name,
        kind: "time" as const,
        graphId: draft.graphId,
        graphVersion: draft.graphVersion,
        versionPolicy: "PINNED" as const,
        requestedAutonomy: draft.requestedAutonomy,
        enabled: draft.enabled,
        configuration: {
          cronExpression: draft.cronExpression,
          timezone: draft.timezone,
          catchupWindowMs: draft.catchupWindowMs,
          overlap: draft.overlap,
        },
      };
      const target =
        draft.id === null ? "/api/flow/triggers" : `/api/flow/triggers/${encodeURIComponent(draft.id)}`;
      const response = await fetch(target, {
        method: draft.id === null ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          draft.id === null ? base : { ...base, expectedRevision: draft.revision ?? 1 },
        ),
      });
      await json<TriggerDefinition>(response);
      setEditing(false);
      setDraft(EMPTY_DRAFT);
      setMessage(draft.id === null ? "Schedule dibuat." : "Schedule diperbarui.");
      await loadWork(projectId);
    } catch (reason) {
      setMessage(`Schedule save gagal: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setPending(null);
    }
  }

  async function setEnabled(trigger: TriggerDefinition, enabled: boolean): Promise<void> {
    if (pending !== null) return;
    setPending(trigger.id);
    try {
      const response = await fetch(
        `/api/flow/triggers/${encodeURIComponent(trigger.id)}/${enabled ? "enable" : "disable"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
            projectId,
            expectedRevision: trigger.revision,
          }),
        },
      );
      await json<TriggerDefinition>(response);
      setMessage(enabled ? "Schedule diaktifkan." : "Schedule dijeda.");
      await loadWork(projectId);
    } catch (reason) {
      setMessage(`Schedule state gagal: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setPending(null);
    }
  }

  async function openRun(operationId: string): Promise<void> {
    if (pending !== null) return;
    setPending(operationId);
    try {
      const run = await fetch(`/api/flow/runs/${encodeURIComponent(operationId)}`, {
        cache: "no-store",
      }).then((response) => json<RunProjection>(response));
      setSelectedRun(run);
      setMessage(`Run ${operationId} dibaca dari owner projection.`);
    } catch (reason) {
      setMessage(`Run detail gagal: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setPending(null);
    }
  }

  const selectedProject = projects.find((project) => project.id === projectId);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ECORIONE · governed execution</span>
          <h1>Work</h1>
          <p>Rencana, Flow, dan execution evidence dalam satu Project boundary.</p>
        </div>
        <label className={styles.projectPicker}>
          <span>Project</span>
          <select value={projectId} onChange={(event) => chooseProject(event.target.value)}>
            {projects.length === 0 ? (
              <option value={PERSONAL_PROJECT_ID}>Personal</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
          <small>{selectedProject?.id ?? projectId}</small>
        </label>
      </header>

      <nav className={styles.tabs} aria-label="Work views">
        {(["schedule", "flows", "runs"] as const).map((value) => (
          <button
            type="button"
            key={value}
            className={tab === value ? styles.tabActive : undefined}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "schedule" ? "Schedule" : value === "flows" ? "Flows" : "Runs"}
          </button>
        ))}
      </nav>

      <div className={styles.notice} role="status">
        <span>{loading ? "Refreshing owner state…" : message}</span>
        <button type="button" disabled={loading} onClick={() => void loadWork(projectId)}>
          Refresh
        </button>
      </div>

      {tab === "schedule" ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>Temporal-backed</span>
              <h2>Schedule</h2>
              <p>Schedule hanyalah view/editor untuk time Trigger; Temporal tetap runtime truth.</p>
            </div>
            <button type="button" onClick={startCreate} disabled={graphs.length === 0}>
              New schedule
            </button>
          </div>

          <div className={styles.viewSwitch} aria-label="Schedule view">
            {(["list", "day", "week", "month"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={calendarMode === mode}
                className={calendarMode === mode ? styles.viewActive : undefined}
                onClick={() => setCalendarMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          {editing ? (
            <form className={styles.editor} onSubmit={saveSchedule}>
              <div className={styles.editorTitle}>
                <strong>{draft.id === null ? "New schedule" : "Edit schedule"}</strong>
                <button type="button" onClick={cancelEdit}>Cancel</button>
              </div>
              <label>
                Name
                <input
                  required
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Flow
                <select
                  value={draft.graphId}
                  onChange={(event) => {
                    const graph = graphs.find((item) => item.graphId === event.target.value);
                    setDraft((current) => ({
                      ...current,
                      graphId: event.target.value,
                      graphVersion: graph?.currentVersion ?? current.graphVersion,
                    }));
                  }}
                >
                  <option value="">Select Flow</option>
                  {graphs.map((graph) => (
                    <option key={graph.graphId} value={graph.graphId}>
                      {graph.name} · v{graph.currentVersion}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pinned version
                <input
                  type="number"
                  min={1}
                  value={draft.graphVersion}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      graphVersion: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                />
              </label>
              <label>
                Cron
                <input
                  required
                  value={draft.cronExpression}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, cronExpression: event.target.value }))
                  }
                />
              </label>
              <label>
                IANA timezone
                <input
                  required
                  value={draft.timezone}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, timezone: event.target.value }))
                  }
                />
              </label>
              <label>
                Catch-up
                <select
                  value={draft.catchupWindowMs}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      catchupWindowMs: Number(event.target.value),
                    }))
                  }
                >
                  <option value={60_000}>1 minute</option>
                  <option value={5 * 60_000}>5 minutes</option>
                  <option value={60 * 60_000}>1 hour</option>
                  <option value={24 * 60 * 60_000}>24 hours</option>
                </select>
              </label>
              <label>
                Overlap
                <select
                  value={draft.overlap}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      overlap: event.target.value as "SKIP" | "QUEUE_ONE",
                    }))
                  }
                >
                  <option value="SKIP">SKIP</option>
                  <option value="QUEUE_ONE">QUEUE_ONE</option>
                </select>
              </label>
              <label>
                Autonomy request
                <select
                  value={draft.requestedAutonomy}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      requestedAutonomy: event.target.value as ScheduleDraft["requestedAutonomy"],
                    }))
                  }
                >
                  <option value="L0">L0</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                </select>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                Enabled
              </label>
              <button type="submit" disabled={pending !== null || draft.graphId.length === 0}>
                {pending === "save" ? "Saving…" : "Save schedule"}
              </button>
            </form>
          ) : null}

          {calendarMode === "list" ? (
            <div className={styles.cardGrid}>
              {timeTriggers.map((trigger) => {
                const config = timeConfig(trigger);
                const runtime = runtimes[trigger.id];
                const relatedRuns = runs.filter((run) => run.triggerId === trigger.id).length;
                return (
                  <article className={styles.card} key={trigger.id}>
                    <div className={styles.cardHead}>
                      <div>
                        <strong>{trigger.name}</strong>
                        <code>{trigger.id}</code>
                      </div>
                      <span className={trigger.enabled ? styles.live : styles.paused}>
                        {runtime === null
                          ? "runtime unavailable"
                          : runtime?.paused
                            ? "paused"
                            : trigger.enabled
                              ? "active"
                              : "disabled"}
                      </span>
                    </div>
                    <dl className={styles.meta}>
                      <div><dt>Cron</dt><dd>{config?.cronExpression ?? "—"}</dd></div>
                      <div><dt>Timezone</dt><dd>{config?.timezone ?? "—"}</dd></div>
                      <div><dt>Flow</dt><dd>{trigger.graphId} · v{trigger.graphVersion}</dd></div>
                      <div><dt>Overlap</dt><dd>{config?.overlap ?? "—"}</dd></div>
                      <div><dt>Runs</dt><dd>{relatedRuns}</dd></div>
                      <div>
                        <dt>Next</dt>
                        <dd>
                          {runtime?.nextActionTimes[0] === undefined
                            ? "—"
                            : formatWhen(runtime.nextActionTimes[0], config?.timezone)}
                        </dd>
                      </div>
                    </dl>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => startEdit(trigger)}>Edit</button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void setEnabled(trigger, !trigger.enabled)}
                      >
                        {trigger.enabled ? "Disable" : "Enable"}
                      </button>
                      <Link href={`/flow?graph=${encodeURIComponent(trigger.graphId)}&version=${String(trigger.graphVersion)}`}>
                        Open Flow
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setRunTriggerFilter(trigger.id);
                          setSelectedRun(null);
                          setTab("runs");
                          setMessage(`Runs linked to ${trigger.name}: ${String(relatedRuns)}`);
                        }}
                      >
                        Runs
                      </button>
                    </div>
                  </article>
                );
              })}
              {!loading && timeTriggers.length === 0 ? (
                <div className={styles.empty}>Belum ada time Trigger di Project ini.</div>
              ) : null}
            </div>
          ) : (
            <div className={styles.timeline}>
              <div className={styles.timelineHead}>
                <strong>{calendarMode.toUpperCase()}</strong>
                <span>{visibleOccurrences.length} upcoming occurrence(s) exposed by Temporal</span>
              </div>
              {visibleOccurrences.map((row) => (
                <article key={`${row.trigger.id}-${row.when}`} className={styles.occurrence}>
                  <time dateTime={row.when}>{formatWhen(row.when, row.timezone)}</time>
                  <div>
                    <strong>{row.trigger.name}</strong>
                    <span>{row.timezone} · {row.trigger.graphId} v{row.trigger.graphVersion}</span>
                  </div>
                </article>
              ))}
              {visibleOccurrences.length === 0 ? (
                <div className={styles.empty}>Tidak ada occurrence Temporal pada window ini.</div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {tab === "flows" ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>Existing owner</span>
              <h2>Flows</h2>
              <p>Work menavigasi Flow; editor dan version truth tetap dimiliki Flow.</p>
            </div>
            <Link className={styles.primaryLink} href="/flow">Open Flow editor</Link>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr><th>Name</th><th>Version</th><th>Sensitivity</th><th>Updated</th><th /></tr>
              </thead>
              <tbody>
                {graphs.map((graph) => (
                  <tr key={graph.graphId}>
                    <td><strong>{graph.name}</strong><code>{graph.graphId}</code></td>
                    <td>v{graph.currentVersion}</td>
                    <td>{graph.sensitivity}</td>
                    <td>{formatWhen(graph.updatedAt)}</td>
                    <td>
                      <Link href={`/flow?graph=${encodeURIComponent(graph.graphId)}&version=${String(graph.currentVersion)}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && graphs.length === 0 ? <div className={styles.empty}>Belum ada Flow.</div> : null}
          </div>
        </section>
      ) : null}

      {tab === "runs" ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>ADR-37 projection</span>
              <h2>Runs</h2>
              <p>Key = operationId. Tidak ada execution database kedua.</p>
            </div>
          </div>
          {runTriggerFilter !== null ? (
            <div className={styles.filterBar}>
              <span>Trigger filter: <code>{runTriggerFilter}</code></span>
              <button type="button" onClick={() => setRunTriggerFilter(null)}>Clear filter</button>
            </div>
          ) : null}
          <div className={styles.runLayout}>
            <div className={styles.runList}>
              {visibleRuns.map((run) => (
                <button
                  type="button"
                  key={run.operationId}
                  className={
                    selectedRun?.operationId === run.operationId
                      ? `${styles.runRow} ${styles.runRowActive}`
                      : styles.runRow
                  }
                  onClick={() => void openRun(run.operationId)}
                >
                  <span className={statusClass(run.status)}>{run.status}</span>
                  <strong>{run.graphId} · v{run.graphVersion}</strong>
                  <code>{run.operationId}</code>
                  <small>{formatWhen(run.startedAt)}</small>
                </button>
              ))}
              {!loading && visibleRuns.length === 0 ? (
                <div className={styles.empty}>
                  {runTriggerFilter === null
                    ? "Belum ada Run lifecycle evidence di Project ini."
                    : "Belum ada Run untuk Trigger ini pada projection saat ini."}
                </div>
              ) : null}
            </div>

            <aside className={styles.runDetail}>
              {selectedRun === null ? (
                <div className={styles.empty}>Pilih Run untuk melihat owner evidence.</div>
              ) : (
                <>
                  <div className={styles.cardHead}>
                    <div>
                      <span className={statusClass(selectedRun.status)}>{selectedRun.status}</span>
                      <h3>{selectedRun.graphId} · v{selectedRun.graphVersion}</h3>
                      <code>{selectedRun.operationId}</code>
                    </div>
                    <Link href={`/flow?graph=${encodeURIComponent(selectedRun.graphId)}&version=${String(selectedRun.graphVersion)}`}>
                      Flow
                    </Link>
                  </div>
                  <dl className={styles.meta}>
                    <div><dt>Trigger</dt><dd>{selectedRun.triggerId ?? "Direct run"}</dd></div>
                    <div><dt>Workflow</dt><dd>{selectedRun.temporalWorkflowId}</dd></div>
                    <div><dt>Started</dt><dd>{formatWhen(selectedRun.startedAt)}</dd></div>
                    <div><dt>Finished</dt><dd>{selectedRun.finishedAt ? formatWhen(selectedRun.finishedAt) : "—"}</dd></div>
                    <div><dt>Actual cost</dt><dd>{selectedRun.cost === null ? "—" : `$${selectedRun.cost.totalActualUsd.toFixed(6)}`}</dd></div>
                    <div><dt>Model calls</dt><dd>{selectedRun.cost?.callCount ?? "—"}</dd></div>
                  </dl>

                  <div className={styles.availability}>
                    {Object.entries(selectedRun.availability).map(([owner, available]) => (
                      <span key={owner} className={available ? styles.live : styles.paused}>
                        {owner}: {available ? "available" : "partial"}
                      </span>
                    ))}
                  </div>

                  <details open>
                    <summary>Output</summary>
                    <pre>{JSON.stringify(selectedRun.output, null, 2)}</pre>
                  </details>
                  <details>
                    <summary>Approvals ({selectedRun.approvals.length})</summary>
                    <div className={styles.detailList}>
                      {selectedRun.approvals.map((approval) => (
                        <article key={approval.operationId}>
                          <strong>{approval.status}</strong>
                          <code>{approval.operationId}</code>
                          <span>{approval.prompt ?? "No prompt"}</span>
                          {approval.note ? <span>Note: {approval.note}</span> : null}
                        </article>
                      ))}
                    </div>
                  </details>
                  <details>
                    <summary>Audit actions ({selectedRun.actions.length})</summary>
                    <div className={styles.detailList}>
                      {selectedRun.actions.map((action) => (
                        <article key={action.id}>
                          <strong>{action.type}</strong>
                          <span>{action.module} · {formatWhen(action.ts)}</span>
                          <code>{action.operationId ?? "no operation"}</code>
                        </article>
                      ))}
                    </div>
                  </details>
                  {selectedRun.errors.length > 0 ? (
                    <div className={styles.errors}>
                      {selectedRun.errors.map((error) => <p key={error}>{error}</p>)}
                    </div>
                  ) : null}
                </>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </main>
  );
}
