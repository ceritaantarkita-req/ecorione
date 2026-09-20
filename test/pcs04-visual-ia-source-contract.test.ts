import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-04 visual and information architecture source contract", () => {
  const nav = readFileSync("apps/ai/app/ProductNav.tsx", "utf8");
  const navCss = readFileSync("apps/ai/app/navigation.css", "utf8");
  const globals = readFileSync("apps/ai/app/globals.css", "utf8");
  const chat = readFileSync("apps/ai/app/page.tsx", "utf8");
  const projects = readFileSync("apps/ai/app/projects/page.tsx", "utf8");
  const work = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const brain = readFileSync("apps/ai/app/brain/page.tsx", "utf8");

  it("separates core, workspace, and advanced product navigation", () => {
    expect(nav).toContain('label: "Core"');
    expect(nav).toContain('label: "Workspace"');
    expect(nav).toContain('label: "Advanced"');
    expect(nav).toContain('["Ai", "/", "ai"]');
    expect(nav).toContain('["Settings", "/settings", "settings"]');
    expect(navCss).toContain(".ecr-global-nav__group-label");
    expect(navCss).toContain('html[data-sidebar="collapsed"] .ecr-global-nav__group-label');
  });

  it("uses shared readable controls and native theme-aware selects", () => {
    expect(globals).toContain("color-scheme: dark");
    expect(globals).toContain("color-scheme: light");
    expect(globals).toContain("--control-height: 36px");
    expect(globals).toContain("--control-height-sm: 32px");
    expect(globals).toContain("select option");
    expect(globals).toContain("input::placeholder");
  });

  it("shows the actual Ai route/provider/model rather than only Local/Hosted jargon", () => {
    expect(chat).toContain("hostedRouteLabel");
    expect(chat).toContain("Hosted ·");
    expect(chat).toContain("Recommended");
    expect(chat).toContain("Local ·");
    expect(chat).toContain("Not connected");
  });

  it("keeps primary page copy task-oriented instead of PE/internal labels", () => {
    expect(projects).toContain("Organize context");
    expect(work).toContain("Plan and run");
    expect(brain).toContain("Explore connections");
    expect(brain).not.toContain("PE-06 · derived projection");
    expect(work).not.toContain("ECORIONE · governed execution");
  });
});
