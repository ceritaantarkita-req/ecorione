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
    expect(page).toContain("onClick={() => setSelectedId(ALL_ID)}");
    expect(page).toContain("aria-pressed={allSelected}");
    expect(page).toContain("className={allSelected ? styles.virtualActive : styles.virtual}");
  });

  it("loads workspace aggregate history only when All is selected", () => {
    expect(page).toContain(
      "loadSessions(selectedId === ALL_ID ? undefined : selectedId)",
    );
    expect(historyRoute).toContain('const rawProjectId = url.searchParams.get("projectId")');
    expect(historyRoute).toContain('rawProjectId === null ? null : ProjectIdSchema.safeParse(rawProjectId)');
    expect(historyRoute).toContain('const projectQuery =');
  });

  it("keeps All metadata-only and opens each conversation through its owning Project", () => {
    expect(page).toContain(
      "Memory dan Sources tetap terisolasi per\n                    Project.",
    );
    expect(page).not.toContain("openProject(ALL_ID)");
    expect(page).toContain("session.projectId === null");
    expect(page).toContain(
      "/?project=${encodeURIComponent(project.id)}&session=${encodeURIComponent(session.id)}",
    );
  });
});
