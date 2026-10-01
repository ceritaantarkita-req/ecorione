import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 4F provider/model UX polish contract", () => {
  const controls = readFileSync("apps/ai/app/ChatPageSections.tsx", "utf8");
  const dialog = readFileSync("apps/ai/app/AiProviderConnectDialog.tsx", "utf8");
  const onboarding = readFileSync("apps/ai/app/useAiProviderOnboarding.ts", "utf8");
  const routing = readFileSync("apps/ai/app/useChatModelRouting.ts", "utf8");

  it("keeps canonical provider and model selectors adjacent in normal chat UX", () => {
    expect(controls).toContain('className="ai-model-controls"');
    expect(controls).toContain('aria-label="Provider / Source"');
    expect(controls).toContain('aria-label="Model"');
    expect(controls).toContain('<option value="__add_ai__">+ Tambah AI</option>');
  });

  it("keeps connection secrets out of normal selector labels", () => {
    expect(controls).not.toContain("connectionId");
    expect(controls).not.toContain("API key");
    expect(controls).not.toContain("credentialConnectionId");
  });

  it("keeps custom provider onboarding explicit and bounded", () => {
    expect(dialog).toContain("Lainnya / Custom OpenAI-compatible");
    expect(dialog).toContain('aria-label="Base URL custom provider"');
    expect(dialog).toContain("public HTTPS");
    expect(onboarding).toContain("/api/settings/settings/providers/custom-openai/connect");
    expect(onboarding).toContain("Custom provider gagal dihubungkan.");
  });

  it("preserves exact custom model identity when switching back to the provider", () => {
    expect(routing).toContain('provider === "custom-openai"');
    expect(routing).toContain("runtime?.settings.customOpenAi?.model");
    expect(routing).toContain("hostedModel,");
  });

  it("surfaces actionable switch and connection feedback", () => {
    expect(controls).toContain("Unavailable");
    expect(controls).toContain("Saving…");
    expect(dialog).toContain('role={feedback.kind === "error" ? "alert" : "status"}');
    expect(dialog).toContain('role="alert"');
  });
});
