import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09 Ai chat frontend decomposition contract", () => {
  const page = readFileSync("apps/ai/app/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/ChatPageSections.tsx", "utf8");
  const connectDialog = readFileSync("apps/ai/app/AiProviderConnectDialog.tsx", "utf8");
  const modelRouting = readFileSync("apps/ai/app/useChatModelRouting.ts", "utf8");
  const onboarding = readFileSync("apps/ai/app/useAiProviderOnboarding.ts", "utf8");

  it("keeps the Ai orchestration page below its audited concentration baseline", () => {
    expect(page.length).toBeLessThan(40_000);
    expect(page).toContain('from "./ChatPageSections"');
    expect(page).toContain('from "./useChatModelRouting"');
    expect(page).toContain('from "./useAiProviderOnboarding"');
  });

  it("keeps extracted presentation free of owner API calls", () => {
    expect(sections).not.toContain("fetch(");
    expect(sections).not.toContain("/api/");
    expect(connectDialog).not.toContain("fetch(");
    expect(connectDialog).not.toContain("/api/");
    expect(sections).toContain("TurnView");
    expect(sections).toContain("MemoryPanel");
  });

  it("keeps Settings-backed model selection orchestration out of extracted presentation", () => {
    expect(modelRouting).toContain("/api/settings/settings/runtime");
    expect(modelRouting).toContain(
      "/api/settings/settings/providers/openrouter/model-selection",
    );
    expect(modelRouting).not.toContain("/api/chat");
    expect(onboarding).toContain("/api/settings/settings/credentials/");
    expect(onboarding).toContain("/api/settings/settings/runtime");
    expect(onboarding).not.toContain("/api/chat");
    expect(sections).toContain("ChatProviderModelSelectors");
    expect(sections).toContain('aria-label="Provider / Source"');
    expect(sections).toContain('aria-label="Model"');
  });

  it("keeps session, Project, send, and forget orchestration in the page boundary", () => {
    expect(page).toContain("resolveActiveProjectId(candidate, activeProjects(body.projects))");
    expect(page).toContain("async function sendMessage");
    expect(page).toContain("async function forgetFact");
    expect(page).toContain("uploadPendingChatAttachments");
  });
});
