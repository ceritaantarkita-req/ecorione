import { describe, expect, it } from "vitest";
import {
  addDays,
  calendarPeriodLabel,
  dateKeyInZone,
  groupOccurrencesByDate,
  monthGridDateKeys,
  occurrenceVisibleInPeriod,
  shiftCalendarCursor,
  startOfWeek,
  todayDateKey,
  weekDateKeys,
  yearMonthKeys,
  type ScheduleOccurrence,
} from "./work-calendar";

const occurrence: ScheduleOccurrence = {
  triggerId: "trg_daily",
  triggerName: "Daily",
  graphId: "fg_daily",
  graphVersion: 3,
  sourceTimezone: "Asia/Jakarta",
  when: "2026-09-25T01:00:00.000Z",
};

describe("Work Schedule calendar helpers", () => {
  it("uses date-only arithmetic with Monday as week start", () => {
    expect(startOfWeek("2026-09-25")).toBe("2026-09-21");
    expect(weekDateKeys("2026-09-25")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("supports day/week/month/year cursor navigation", () => {
    expect(shiftCalendarCursor("day", "2026-09-25", 1)).toBe("2026-09-26");
    expect(shiftCalendarCursor("week", "2026-09-25", -1)).toBe("2026-09-18");
    expect(shiftCalendarCursor("month", "2026-09-25", 1)).toBe("2026-10-01");
    expect(shiftCalendarCursor("year", "2026-09-25", -1)).toBe("2025-01-01");
  });

  it("builds stable month and year grids", () => {
    const month = monthGridDateKeys("2026-09-25");
    expect(month).toHaveLength(42);
    expect(month[0]).toBe("2026-08-31");
    expect(month[41]).toBe("2026-10-11");
    expect(yearMonthKeys("2026-09-25")).toHaveLength(12);
    expect(yearMonthKeys("2026-09-25")[0]).toBe("2026-01");
    expect(yearMonthKeys("2026-09-25")[11]).toBe("2026-12");
  });

  it("groups and filters only Temporal-exposed occurrences in one calendar timezone", () => {
    const second: ScheduleOccurrence = {
      ...occurrence,
      triggerId: "trg_second",
      when: "2026-09-25T17:30:00.000Z",
    };
    expect(dateKeyInZone(occurrence.when, "Asia/Jakarta")).toBe("2026-09-25");
    expect(dateKeyInZone(second.when, "Asia/Jakarta")).toBe("2026-09-26");
    expect(
      occurrenceVisibleInPeriod(occurrence, "day", "2026-09-25", "Asia/Jakarta"),
    ).toBe(true);
    expect(
      occurrenceVisibleInPeriod(second, "day", "2026-09-25", "Asia/Jakarta"),
    ).toBe(false);

    const grouped = groupOccurrencesByDate([second, occurrence], "Asia/Jakarta");
    expect(grouped.get("2026-09-25")?.[0]?.triggerId).toBe("trg_daily");
    expect(grouped.get("2026-09-26")?.[0]?.triggerId).toBe("trg_second");
  });

  it("formats deterministic period labels and today keys", () => {
    expect(calendarPeriodLabel("day", "2026-09-25")).toContain("September 2026");
    expect(calendarPeriodLabel("month", "2026-09-25")).toBe("September 2026");
    expect(calendarPeriodLabel("year", "2026-09-25")).toBe("2026");
    expect(todayDateKey("Asia/Jakarta", new Date("2026-09-25T07:00:00.000Z"))).toBe(
      "2026-09-25",
    );
  });
});
