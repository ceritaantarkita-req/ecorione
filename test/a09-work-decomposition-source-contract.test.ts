import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09d Work frontend decomposition source contract", () => {
  const page = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/work/WorkPageSections.tsx", "utf8");
  const model = readFileSync("apps/ai/app/work/work-page-model.ts", "utf8");

  it("keeps owner orchestration in the Work page boundary", () => {
    expect(page).toContain("const loadWork = useCallback");
    expect(page).toContain("async function saveSchedule");
    expect(page).toContain('fetch("/api/work/schedule-assist"');
    expect(page).toContain("async function openRun");
    expect(page).toContain("<ScheduleSection");
    expect(page).toContain("<FlowSection");
    expect(page).toContain("<RunsSection");
  });

  it("moves large presentation subtrees into fetch-free components", () => {
    expect(sections).toContain("Temporal-backed");
    expect(sections).toContain("Existing owner");
    expect(sections).toContain("ADR-37 projection");
    expect(sections).toContain("<ScheduleCalendar");
    expect(sections).not.toContain("fetch(");
    expect(sections).not.toContain("/api/");
  });

  it("centralizes pure schedule parsing and formatting helpers", () => {
    expect(model).toContain("export function timeConfig");
    expect(model).toContain("export function draftFromTrigger");
    expect(model).toContain("export async function json");
    expect(model).toContain("export function formatWhen");
    expect(page).not.toContain("function timeConfig(");
    expect(page).not.toContain("function formatWhen(");
  });

  it("materially reduces the Work orchestration module concentration", () => {
    expect(page.length).toBeLessThan(26_000);
  });
});
