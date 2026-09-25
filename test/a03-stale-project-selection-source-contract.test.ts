import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-03 stale Project selection source contract", () => {
  const ai = readFileSync("apps/ai/app/page.tsx", "utf8");
  const work = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const brain = readFileSync("apps/ai/app/brain/page.tsx", "utf8");
  const helper = readFileSync("apps/ai/lib/project-selection.ts", "utf8");

  it("uses one active-Project reconciliation contract across Ai, Work, and Brain", () => {
    for (const source of [ai, work, brain]) {
      expect(source).toContain("resolveActiveProjectId");
      expect(source).toContain("PROJECT_STORAGE_KEY");
      expect(source).toContain("/api/projects?workspaceId=");
    }
    expect(helper).toContain("project.archivedAt === null");
    expect(helper).toContain("active.some((project) => project.id === candidate)");
    expect(helper).toContain("PERSONAL_PROJECT_ID");
  });

  it("does not send Work or Brain owner reads before Project reconciliation completes", () => {
    expect(work).toContain("if (!projectReady) return;");
    expect(work).toContain("void loadWork(projectId)");
    expect(brain).toContain("if (!projectReady) return;");
    expect(brain).toContain("void loadBrain(projectId)");
  });

  it("binds Ai sessions only after resolving the candidate against active Projects", () => {
    expect(ai).toContain("setProjectReady(false)");
    expect(ai).toContain("resolveActiveProjectId(candidate, activeProjects(body.projects))");
    expect(ai).toContain(
      "const selectionCorrected = candidate !== null && candidate !== nextProject",
    );
    expect(ai).toContain('nextUrl.searchParams.delete("session")');
    expect(ai).toContain("setProjectReady(true)");
  });

  it("removes the old syntax-only localStorage acceptance from all three surfaces", () => {
    const oldPattern = "stored !== null && /^prj_[a-z0-9][a-z0-9_-]*$/.test(stored)";
    expect(ai).not.toContain(oldPattern);
    expect(work).not.toContain(oldPattern);
    expect(brain).not.toContain(oldPattern);
  });
});
