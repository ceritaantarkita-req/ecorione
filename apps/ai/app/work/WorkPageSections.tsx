"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import type {
  FlowGraphSummary,
  RunListItem,
  RunProjection,
  TriggerDefinition,
  TriggerScheduleRuntime,
} from "@ecorione/shared-schema";
import { ScheduleCalendar } from "./ScheduleCalendar";
import styles from "./Work.module.css";
import type { CalendarMode, ScheduleOccurrence } from "./work-calendar";
import { formatWhen, timeConfig, type ScheduleDraft } from "./work-page-model";

function statusClass(status: string): string {
  const key = status.toLowerCase().replaceAll("_", "-");
  return `${styles.status} ${styles[`status_${key}`] ?? ""}`;
}

type ScheduleSectionProps = {
  loading: boolean;
  graphs: FlowGraphSummary[];
  timeTriggers: TriggerDefinition[];
  runtimes: Record<string, TriggerScheduleRuntime | null>;
  runs: RunListItem[];
  editing: boolean;
  draft: ScheduleDraft;
  assistIntent: string;
  pending: string | null;
  calendarMode: CalendarMode;
  calendarCursor: string;
  calendarTimezone: string;
  occurrences: ScheduleOccurrence[];
  onStartCreate: () => void;
  onCancelEdit: () => void;
  onSaveSchedule: (event: FormEvent<HTMLFormElement>) => void;
  onAssistIntentChange: (value: string) => void;
  onAssistSchedule: () => void;
  onDraftChange: (patch: Partial<ScheduleDraft>) => void;
  onStartEdit: (trigger: TriggerDefinition) => void;
  onSetEnabled: (trigger: TriggerDefinition, enabled: boolean) => void;
  onOpenRuns: (triggerId: string, triggerName: string, relatedRuns: number) => void;
  onCalendarModeChange: (mode: CalendarMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenMonth: (dateKey: string) => void;
};

export function ScheduleSection(props: ScheduleSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>Temporal-backed</span>
          <h2>Schedule</h2>
          <p>Schedule hanyalah view/editor untuk time Trigger; Temporal tetap runtime truth.</p>
        </div>
        <button type="button" onClick={props.onStartCreate} disabled={props.graphs.length === 0}>
          New schedule
        </button>
      </div>

      <div className={styles.viewSwitch} aria-label="Schedule view">
        {(["list", "day", "week", "month", "year"] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            aria-pressed={props.calendarMode === mode}
            className={props.calendarMode === mode ? styles.viewActive : undefined}
            onClick={() => props.onCalendarModeChange(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {props.editing ? (
        <form className={styles.editor} onSubmit={props.onSaveSchedule}>
          <div className={styles.editorTitle}>
            <strong>{props.draft.id === null ? "New schedule" : "Edit schedule"}</strong>
            <button type="button" onClick={props.onCancelEdit}>
              Cancel
            </button>
          </div>
          <div className={styles.scheduleAssistant}>
            <div>
              <strong>AI-assisted draft</strong>
              <small>
                Describe the create/edit intent. Local AI only proposes fields; Save still writes
                through Trigger → Flow → Temporal.
              </small>
            </div>
            <textarea
              value={props.assistIntent}
              aria-label="Describe schedule"
              rows={3}
              maxLength={2000}
              placeholder="Contoh: jalankan Daily Brief setiap Senin–Jumat jam 08.30 WIB"
              onChange={(event) => props.onAssistIntentChange(event.target.value)}
            />
            <button
              type="button"
              disabled={props.pending !== null || props.assistIntent.trim().length < 3}
              onClick={props.onAssistSchedule}
            >
              {props.pending === "assist" ? "Drafting…" : "Draft with local AI"}
            </button>
          </div>
          <label>
            Name
            <input
              required
              aria-label="Schedule name"
              value={props.draft.name}
              onChange={(event) => props.onDraftChange({ name: event.target.value })}
            />
          </label>
          <label>
            Flow
            <select
              value={props.draft.graphId}
              onChange={(event) => {
                const graph = props.graphs.find((item) => item.graphId === event.target.value);
                props.onDraftChange({
                  graphId: event.target.value,
                  graphVersion: graph?.currentVersion ?? props.draft.graphVersion,
                });
              }}
            >
              <option value="">Select Flow</option>
              {props.graphs.map((graph) => (
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
              value={props.draft.graphVersion}
              onChange={(event) =>
                props.onDraftChange({
                  graphVersion: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </label>
          <label>
            Cron
            <input
              required
              aria-label="Cron expression"
              value={props.draft.cronExpression}
              onChange={(event) => props.onDraftChange({ cronExpression: event.target.value })}
            />
          </label>
          <label>
            IANA timezone
            <input
              required
              value={props.draft.timezone}
              onChange={(event) => props.onDraftChange({ timezone: event.target.value })}
            />
          </label>
          <label>
            Catch-up
            <select
              value={props.draft.catchupWindowMs}
              onChange={(event) =>
                props.onDraftChange({ catchupWindowMs: Number(event.target.value) })
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
              value={props.draft.overlap}
              onChange={(event) =>
                props.onDraftChange({ overlap: event.target.value as ScheduleDraft["overlap"] })
              }
            >
              <option value="SKIP">SKIP</option>
              <option value="QUEUE_ONE">QUEUE_ONE</option>
            </select>
          </label>
          <label>
            Autonomy request
            <select
              value={props.draft.requestedAutonomy}
              onChange={(event) =>
                props.onDraftChange({
                  requestedAutonomy: event.target.value as ScheduleDraft["requestedAutonomy"],
                })
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
              checked={props.draft.enabled}
              onChange={(event) => props.onDraftChange({ enabled: event.target.checked })}
            />
            Enabled
          </label>
          <button
            type="submit"
            disabled={props.pending !== null || props.draft.graphId.length === 0}
          >
            {props.pending === "save" ? "Saving…" : "Save schedule"}
          </button>
        </form>
      ) : null}

      {props.calendarMode === "list" ? (
        <div className={styles.cardGrid}>
          {props.timeTriggers.map((trigger) => {
            const config = timeConfig(trigger);
            const runtime = props.runtimes[trigger.id];
            const relatedRuns = props.runs.filter((run) => run.triggerId === trigger.id).length;
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
                  <div>
                    <dt>Cron</dt>
                    <dd>{config?.cronExpression ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd>{config?.timezone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Flow</dt>
                    <dd>
                      {trigger.graphId} · v{trigger.graphVersion}
                    </dd>
                  </div>
                  <div>
                    <dt>Overlap</dt>
                    <dd>{config?.overlap ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Runs</dt>
                    <dd>{relatedRuns}</dd>
                  </div>
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
                  <button type="button" onClick={() => props.onStartEdit(trigger)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={props.pending !== null}
                    onClick={() => props.onSetEnabled(trigger, !trigger.enabled)}
                  >
                    {trigger.enabled ? "Disable" : "Enable"}
                  </button>
                  <Link
                    href={`/flow?graph=${encodeURIComponent(trigger.graphId)}&version=${String(trigger.graphVersion)}`}
                  >
                    Open Flow
                  </Link>
                  <button
                    type="button"
                    onClick={() => props.onOpenRuns(trigger.id, trigger.name, relatedRuns)}
                  >
                    Runs
                  </button>
                </div>
              </article>
            );
          })}
          {!props.loading && props.timeTriggers.length === 0 ? (
            <div className={styles.empty}>Belum ada time Trigger di Project ini.</div>
          ) : null}
        </div>
      ) : (
        <ScheduleCalendar
          mode={props.calendarMode}
          cursor={props.calendarCursor}
          calendarTimezone={props.calendarTimezone}
          occurrences={props.occurrences}
          onPrevious={props.onPrevious}
          onNext={props.onNext}
          onToday={props.onToday}
          onOpenMonth={props.onOpenMonth}
        />
      )}
    </section>
  );
}

type FlowSectionProps = {
  loading: boolean;
  graphs: FlowGraphSummary[];
};

export function FlowSection({ loading, graphs }: FlowSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>Existing owner</span>
          <h2>Flows</h2>
          <p>Work menavigasi Flow; editor dan version truth tetap dimiliki Flow.</p>
        </div>
        <Link className={styles.primaryLink} href="/flow">
          Open Flow editor
        </Link>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Sensitivity</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {graphs.map((graph) => (
              <tr key={graph.graphId}>
                <td>
                  <strong>{graph.name}</strong>
                  <code>{graph.graphId}</code>
                </td>
                <td>v{graph.currentVersion}</td>
                <td>{graph.sensitivity}</td>
                <td>{formatWhen(graph.updatedAt)}</td>
                <td>
                  <Link
                    href={`/flow?graph=${encodeURIComponent(graph.graphId)}&version=${String(graph.currentVersion)}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && graphs.length === 0 ? (
          <div className={styles.empty}>Belum ada Flow.</div>
        ) : null}
      </div>
    </section>
  );
}

type RunsSectionProps = {
  loading: boolean;
  runTriggerFilter: string | null;
  visibleRuns: RunListItem[];
  selectedRun: RunProjection | null;
  onClearFilter: () => void;
  onOpenRun: (operationId: string) => void;
};

export function RunsSection(props: RunsSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>ADR-37 projection</span>
          <h2>Runs</h2>
          <p>Key = operationId. Tidak ada execution database kedua.</p>
        </div>
      </div>
      {props.runTriggerFilter !== null ? (
        <div className={styles.filterBar}>
          <span>
            Trigger filter: <code>{props.runTriggerFilter}</code>
          </span>
          <button type="button" onClick={props.onClearFilter}>
            Clear filter
          </button>
        </div>
      ) : null}
      <div className={styles.runLayout}>
        <div className={styles.runList}>
          {props.visibleRuns.map((run) => (
            <button
              type="button"
              key={run.operationId}
              className={
                props.selectedRun?.operationId === run.operationId
                  ? `${styles.runRow} ${styles.runRowActive}`
                  : styles.runRow
              }
              onClick={() => props.onOpenRun(run.operationId)}
            >
              <span className={statusClass(run.status)}>{run.status}</span>
              <strong>
                {run.graphId} · v{run.graphVersion}
              </strong>
              <code>{run.operationId}</code>
              <small>{formatWhen(run.startedAt)}</small>
            </button>
          ))}
          {!props.loading && props.visibleRuns.length === 0 ? (
            <div className={styles.empty}>
              {props.runTriggerFilter === null
                ? "Belum ada Run lifecycle evidence di Project ini."
                : "Belum ada Run untuk Trigger ini pada projection saat ini."}
            </div>
          ) : null}
        </div>

        <aside className={styles.runDetail}>
          {props.selectedRun === null ? (
            <div className={styles.empty}>Pilih Run untuk melihat owner evidence.</div>
          ) : (
            <>
              <div className={styles.cardHead}>
                <div>
                  <span className={statusClass(props.selectedRun.status)}>
                    {props.selectedRun.status}
                  </span>
                  <h3>
                    {props.selectedRun.graphId} · v{props.selectedRun.graphVersion}
                  </h3>
                  <code>{props.selectedRun.operationId}</code>
                </div>
                <Link
                  href={`/flow?graph=${encodeURIComponent(props.selectedRun.graphId)}&version=${String(props.selectedRun.graphVersion)}`}
                >
                  Flow
                </Link>
              </div>
              <dl className={styles.meta}>
                <div>
                  <dt>Trigger</dt>
                  <dd>{props.selectedRun.triggerId ?? "Direct run"}</dd>
                </div>
                <div>
                  <dt>Workflow</dt>
                  <dd>{props.selectedRun.temporalWorkflowId}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{formatWhen(props.selectedRun.startedAt)}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>
                    {props.selectedRun.finishedAt
                      ? formatWhen(props.selectedRun.finishedAt)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Actual cost</dt>
                  <dd>
                    {props.selectedRun.cost === null
                      ? "—"
                      : `$${props.selectedRun.cost.totalActualUsd.toFixed(6)}`}
                  </dd>
                </div>
                <div>
                  <dt>Model calls</dt>
                  <dd>{props.selectedRun.cost?.callCount ?? "—"}</dd>
                </div>
              </dl>

              <div className={styles.availability}>
                {Object.entries(props.selectedRun.availability).map(([owner, available]) => (
                  <span key={owner} className={available ? styles.live : styles.paused}>
                    {owner}: {available ? "available" : "partial"}
                  </span>
                ))}
              </div>

              <details open>
                <summary>Output</summary>
                <pre>{JSON.stringify(props.selectedRun.output, null, 2)}</pre>
              </details>
              <details>
                <summary>Approvals ({props.selectedRun.approvals.length})</summary>
                <div className={styles.detailList}>
                  {props.selectedRun.approvals.map((approval) => (
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
                <summary>Audit actions ({props.selectedRun.actions.length})</summary>
                <div className={styles.detailList}>
                  {props.selectedRun.actions.map((action) => (
                    <article key={action.id}>
                      <strong>{action.type}</strong>
                      <span>
                        {action.module} · {formatWhen(action.ts)}
                      </span>
                      <code>{action.operationId ?? "no operation"}</code>
                    </article>
                  ))}
                </div>
              </details>
              {props.selectedRun.errors.length > 0 ? (
                <div className={styles.errors}>
                  {props.selectedRun.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
