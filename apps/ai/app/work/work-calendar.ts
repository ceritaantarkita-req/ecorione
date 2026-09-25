export type CalendarMode = "list" | "day" | "week" | "month" | "year";

export interface ScheduleOccurrence {
  readonly triggerId: string;
  readonly triggerName: string;
  readonly graphId: string;
  readonly graphVersion: number;
  readonly sourceTimezone: string;
  readonly when: string;
}

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseDateKey(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) throw new Error(`Date key tidak valid: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Date key tidak valid: ${value}`);
  }
  return { year, month, day };
}

export function dateKeyFromParts(year: number, month: number, day: number): string {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return `${String(probe.getUTCFullYear())}-${pad(probe.getUTCMonth() + 1)}-${pad(probe.getUTCDate())}`;
}

export function addDays(dateKey: string, amount: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return dateKeyFromParts(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function startOfWeek(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(dateKey, -mondayOffset);
}

export function monthStart(dateKey: string): string {
  const { year, month } = parseDateKey(dateKey);
  return dateKeyFromParts(year, month, 1);
}

export function yearStart(dateKey: string): string {
  const { year } = parseDateKey(dateKey);
  return dateKeyFromParts(year, 1, 1);
}

export function shiftCalendarCursor(
  mode: Exclude<CalendarMode, "list">,
  dateKey: string,
  direction: -1 | 1,
): string {
  const { year, month } = parseDateKey(dateKey);
  if (mode === "day") return addDays(dateKey, direction);
  if (mode === "week") return addDays(dateKey, direction * 7);
  if (mode === "month") {
    const next = new Date(Date.UTC(year, month - 1 + direction, 1));
    return dateKeyFromParts(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
  }
  return dateKeyFromParts(year + direction, 1, 1);
}

export function dateKeyInZone(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Timestamp tidak valid: ${iso}`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = map.get("year");
  const month = map.get("month");
  const day = map.get("day");
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Timezone tidak dapat diformat: ${timezone}`);
  }
  return `${year}-${month}-${day}`;
}

export function todayDateKey(timezone: string, now = new Date()): string {
  return dateKeyInZone(now.toISOString(), timezone);
}

export function calendarPeriodLabel(
  mode: Exclude<CalendarMode, "list">,
  cursor: string,
): string {
  const { year, month, day } = parseDateKey(cursor);
  if (mode === "day") return `${String(day)} ${MONTHS_ID[month - 1]} ${String(year)}`;
  if (mode === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const a = parseDateKey(start);
    const b = parseDateKey(end);
    if (a.year === b.year && a.month === b.month) {
      return `${String(a.day)}–${String(b.day)} ${MONTHS_ID[a.month - 1]} ${String(a.year)}`;
    }
    return `${String(a.day)} ${MONTHS_ID[a.month - 1]} ${String(a.year)} – ${String(b.day)} ${MONTHS_ID[b.month - 1]} ${String(b.year)}`;
  }
  if (mode === "month") return `${MONTHS_ID[month - 1]} ${String(year)}`;
  return String(year);
}

export function monthGridDateKeys(cursor: string): readonly string[] {
  const first = monthStart(cursor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function weekDateKeys(cursor: string): readonly string[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function yearMonthKeys(cursor: string): readonly string[] {
  const { year } = parseDateKey(cursor);
  return Array.from({ length: 12 }, (_, index) => `${String(year)}-${pad(index + 1)}`);
}

export function occurrenceDateKey(
  occurrence: ScheduleOccurrence,
  calendarTimezone: string,
): string {
  return dateKeyInZone(occurrence.when, calendarTimezone);
}

export function occurrenceVisibleInPeriod(
  occurrence: ScheduleOccurrence,
  mode: Exclude<CalendarMode, "list">,
  cursor: string,
  calendarTimezone: string,
): boolean {
  const key = occurrenceDateKey(occurrence, calendarTimezone);
  if (mode === "day") return key === cursor;
  if (mode === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 7);
    return key >= start && key < end;
  }
  if (mode === "month") {
    const { year, month } = parseDateKey(cursor);
    return key.startsWith(`${String(year)}-${pad(month)}-`);
  }
  const { year } = parseDateKey(cursor);
  return key.startsWith(`${String(year)}-`);
}

export function groupOccurrencesByDate(
  occurrences: readonly ScheduleOccurrence[],
  calendarTimezone: string,
): ReadonlyMap<string, readonly ScheduleOccurrence[]> {
  const grouped = new Map<string, ScheduleOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = occurrenceDateKey(occurrence, calendarTimezone);
    const current = grouped.get(key) ?? [];
    current.push(occurrence);
    grouped.set(key, current);
  }
  for (const values of grouped.values()) {
    values.sort((a, b) => a.when.localeCompare(b.when));
  }
  return grouped;
}

export function formatCalendarTime(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export function monthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(monthKey);
  if (match === null) throw new Error(`Month key tidak valid: ${monthKey}`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Month key tidak valid: ${monthKey}`);
  return MONTHS_ID[month - 1] ?? monthKey;
}

export function dateKeyToMonthKey(dateKey: string): string {
  const { year, month } = parseDateKey(dateKey);
  return `${String(year)}-${pad(month)}`;
}
