import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve("apps/ai/app/work/page.tsx");
const sectionsPath = resolve("apps/ai/app/work/WorkPageSections.tsx");
const cssPath = resolve("apps/ai/app/work/Work.module.css");
const navPath = resolve("apps/ai/app/ProductNav.tsx");
const flowPath = resolve("apps/ai/app/flow/page.tsx");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("PE-04 Work source contract", () => {
  it("exposes Schedule Flows Runs under global Work navigation", async () => {
    const [page, nav] = await Promise.all([source(pagePath), source(navPath)]);
    expect(nav).toContain('["Work", "/work", "work"]');
    expect(page).toContain('type WorkTab = "schedule" | "flows" | "runs"');
    expect(page).toContain('value === "schedule" ? "Schedule"');
    expect(page).toContain('value === "flows" ? "Flows" : "Runs"');
  });

  it("reads Temporal schedule runtime instead of implementing browser scheduling", async () => {
    const page = await source(pagePath);
    expect(page).toContain("/schedule?");
    expect(page).toContain("nextActionTimes");
    expect(page).not.toContain("setInterval(");
    expect(page).not.toContain("setTimeout(");
  });

  it("keeps Run projection operationId-based and Project-scoped", async () => {
    const page = await source(pagePath);
    expect(page).toContain("/api/flow/runs?");
    expect(page).toContain("workspaceId: WORKSPACE_ID");
    expect(page).toContain("projectId: nextProjectId");
    expect(page).toContain("/api/flow/runs/");
    expect(page).toContain("workspaceId: WORKSPACE_ID");
    expect(page).toContain("projectId,");
    expect(page).toContain("Key = operationId");
  });

  it("uses exact Flow deep links from Schedule and Run detail", async () => {
    const [page, sections, flow] = await Promise.all([
      source(pagePath),
      source(sectionsPath),
      source(flowPath),
    ]);
    const workSurface = page + sections;
    expect(workSurface).toContain("/flow?graph=");
    expect(workSurface).toContain("&version=");
    expect(flow).toContain('params.get("graph")');
    expect(flow).toContain('params.get("version")');
    expect(flow).toContain("loadGraph(graph, parsedVersion)");
  });

  it("keeps Work responsive without page-level horizontal overflow", async () => {
    const css = await source(cssPath);
    expect(css).toContain("@media (max-width: 780px)");
    expect(css).toMatch(/\.shell\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(
      /@media \(max-width: 780px\)[\s\S]*?\.shell\s*\{[\s\S]*?overflow-x:\s*clip;/,
    );
    expect(css).toMatch(/\.tableWrap\s*\{[\s\S]*?overflow-x:\s*auto;/);
    expect(css).toMatch(
      /@media \(max-width: 780px\)[\s\S]*?\.runLayout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });
});
