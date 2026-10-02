"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  FlowGraphSummary,
  Project,
  RunListItem,
  RunProjection,
  TriggerDefinition,
} from "@ecorione/shared-schema";
import {
  PERSONAL_PROJECT_ID,
  PROJECT_STORAGE_KEY,
  activeProjects,
  isProjectIdCandidate,
  resolveActiveProjectId,
} from "../../lib/project-selection";
import { useWorkspace } from "../WorkspaceProvider";
import { ProjectPicker } from "../work/ProjectPicker";
import { RunsSection } from "../work/WorkPageSections";
import { json } from "../work/work-page-model";
import styles from "../work/Work.module.css";

type AutomationKind = "event" | "webhook";
type AutomationTab = "automations" | "runs";

type AutomationDraft = {
  id: string | null;
  revision: number | null;
  kind: AutomationKind;
  name: string;
  graphId: string;
  graphVersion: number;
  requestedAutonomy: "L0" | "L1" | "L2" | "L3";
  enabled: boolean;
  source: string;
  eventKind: string;
  hookId: string;
};

type EventConfig = {
  source: string;
  eventKind: string;
};

type WebhookConfig = EventConfig & {
  adapter: "generic";
  hookId: string;
};

function emptyDraft(kind: AutomationKind, graph?: FlowGraphSummary): AutomationDraft {
  return {
    id: null,
    revision: null,
    kind,
    name: "",
    graphId: graph?.graphId ?? "",
    graphVersion: graph?.currentVersion ?? 1,
    requestedAutonomy: "L2",
    enabled: true,
    source: "",
    eventKind: "",
    hookId: "",
  };
}

function automationConfig(trigger: TriggerDefinition): EventConfig | WebhookConfig | null {
  if (trigger.kind === "event") {
    const config = trigger.configuration as Partial<EventConfig>;
    return typeof config.source === "string" && typeof config.eventKind === "string"
      ? { source: config.source, eventKind: config.eventKind }
      : null;
  }
  if (trigger.kind === "webhook") {
    const config = trigger.configuration as Partial<WebhookConfig>;
    return config.adapter === "generic" &&
      typeof config.hookId === "string" &&
      typeof config.source === "string" &&
      typeof config.eventKind === "string"
      ? {
          adapter: "generic",
          hookId: config.hookId,
          source: config.source,
          eventKind: config.eventKind,
        }
      : null;
  }
  return null;
}

function draftFromTrigger(trigger: TriggerDefinition): AutomationDraft | null {
  if (trigger.kind !== "event" && trigger.kind !== "webhook") return null;
  const config = automationConfig(trigger);
  if (config === null) return null;
  return {
    id: trigger.id,
    revision: trigger.revision,
    kind: trigger.kind,
    name: trigger.name,
    graphId: trigger.graphId,
    graphVersion: trigger.graphVersion,
    requestedAutonomy: trigger.requestedAutonomy,
    enabled: trigger.enabled,
    source: config.source,
    eventKind: config.eventKind,
    hookId: "hookId" in config ? config.hookId : "",
  };
}

