import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-06a Schedule calendar UX source contract", () => {
  const page = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const calendar = readFileSync("apps/ai/app/work/ScheduleCalendar.tsx", "utf8");
  const helpers = readFileSync("apps/ai/app/work/work-calendar.ts", "utf8");
  const css = readFileSync("apps/ai/app/work/Work.module.css", "utf8");

  it("adds year mode and explicit cursor navigation without changing schedule authority", () => {
    expect(page).toContain('["list", "day", "week", "month", "year"]');
    expect(page).toContain("shiftCalendarCursor");
    expect(page).toContain("todayDateKey");
    expect(calendar).toContain('aria-label="Previous period"');
    expect(calendar).toContain('aria-label="Next period"');
    expect(calendar).toContain("onToday");\n    expect(calendar).toContain("Today");
    expect(calendar).toContain("nextActionTimes");
    expect(calendar).toContain("Work tidak");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("renders day week month and year calendar projections from Temporal-exposed occurrences", () => {
    expect(calendar).toContain('props.mode === "day"');
    expect(calendar).toContain('props.mode === "week"');
    expect(calendar).toContain('props.mode === "month"');
    expect(calendar).toContain('props.mode === "year"');
    expect(calendar).toContain("weekDateKeys");
    expect(calendar).toContain("monthGridDateKeys");
    expect(calendar).toContain("yearMonthKeys");
    expect(calendar).toContain("occurrenceVisibleInPeriod");
    expect(helpers).toContain("groupOccurrencesByDate");
  });

  it("keeps the calendar a projection rather than a second cron engine", () => {
    expect(helpers).not.toContain("cron-parser");
    expect(helpers).not.toContain("setInterval(");
    expect(helpers).not.toContain("setTimeout(");
    expect(calendar).toContain("Calendar hanya memproyeksikan");
    expect(calendar).toContain("Work tidak");
    expect(calendar).toContain("scheduler authority");
  });

  it("keeps large calendar layouts bounded and responsive", () => {
    expect(css).toContain(".calendarWeek");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain(".calendarMonthGrid");
    expect(css).toContain(".calendarYear");
    expect(css).toMatch(
      /@media \(max-width: 780px\)[\s\S]*?\.calendarYear\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
    );
    expect(css).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.calendarYear\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });
});
