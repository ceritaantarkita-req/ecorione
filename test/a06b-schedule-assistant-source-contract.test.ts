import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-06b Project picker + Schedule assistant source contract", () => {
  const page = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const picker = readFileSync("apps/ai/app/work/ProjectPicker.tsx", "utf8");
  const aiRoute = readFileSync("apps/ai/app/api/work/schedule-assist/route.ts", "utf8");
  const hubRoute = readFileSync("services/hub/src/schedule-assist-http.ts", "utf8");

  it("replaces the native Project select with search and inline owner creation", () => {
    expect(page).toContain("<ProjectPicker");
    expect(picker).toContain('role="combobox"');
    expect(picker).toContain('aria-label="Search Project"');
    expect(picker).toContain("+ New Project");
    expect(picker).toContain('fetch("/api/projects"');
    expect(picker).toContain('method: "POST"');
    expect(page).toContain("onCreated={useCreatedProject}");
  });

  it("keeps AI assistance draft-only and local through the Hub authority boundary", () => {
    expect(page).toContain('fetch("/api/work/schedule-assist"');
    expect(aiRoute).toContain('"/v1/work/schedule/assist"');
    expect(hubRoute).toContain('target: "local"');
    expect(hubRoute).toContain('routes: ["local"]');
    expect(hubRoute).toContain('syncClass: "LOCAL_ONLY"');
    expect(hubRoute).toContain("Never create or execute a schedule");
    expect(hubRoute).not.toContain('"/v1/triggers"');
    expect(hubRoute).not.toContain("temporalScheduleId");
  });

  it("pins owner Flow version and preserves governance fields across AI edits", () => {
    expect(hubRoute).toContain("graphVersion: graph.currentVersion");
    expect(hubRoute).toContain("preserved?.requestedAutonomy");
    expect(hubRoute).toContain("preserved?.enabled");
    expect(hubRoute).toContain("preserved?.configuration.catchupWindowMs");
    expect(hubRoute).toContain("preserved?.configuration.overlap");
  });

  it("requires explicit Save before the existing Trigger path mutates scheduling state", () => {
    expect(page).toContain("Review draft lalu Save");
    expect(page).toContain('draft.id === null ? "/api/flow/triggers"');
    expect(page).toContain('method: draft.id === null ? "POST" : "PATCH"');
    expect(page).not.toContain('fetch("/api/work/schedule-assist", {\n        method: "PATCH"');
  });
});