function makeHookId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `hook_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export default function AutomationsPage() {
  const { workspaceId, ready: workspaceReady } = useWorkspace();
  const [tab, setTab] = useState<AutomationTab>("automations");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(PERSONAL_PROJECT_ID);
  const [projectReady, setProjectReady] = useState(false);
  const [triggers, setTriggers] = useState<TriggerDefinition[]>([]);
  const [graphs, setGraphs] = useState<FlowGraphSummary[]>([]);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunProjection | null>(null);
  const [runTriggerFilter, setRunTriggerFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState<AutomationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(
    "Automation membaca event/webhook Trigger langsung dari Flow; Temporal tetap execution truth.",
  );
  const requestRef = useRef(0);

  const automationTriggers = useMemo(
    () => triggers.filter((trigger) => trigger.kind === "event" || trigger.kind === "webhook"),
    [triggers],
  );

  const visibleRuns = useMemo(
    () =>
      runTriggerFilter === null
        ? runs
        : runs.filter((run) => run.triggerId === runTriggerFilter),
    [runTriggerFilter, runs],
  );

  const loadAutomations = useCallback(
    async (nextProjectId: string) => {
      const seq = ++requestRef.current;
      setLoading(true);
      try {
        const query = new URLSearchParams({ workspaceId, projectId: nextProjectId });
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
        setRevealedTokens({});
      } catch (reason) {
        if (seq !== requestRef.current) return;
        setMessage(
          `Automation load gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
        setTriggers([]);
        setGraphs([]);
        setRuns([]);
        setRevealedTokens({});
      } finally {
        if (seq === requestRef.current) setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!workspaceReady) return;
    let cancelled = false;
    setProjectReady(false);
    let candidate: string | null = null;
    try {
      const stored = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      if (isProjectIdCandidate(stored)) candidate = stored;
    } catch {
      // Active owner Project list remains authoritative.
    }

    void fetch(`/api/projects?workspaceId=${workspaceId}`, { cache: "no-store" })
      .then((response) => json<{ projects: Project[] }>(response))
      .then((body) => {
        if (cancelled) return;
        const active = activeProjects(body.projects);
        const chosen = resolveActiveProjectId(candidate, active);
        setProjects(active);
        if (chosen === null) {
          setMessage("Automation tidak menemukan Project aktif.");
          return;
        }
        setProjectId(chosen);
        setProjectReady(true);
        try {
          window.localStorage.setItem(PROJECT_STORAGE_KEY, chosen);
        } catch {
          // In-memory selection remains valid.
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProjects([]);
        setProjectReady(false);
        setMessage("Automation gagal memuat daftar Project aktif.");
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceReady]);

  useEffect(() => {
    if (!projectReady) return;
    void loadAutomations(projectId);
  }, [loadAutomations, projectId, projectReady]);

  function chooseProject(next: string): void {
    const chosen = resolveActiveProjectId(next, projects);
    if (chosen === null) return;
    setProjectId(chosen);
    setDraft(null);
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, chosen);
    } catch {
      // In-memory selection remains usable.
    }
  }

  function useCreatedProject(project: Project): void {
    setProjects((current) => [
      ...current.filter((candidate) => candidate.id !== project.id),
      project,
    ]);
    setProjectId(project.id);
    setProjectReady(true);
    setDraft(null);
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, project.id);
    } catch {
      // Owner selection remains valid without persistence.
    }
    setMessage(`Project ${project.name} dibuat dan dipilih.`);
  }

  function startCreate(kind: AutomationKind): void {
    const next = emptyDraft(kind, graphs[0]);
    if (kind === "webhook") next.hookId = makeHookId();
    setDraft(next);
    setMessage(
      kind === "webhook"
        ? "Buat webhook automation. Token tetap dimiliki Connect."
        : "Buat event automation dari normalized connector event.",
    );
  }

  function startEdit(trigger: TriggerDefinition): void {
    const next = draftFromTrigger(trigger);
    if (next === null) return;
    setDraft(next);
    setMessage(`Mengedit ${trigger.name}. Authority tetap melewati Hub policy.`);
  }

  async function saveAutomation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (draft === null || pending !== null || draft.graphId.length === 0) return;
    setPending("save");
    try {
      const configuration =
        draft.kind === "event"
          ? { source: draft.source, eventKind: draft.eventKind }
          : {
              adapter: "generic" as const,
              hookId: draft.hookId,
              source: draft.source,
              eventKind: draft.eventKind,
            };
      const base = {
        workspaceId,
        projectId,
        name: draft.name,
        kind: draft.kind,
        graphId: draft.graphId,
        graphVersion: draft.graphVersion,
        versionPolicy: "PINNED" as const,
        requestedAutonomy: draft.requestedAutonomy,
        enabled: draft.enabled,
        configuration,
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
      setDraft(null);
      setMessage(draft.id === null ? "Automation dibuat." : "Automation diperbarui.");
      await loadAutomations(projectId);
    } catch (reason) {
      setMessage(
        `Automation save gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
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
            workspaceId,
            projectId,
            expectedRevision: trigger.revision,
          }),
        },
      );
      await json<TriggerDefinition>(response);
      setMessage(enabled ? "Automation diaktifkan." : "Automation dijeda.");
      await loadAutomations(projectId);
    } catch (reason) {
      setMessage(
        `Automation state gagal: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    } finally {
      setPending(null);
    }
  }

  async function revealWebhookToken(trigger: TriggerDefinition): Promise<void> {
    if (trigger.kind !== "webhook" || pending !== null) return;
    const config = automationConfig(trigger);
    if (config === null || !("hookId" in config)) return;
    if (revealedTokens[trigger.id] !== undefined) {
      setRevealedTokens((current) => {
        const next = { ...current };
        delete next[trigger.id];
        return next;
      });
      return;
    }
    setPending(`token:${trigger.id}`);
    try {
      const body = await fetch(
        `/api/settings/settings/webhooks/${encodeURIComponent(config.hookId)}/token`,
        { cache: "no-store" },
      ).then((response) => json<{ hookId: string; token: string }>(response));
      setRevealedTokens((current) => ({ ...current, [trigger.id]: body.token }));
      setMessage("Webhook token ditampilkan untuk operator. Jangan simpan token di Trigger.");
    } catch (reason) {
      setMessage(
        `Webhook token gagal dibaca: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    } finally {
      setPending(null);
    }
  }

  async function copyWebhookEndpoint(hookId: string): Promise<void> {
    try {
      const endpoint = `${window.location.origin}/webhooks/${hookId}`;
      await navigator.clipboard.writeText(endpoint);
      setMessage("Webhook endpoint disalin.");
    } catch {
      setMessage(`Webhook endpoint: /webhooks/${hookId}`);
    }
  }

  async function openRun(operationId: string): Promise<void> {
    if (pending !== null) return;
    setPending(operationId);
    try {
      const query = new URLSearchParams({ workspaceId, projectId });
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
          <span className={styles.eyebrow}>Event-driven work</span>
          <h1>Automation</h1>
          <p>
            Jalankan Flow saat event atau webhook datang, tanpa mengubah Schedule menjadi
            polling engine.
          </p>
        </div>
        <ProjectPicker
          workspaceId={workspaceId}
          projects={projects}
          projectId={projectId}
          onChoose={chooseProject}
          onCreated={useCreatedProject}
        />
      </header>

      <nav className={styles.tabs} aria-label="Automation views">
        <button
          type="button"
          className={tab === "automations" ? styles.tabActive : undefined}
          aria-pressed={tab === "automations"}
          onClick={() => setTab("automations")}
        >
          Automations
        </button>
        <button
          type="button"
          className={tab === "runs" ? styles.tabActive : undefined}
          aria-pressed={tab === "runs"}
          onClick={() => {
            setRunTriggerFilter(null);
            setSelectedRun(null);
            setTab("runs");
          }}
        >
          Runs
        </button>
      </nav>

      <div className={styles.notice} role="status">
        <span>{loading ? "Refreshing owner state…" : message}</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadAutomations(projectId)}
        >
          Refresh
        </button>
      </div>

      {tab === "automations" ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>Flow-owned Trigger</span>
              <h2>Non-time automations</h2>
              <p>
                Event dan webhook memakai owner Trigger yang sudah ada. Condition polling dan L4
                autonomy tetap tidak aktif.
              </p>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={graphs.length === 0}
                onClick={() => startCreate("event")}
              >
                New event
              </button>
              <button
                type="button"
                disabled={graphs.length === 0}
                onClick={() => startCreate("webhook")}
              >
                New webhook
              </button>
            </div>
          </div>

          {draft !== null ? (
            <form className={styles.editor} onSubmit={saveAutomation}>
              <div className={styles.editorTitle}>
                <strong>{draft.id === null ? "New automation" : "Edit automation"}</strong>
                <button type="button" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
              <label>
                Type
                <select
                  aria-label="Automation type"
                  value={draft.kind}
                  disabled={draft.id !== null}
                  onChange={(event) => {
                    const kind = event.target.value as AutomationKind;
                    setDraft((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            kind,
                            hookId: kind === "webhook" ? current.hookId || makeHookId() : "",
                          },
                    );
                  }}
                >
                  <option value="event">Event</option>
                  <option value="webhook">Webhook</option>
                </select>
              </label>
              <label>
                Name
                <input
                  required
                  aria-label="Automation name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) =>
                      current === null ? current : { ...current, name: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Flow
                <select
                  value={draft.graphId}
                  onChange={(event) => {
                    const graph = graphs.find((item) => item.graphId === event.target.value);
                    setDraft((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            graphId: event.target.value,
                            graphVersion: graph?.currentVersion ?? current.graphVersion,
                          },
                    );
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
                    setDraft((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            graphVersion: Math.max(1, Number(event.target.value) || 1),
                          },
                    )
                  }
                />
              </label>
              <label>
                Source
                <input
                  required
                  aria-label="Automation source"
                  placeholder="github, drive, crm, telegram"
                  value={draft.source}
                  onChange={(event) =>
                    setDraft((current) =>
                      current === null ? current : { ...current, source: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Event kind
                <input
                  required
                  aria-label="Automation event kind"
                  placeholder="push, file.updated, message.received"
                  value={draft.eventKind}
                  onChange={(event) =>
                    setDraft((current) =>
                      current === null
                        ? current
                        : { ...current, eventKind: event.target.value },
                    )
                  }
                />
              </label>
              {draft.kind === "webhook" ? (
                <label>
                  Hook ID
                  <span className={styles.actions}>
                    <input
                      required
                      aria-label="Webhook hook ID"
                      minLength={16}
                      maxLength={64}
                      pattern="[a-z0-9][a-z0-9_-]*"
                      value={draft.hookId}
                      onChange={(event) =>
                        setDraft((current) =>
                          current === null
                            ? current
                            : { ...current, hookId: event.target.value },
                        )
                      }
                    />
                    {draft.id === null ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) =>
                            current === null ? current : { ...current, hookId: makeHookId() },
                          )
                        }
                      >
                        Regenerate
                      </button>
                    ) : null}
                  </span>
                </label>
              ) : null}
              <label>
                Autonomy request
                <select
                  value={draft.requestedAutonomy}
                  onChange={(event) =>
                    setDraft((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            requestedAutonomy: event.target
                              .value as AutomationDraft["requestedAutonomy"],
                          },
                    )
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
                    setDraft((current) =>
                      current === null
                        ? current
                        : { ...current, enabled: event.target.checked },
                    )
                  }
                />
                Enabled
              </label>
              <button
                type="submit"
                disabled={
                  pending !== null ||
                  draft.graphId.length === 0 ||
                  draft.source.trim().length === 0 ||
                  draft.eventKind.trim().length === 0 ||
                  (draft.kind === "webhook" && draft.hookId.length < 16)
                }
              >
                {pending === "save" ? "Saving…" : "Save automation"}
              </button>
            </form>
          ) : null}

          <div className={styles.cardGrid}>
            {automationTriggers.map((trigger) => {
              const config = automationConfig(trigger);
              const relatedRuns = runs.filter((run) => run.triggerId === trigger.id).length;
              const webhook =
                trigger.kind === "webhook" && config !== null && "hookId" in config;
              const token = revealedTokens[trigger.id];
              return (
                <article className={styles.card} key={trigger.id}>
                  <div className={styles.cardHead}>
                    <div>
                      <strong>{trigger.name}</strong>
                      <code>{trigger.id}</code>
                    </div>
                    <span className={trigger.enabled ? styles.live : styles.paused}>
                      {trigger.enabled ? "active" : "disabled"}
                    </span>
                  </div>
                  <dl className={styles.meta}>
                    <div>
                      <dt>Type</dt>
                      <dd>{trigger.kind}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{config?.source ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Event</dt>
                      <dd>{config?.eventKind ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Flow</dt>
                      <dd>
                        {trigger.graphId} · v{trigger.graphVersion}
                      </dd>
                    </div>
                    <div>
                      <dt>Autonomy</dt>
                      <dd>{trigger.requestedAutonomy}</dd>
                    </div>
                    <div>
                      <dt>Runs</dt>
                      <dd>{relatedRuns}</dd>
                    </div>
                    {webhook ? (
                      <div>
                        <dt>Hook ID</dt>
                        <dd>{config.hookId}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {webhook ? (
                    <div className={styles.detailList}>
                      <article>
                        <strong>Public ingress</strong>
                        <code>{`POST /webhooks/${config.hookId}`}</code>
                        <small>
                          Header: X-ECORIONE-Webhook-Token. Workspace, Project, Flow, dan
                          autonomy tidak diterima dari caller.
                        </small>
                      </article>
                      {token !== undefined ? (
                        <article>
                          <strong>Webhook token · secret</strong>
                          <code>{token}</code>
                          <small>
                            Derived by Connect; jangan simpan di Trigger, Flow, docs, atau logs.
                          </small>
                        </article>
                      ) : null}
                    </div>
                  ) : null}
                  <div className={styles.actions}>
                    <button type="button" onClick={() => startEdit(trigger)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => void setEnabled(trigger, !trigger.enabled)}
                    >
                      {trigger.enabled ? "Disable" : "Enable"}
                    </button>
                    <Link
                      href={`/flow?graph=${encodeURIComponent(
                        trigger.graphId,
                      )}&version=${String(trigger.graphVersion)}`}
                    >
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
                    {webhook ? (
                      <>
                        <button
                          type="button"
                          disabled={pending !== null}
                          onClick={() => void revealWebhookToken(trigger)}
                        >
                          {token === undefined ? "Reveal token" : "Hide token"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyWebhookEndpoint(config.hookId)}
                        >
                          Copy endpoint
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {!loading && automationTriggers.length === 0 ? (
              <div className={styles.empty}>
                Belum ada event/webhook automation di Project ini. Schedule tetap khusus time
                Trigger.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

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
