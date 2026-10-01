import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 7 Schedule product convergence", () => {
  const nav = readFileSync("apps/ai/app/ProductNav.tsx", "utf8");
  const alias = readFileSync("apps/ai/app/schedule/page.tsx", "utf8");
  const page = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/work/WorkPageSections.tsx", "utf8");
  const brain = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");

  it("promotes Schedule to a first-class route while preserving the Work implementation", () => {
    expect(nav).toContain('["Schedule", "/schedule", "work"]');
    expect(nav).not.toContain('["Work", "/work", "work"]');
    expect(nav).toContain('href === "/schedule" && pathname === "/work"');
    expect(alias.trim()).toBe('export { default } from "../work/page";');
    expect(page).toContain("<h1>Schedule</h1>");
  });

  it("keeps the AI composer available below the calendar and opens human review after drafting", () => {
    expect(sections).toContain("<strong>Schedule AI</strong>");
    expect(sections.lastIndexOf("<strong>Schedule AI</strong>")).toBeGreaterThan(
      sections.indexOf("<ScheduleCalendar"),
    );
    expect(sections).toContain('"Create draft with local AI"');
    const assist = page.slice(
      page.indexOf("async function assistSchedule"),
      page.indexOf("async function saveSchedule"),
    );
    expect(assist).toContain("setEditing(true);");
    expect(assist).toContain("Review draft lalu Save");
  });

  it("preserves Trigger -> Flow -> Temporal authority and routes Brain resources to Schedule", () => {
    expect(page).toContain('? "/api/flow/triggers"');
    expect(page).toContain("/api/flow/triggers/${encodeURIComponent(draft.id)}");
    expect(sections).toContain("Save tetap menulis melalui Trigger → Flow → Temporal.");
    expect(brain.match(/href: "\/schedule"/g)?.length).toBe(2);
    expect(brain).not.toContain('href: "/work"');
  });
});
