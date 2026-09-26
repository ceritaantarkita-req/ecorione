"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  FlowGraphSummary,
  Project,
  RunListItem,
  RunProjection,
  ScheduleAssistResponse,
  TriggerDefinition,
  TriggerScheduleRuntime,
} from "@ecorione/shared-schema";
import {
  PERSONAL_PROJECT_ID,
  PROJECT_STORAGE_KEY,
  activeProjects,
  isProjectIdCandidate,
  resolveActiveProjectId,
} from "../../lib/project-selection";
import { useWorkspace } from "../WorkspaceProvider";
import { ProjectPicker } from "./ProjectPicker";
import { FlowSection, RunsSection, ScheduleSection } from "./WorkPageSections";
import styles from "./Work.module.css";
import {
  shiftCalendarCursor,
  todayDateKey,
  type CalendarMode,
  type ScheduleOccurrence,
} from "./work-calendar";
import {
  EMPTY_DRAFT,
  draftFromTrigger,
  json,
  timeConfig,
  type ScheduleDraft,
  type WorkTab,
} from "./work-page-model";

export default function WorkPage() {
  const { workspaceId, ready: workspaceReady } = useWorkspace();
  const [tab, setTab] = useState<WorkTab>("schedule");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("list");
  const [calendarTimezone, setCalendarTimezone] = useState("Asia/Jakarta");
  const [calendarCursor, setCalendarCursor] = useState(() => todayDateKey("Asia/Jakarta"));
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(PERSONAL_PROJECT_ID);
  const [projectReady, setProjectReady] = useState(false);
  const [triggers, setTriggers] = useState<TriggerDefinition[]>([]);
  const [graphs, setGraphs] = useState<FlowGraphSummary[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [runtimes, setRuntimes] = useState<Record<string, TriggerScheduleRuntime | null>>({});
  const [selectedRun, setSelectedRun] = useState<RunProjection | null>(null);
  const [runTriggerFilter, setRunTriggerFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft>(EMPTY_DRAFT);
  const [assistIntent, setAssistIntent] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState(
    "Work membaca owner state langsung dari Flow, Temporal, Hub, dan RnD.",
  );
  const requestRef = useRef(0);

  const timeTriggers = useMemo(
    () => triggers.filter((trigger) => trigger.kind === "time"),
    [triggers],
  );

  const occurrences = useMemo(() => {
    const rows: ScheduleOccurrence[] = [];
    for (const trigger of timeTriggers) {
      const runtime = runtimes[trigger.id];
      const config = timeConfig(trigger);
      if (runtime === null || runtime === undefined || config === null) continue;
      for (const when of runtime.nextActionTimes) {
        rows.push({
          triggerId: trigger.id,
          triggerName: trigger.name,
          graphId: trigger.graphId,
          graphVersion: trigger.graphVersion,
          sourceTimezone: config.timezone,
          when,
        });
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

  const loadWork = useCallback(
    async (nextProjectId: string) => {
      const seq = ++requestRef.current;
      setLoading(true);
      try {
        const query = new URLSearchParams({
          workspaceId: workspaceId,
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
    },
    [workspaceId],
  );

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected.length > 0) {
        setCalendarTimezone(detected);
        setCalendarCursor(todayDateKey(detected));
      }
    } catch {
      // Asia/Jakarta remains the deterministic product fallback.
    }
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    let cancelled = false;
    setProjectReady(false);
    let candidate: string | null = null;
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (isProjectIdCandidate(stored)) candidate = stored;
    } catch {
      // The active Project list remains the source of truth.
    }

    void fetch(`/api/projects?workspaceId=${workspaceId}`, { cache: "no-store" })
      .then((response) => json<{ projects: Project[] }>(response))
      .then((body) => {
        if (cancelled) return;
        const active = activeProjects(body.projects);
        const chosen = resolveActiveProjectId(candidate, active);
        setProjects(active);
        if (chosen === null) {
          setProjectReady(false);
          setMessage("Work tidak menemukan Project aktif.");
          return;
        }
        setProjectId(chosen);
        setProjectReady(true);
        try {
          window.localStorage.setItem(PROJECT_STORAGE_KEY, chosen);
        } catch {
          // In-memory selection still uses the reconciled active Project.
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProjects([]);
        setProjectReady(false);
        setMessage("Work gagal memuat daftar Project aktif.");
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceReady]);

  useEffect(() => {
    if (!projectReady) return;
    void loadWork(projectId);
  }, [loadWork, projectId, projectReady]);

  function chooseProject(next: string): void {
    const chosen = resolveActiveProjectId(next, projects);
    if (chosen === null) return;
    setProjectId(chosen);
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, chosen);
    } catch {
      // Selection remains usable for this page even without persistent browser storage.
    }
  }

  function useCreatedProject(project: Project): void {
    setProjects((current) => [
      ...current.filter((candidate) => candidate.id !== project.id),
      project,
    ]);
    setProjectId(project.id);
    setProjectReady(true);
    setEditing(false);
    setDraft(EMPTY_DRAFT);
    setAssistIntent("");
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, project.id);
    } catch {
      // Owner selection remains valid for this page without browser persistence.
    }
    setMessage(`Project ${project.name} dibuat dan dipilih.`);
  }

  function startCreate(): void {
    const first = graphs[0];
    setDraft({
      ...EMPTY_DRAFT,
      graphId: first?.graphId ?? "",
      graphVersion: first?.currentVersion ?? 1,
    });
    setAssistIntent("");
    setEditing(true);
    setMessage("Buat Schedule baru dengan exact pinned Flow version.");
  }

  function startEdit(trigger: TriggerDefinition): void {
    setDraft(draftFromTrigger(trigger));
    setAssistIntent("");
    setEditing(true);
    setMessage(`Mengedit ${trigger.name}. Perubahan tetap melewati Hub policy.`);
  }

  function cancelEdit(): void {
    setDraft(EMPTY_DRAFT);
    setAssistIntent("");
    setEditing(false);
  }

  async function assistSchedule(): Promise<void> {
    const intent = assistIntent.trim();
    if (pending !== null || intent.length < 3) return;
    setPending("assist");
    try {
      const response = await fetch("/api/work/schedule-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspaceId,
          projectId,
          intent,
          current: {
            name: draft.name,
            graphId: draft.graphId.length === 0 ? null : draft.graphId,
            graphVersion: draft.graphVersion,
            requestedAutonomy: draft.requestedAutonomy,
            enabled: draft.enabled,
            configuration: {
              cronExpression: draft.cronExpression,
              timezone: draft.timezone,
              catchupWindowMs: draft.catchupWindowMs,
              overlap: draft.overlap,
            },
          },
        }),
      });
      const assisted = await json<ScheduleAssistResponse>(response);
      setDraft((current) => ({
        ...current,
        name: assisted.draft.name,
        graphId: assisted.draft.graphId,
        graphVersion: assisted.draft.graphVersion,
        requestedAutonomy: assisted.draft.requestedAutonomy,
        enabled: assisted.draft.enabled,
        cronExpression: assisted.draft.configuration.cronExpression,
        timezone: assisted.draft.configuration.timezone,
        catchupWindowMs: assisted.draft.configuration.catchupWindowMs,
        overlap: assisted.draft.configuration.overlap,
      }));
      setMessage(`${assisted.summary} Review draft lalu Save untuk mengubah Trigger.`);
    } catch (reason) {
      setMessage(
        `Schedule assist gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    } finally {
      setPending(null);
    }
  }

  async function saveSchedule(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending !== null || draft.graphId.length === 0) return;
    setPending("save");
    try {
      const base = {
        workspaceId: workspaceId,
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
        draft.id === null
          ? "/api/flow/triggers"
          : `/api/flow/triggers/${encodeURIComponent(draft.id)}`;
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
      setMessage(
        `Schedule save gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
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
            workspaceId: workspaceId,
            projectId,
            expectedRevision: trigger.revision,
          }),
        },
      );
      await json<TriggerDefinition>(response);
      setMessage(enabled ? "Schedule diaktifkan." : "Schedule dijeda.");
      await loadWork(projectId);
    } catch (reason) {
      setMessage(
        `Schedule state gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    } finally {
      setPending(null);
    }
  }

  async function openRun(operationId: string): Promise<void> {
    if (pending !== null) return;
    setPending(operationId);
    try {
      const query = new URLSearchParams({
        workspaceId: workspaceId,
        projectId,
      });
      const run = await fetch(`/api/flow/runs/${encodeURIComponent(operationId)}?${query}`, {
        cache: "no-store",
      }).then((response) => json<RunProjection>(response));
      setSelectedRun(run);
      setMessage(`Run ${operationId} dibaca dari owner projection.`);
    } catch (reason) {
      setMessage(
        `Run detail gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Plan and run</span>
          <h1>Work</h1>
          <p>Atur jadwal, Flow, dan hasil eksekusi untuk Project aktif.</p>
        </div>
        <ProjectPicker
          workspaceId={workspaceId}
          projects={projects}
          projectId={projectId}
          onChoose={chooseProject}
          onCreated={useCreatedProject}
        />
      </header>

      <nav className={styles.tabs} aria-label="Work views">
        {(["schedule", "flows", "runs"] as const).map((value) => (
          <button
            type="button"
            key={value}
            className={tab === value ? styles.tabActive : undefined}
            aria-pressed={tab === value}
            onClick={() => {
              if (value === "runs") {
                setRunTriggerFilter(null);
                setSelectedRun(null);
              }
              setTab(value);
            }}
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
        <ScheduleSection
          loading={loading}
          graphs={graphs}
          timeTriggers={timeTriggers}
          runtimes={runtimes}
          runs={runs}
          editing={editing}
          draft={draft}
          assistIntent={assistIntent}
          pending={pending}
          calendarMode={calendarMode}
          calendarCursor={calendarCursor}
          calendarTimezone={calendarTimezone}
          occurrences={occurrences}
          onStartCreate={startCreate}
          onCancelEdit={cancelEdit}
          onSaveSchedule={saveSchedule}
          onAssistIntentChange={setAssistIntent}
          onAssistSchedule={() => void assistSchedule()}
          onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onStartEdit={startEdit}
          onSetEnabled={(trigger, enabled) => void setEnabled(trigger, enabled)}
          onOpenRuns={(triggerId, triggerName, relatedRuns) => {
            setRunTriggerFilter(triggerId);
            setSelectedRun(null);
            setTab("runs");
            setMessage(`Runs linked to ${triggerName}: ${String(relatedRuns)}`);
          }}
          onCalendarModeChange={setCalendarMode}
          onPrevious={() => {
            if (calendarMode === "list") return;
            setCalendarCursor((current) => shiftCalendarCursor(calendarMode, current, -1));
          }}
          onNext={() => {
            if (calendarMode === "list") return;
            setCalendarCursor((current) => shiftCalendarCursor(calendarMode, current, 1));
          }}
          onToday={() => setCalendarCursor(todayDateKey(calendarTimezone))}
          onOpenMonth={(dateKey) => {
            setCalendarCursor(dateKey);
            setCalendarMode("month");
          }}
        />
      ) : null}

      {tab === "flows" ? <FlowSection loading={loading} graphs={graphs} /> : null}

      {tab === "runs" ? (
        <RunsSection
          loading={loading}
          runTriggerFilter={runTriggerFilter}
          visibleRuns={visibleRuns}
          selectedRun={selectedRun}
          onClearFilter={() => setRunTriggerFilter(null)}
          onOpenRun={(operationId) => void openRun(operationId)}
        />
      ) : null}
    </main>
  );
}
