import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 8 Brain product convergence", () => {
  const page = readFileSync("apps/ai/app/brain/page.tsx", "utf8");
  const picker = readFileSync("apps/ai/app/work/ProjectPicker.tsx", "utf8");
  const projection = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");
  const css = readFileSync("apps/ai/app/brain/Brain.module.css", "utf8");

  it("uses the searchable owner-backed Project picker with inline Project creation", () => {
    expect(page).toContain('import { ProjectPicker } from "../work/ProjectPicker"');
    expect(page).toContain("<ProjectPicker");
    expect(page).toContain("onCreated={useCreatedProject}");
    expect(picker).toContain('role="combobox"');
    expect(picker).toContain('aria-label="Search Project"');
    expect(picker).toContain("+ New Project");
    expect(picker).toContain('fetch("/api/projects"');
  });

  it(
    "keeps Brain AI as a persistent bottom composer that requires a selected connected dot",
    () => {
      const workspace = page.indexOf('<div className={styles.workspace}>');
      const assistant = page.lastIndexOf(
        '<section className={styles.assistant} aria-label="Brain grounded assistant">',
      );
      expect(workspace).toBeGreaterThan(-1);
      expect(assistant).toBeGreaterThan(workspace);
      expect(page.slice(workspace, assistant)).toContain("</aside>");
      expect(page).toContain("<strong>Brain AI</strong>");
      expect(page).toContain('selectedNode === null ? "Pilih connected dot"');
      expect(page).toContain("disabled={assistantBusy || selectedId === null}");
      expect(css).toMatch(/\.assistant\s*\{[\s\S]*?border:\s*1px solid var\(--border\);/);
    },
  );

  it(
    "preserves canonical Project, Schedule and Flow links without a second graph owner",
    () => {
      expect(projection).toContain('href: "/projects"');
      expect(projection).toContain('href: "/schedule"');
      expect(projection).toContain("href: `/flow?graph=");
      expect(projection).not.toMatch(/neo4j|falkordb/i);
    },
  );

  it("keeps grounded Brain chat on the canonical local chat path", () => {
    expect(page).toContain('fetch("/api/chat"');
    expect(page).toContain('target: "local"');
    expect(page).toContain('source: "brain"');
    expect(page).toContain("/api/brain/neighborhood?");
    expect(page).not.toContain('target: "hosted"');
    expect(page).not.toContain("/v1/complete");
  });
});
