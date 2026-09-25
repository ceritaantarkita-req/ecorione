"use client";

import Link from "next/link";
import styles from "./Work.module.css";
import {
  calendarPeriodLabel,
  dateKeyInZone,
  dateKeyToMonthKey,
  formatCalendarTime,
  groupOccurrencesByDate,
  monthGridDateKeys,
  monthLabel,
  occurrenceVisibleInPeriod,
  parseDateKey,
  weekDateKeys,
  yearMonthKeys,
  type CalendarMode,
  type ScheduleOccurrence,
} from "./work-calendar";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

interface ScheduleCalendarProps {
  readonly mode: Exclude<CalendarMode, "list">;
  readonly cursor: string;
  readonly calendarTimezone: string;
  readonly occurrences: readonly ScheduleOccurrence[];
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onToday: () => void;
  readonly onOpenMonth: (dateKey: string) => void;
}

function dayHeading(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function eventLink(occurrence: ScheduleOccurrence, timezone: string) {
  return (
    <Link
      key={`${occurrence.triggerId}-${occurrence.when}`}
      className={styles.calendarEvent}
      href={`/flow?graph=${encodeURIComponent(occurrence.graphId)}&version=${String(occurrence.graphVersion)}`}
      title={`${occurrence.triggerName} · ${occurrence.sourceTimezone}`}
    >
      <time dateTime={occurrence.when}>{formatCalendarTime(occurrence.when, timezone)}</time>
      <span>{occurrence.triggerName}</span>
    </Link>
  );
}

export function ScheduleCalendar(props: ScheduleCalendarProps) {
  const visible = props.occurrences.filter((occurrence) =>
    occurrenceVisibleInPeriod(occurrence, props.mode, props.cursor, props.calendarTimezone),
  );
  const grouped = groupOccurrencesByDate(visible, props.calendarTimezone);

  return (
    <div className={styles.calendarShell}>
      <div className={styles.calendarToolbar}>
        <div>
          <strong>{calendarPeriodLabel(props.mode, props.cursor)}</strong>
          <span>
            {visible.length} Temporal occurrence(s) · calendar {props.calendarTimezone}
          </span>
        </div>
        <div className={styles.calendarNav}>
          <button type="button" onClick={props.onPrevious} aria-label="Previous period">
            ←
          </button>
          <button type="button" onClick={props.onToday}>
            Today
          </button>
          <button type="button" onClick={props.onNext} aria-label="Next period">
            →
          </button>
        </div>
      </div>

      {props.mode === "day" ? (
        <div className={styles.calendarDay}>
          <div className={styles.calendarDayTitle}>{dayHeading(props.cursor)}</div>
          <div className={styles.calendarDayEvents}>
            {(grouped.get(props.cursor) ?? []).map((occurrence) =>
              eventLink(occurrence, props.calendarTimezone),
            )}
            {(grouped.get(props.cursor) ?? []).length === 0 ? (
              <div className={styles.empty}>Tidak ada occurrence Temporal pada hari ini.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {props.mode === "week" ? (
        <div className={styles.calendarWeek}>
          {weekDateKeys(props.cursor).map((dateKey) => (
            <section className={styles.calendarWeekDay} key={dateKey}>
              <header>
                <strong>{dayHeading(dateKey)}</strong>
                <span>{(grouped.get(dateKey) ?? []).length}</span>
              </header>
              <div className={styles.calendarCellEvents}>
                {(grouped.get(dateKey) ?? []).map((occurrence) =>
                  eventLink(occurrence, props.calendarTimezone),
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {props.mode === "month" ? (
        <div className={styles.calendarMonth}>
          <div className={styles.calendarWeekdayRow}>
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className={styles.calendarMonthGrid}>
            {monthGridDateKeys(props.cursor).map((dateKey) => {
              const inMonth = dateKeyToMonthKey(dateKey) === dateKeyToMonthKey(props.cursor);
              const events = grouped.get(dateKey) ?? [];
              return (
                <section
                  className={
                    inMonth
                      ? styles.calendarMonthCell
                      : `${styles.calendarMonthCell} ${styles.calendarOutsideMonth}`
                  }
                  key={dateKey}
                >
                  <header>
                    <time dateTime={dateKey}>{parseDateKey(dateKey).day}</time>
                    {events.length > 0 ? <span>{events.length}</span> : null}
                  </header>
                  <div className={styles.calendarCellEvents}>
                    {events
                      .slice(0, 3)
                      .map((occurrence) => eventLink(occurrence, props.calendarTimezone))}
                    {events.length > 3 ? (
                      <small>+{events.length - 3} occurrence(s)</small>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {props.mode === "year" ? (
        <div className={styles.calendarYear}>
          {yearMonthKeys(props.cursor).map((monthKey) => {
            const monthOccurrences = visible.filter(
              (occurrence) =>
                dateKeyToMonthKey(dateKeyInZone(occurrence.when, props.calendarTimezone)) ===
                monthKey,
            );
            const next = monthOccurrences[0];
            return (
              <button
                type="button"
                className={styles.calendarYearMonth}
                key={monthKey}
                onClick={() => props.onOpenMonth(`${monthKey}-01`)}
              >
                <strong>{monthLabel(monthKey)}</strong>
                <span>{monthOccurrences.length} occurrence(s)</span>
                <small>
                  {next === undefined
                    ? "No exposed occurrence"
                    : `Next ${formatCalendarTime(next.when, props.calendarTimezone)} · ${next.triggerName}`}
                </small>
              </button>
            );
          })}
        </div>
      ) : null}

      <p className={styles.calendarFootnote}>
        Calendar hanya memproyeksikan <code>nextActionTimes</code> dari Temporal; Work tidak
        menghitung cron sendiri dan tidak menjadi scheduler authority.
      </p>
    </div>
  );
}
