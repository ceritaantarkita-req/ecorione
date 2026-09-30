import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 4E direct Ai provider onboarding source contract", () => {
  const page = readFileSync("apps/ai/app/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/ChatPageSections.tsx", "utf8");
  const dialog = readFileSync("apps/ai/app/AiProviderConnectDialog.tsx", "utf8");
  const onboarding = readFileSync("apps/ai/app/useAiProviderOnboarding.ts", "utf8");

  it("keeps + Tambah AI in the provider/source flow without a Settings detour", () => {
    expect(sections).toContain("+ Tambah AI");
    expect(sections).toContain('"__add_ai__"');
    expect(sections).toContain("onAddProvider");
    expect(dialog).toContain("Tambah AI");
    expect(dialog).toContain('aria-label="Provider AI baru"');
    expect(dialog).toContain('aria-label="API key provider"');
    expect(dialog).toContain('{pending ? "Menghubungkan…" : "Connect"}');
    expect(page).toContain("providerOnboarding.openDialog");
    expect(page).not.toContain('href="/settings"');
  });

  it("validates before persisting and keeps Connect as credential authority", () => {
    const testPath = onboarding.indexOf("/test");
    const savePath = onboarding.indexOf(
      "/api/settings/settings/credentials/${encodeURIComponent(providerId)}",
      testPath + 1,
    );
    expect(testPath).toBeGreaterThan(0);
    expect(savePath).toBeGreaterThan(testPath);
    expect(onboarding).toContain('method: "POST"');
    expect(onboarding).toContain('method: "PUT"');
    expect(onboarding).toContain("test.persisted === true");
    expect(onboarding).toContain('setSecret("")');
    expect(dialog).not.toContain("Test API key");
  });

  it("activates through the existing provider runtime boundaries", () => {
    expect(onboarding).toContain("/api/settings/settings/providers/openrouter/model-selection");
    expect(onboarding).toContain("/api/settings/settings/runtime");
    expect(onboarding).toContain('hostedModel: "governed"');
    expect(onboarding).toContain("refreshRouting()");
    expect(onboarding).not.toContain("/api/chat");
  });

  it("keeps custom-provider and multi-credential scope deferred", () => {
    expect(dialog).toContain("Lainnya · Segera");
    expect(dialog).toContain("Sudah terhubung");
    expect(dialog).toContain("disabled={provider.connected || !provider.connectReady}");
  });
});
