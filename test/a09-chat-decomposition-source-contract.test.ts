import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09 Ai chat frontend decomposition contract", () => {
  const page = readFileSync("apps/ai/app/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/ChatPageSections.tsx", "utf8");

  it("keeps the Ai orchestration page below its audited concentration baseline", () => {
    expect(page.length).toBeLessThan(40_000);
    expect(page).toContain('from "./ChatPageSections"');
  });

  it("keeps extracted presentation free of owner API calls", () => {
    expect(sections).not.toContain("fetch(");
    expect(sections).not.toContain("/api/");
    expect(sections).toContain("TurnView");
    expect(sections).toContain("MemoryPanel");
  });

  it("keeps session, Project, send, and forget orchestration in the page boundary", () => {
    expect(page).toContain("resolveActiveProjectId(candidate, activeProjects(body.projects))");
    expect(page).toContain("async function sendMessage");
    expect(page).toContain("async function forgetFact");
    expect(page).toContain("uploadPendingChatAttachments");
  });
});
