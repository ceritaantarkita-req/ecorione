import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-02 Projects All aggregate contract", () => {
  const page = readFileSync("apps/ai/app/projects/page.tsx", "utf8");
  const historyRoute = readFileSync(
    "apps/ai/app/api/projects/history/route.ts",
    "utf8",
  );

  it("makes the virtual All entry an explicit selectable UI state", () => {
    expect(page).toContain('const ALL_ID = "__all__"');
    expect(page).toContain("setSelectedId(ALL_ID)");
    expect(page).toContain("aria-pressed={allSelected}");
    expect(page).toContain("styles.virtualActive");
  });

  it("loads workspace aggregate history only when All is selected", () => {
    expect(page).toContain(
      "loadSessions(selectedId === ALL_ID ? undefined : selectedId)",
    );
    expect(historyRoute).toContain('url.searchParams.get("projectId")');
    expect(historyRoute).toContain("ProjectIdSchema.safeParse(rawProjectId)");
    expect(historyRoute).toContain("projectId === null");
    expect(historyRoute).toContain("projectQuery");
  });

  it("keeps All metadata-only and opens each conversation through its owning Project", () => {
    expect(page).toContain("Memory dan Sources tetap terisolasi per");
    expect(page).not.toContain("openProject(ALL_ID)");
    expect(page).toContain("session.projectId === null");
    expect(page).toContain("encodeURIComponent(project.id)");
    expect(page).toContain("encodeURIComponent(session.id)");
  });
});
