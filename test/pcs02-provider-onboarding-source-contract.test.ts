import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-02 provider onboarding source contract", () => {
  const settings = readFileSync("apps/ai/app/settings/page.tsx", "utf8");
  const providerSection = readFileSync(
    "apps/ai/app/settings/SettingsProviderSection.tsx",
    "utf8",
  );
  const normalSettings = `${settings}\n${providerSection}`;
  const css = readFileSync("apps/ai/app/settings/Settings.module.css", "utf8");

  it("keeps the normal Settings surface focused on providers and model choice", () => {
    expect(normalSettings).toContain("AI & Connections");
    expect(normalSettings).toContain("AI Providers");
    expect(normalSettings).toContain("Default provider & model");
    expect(normalSettings).toContain("Governed / Recommended");
    expect(normalSettings).toContain("Save & activate");
    expect(settings).toContain("<details className={styles.advanced}");
  });

  it("keeps technical runtime and vault controls under the Advanced surface", () => {
    const advancedIndex = settings.indexOf("<details className={styles.advanced}");
    expect(advancedIndex).toBeGreaterThan(0);
    expect(settings.indexOf("Local model SHA-256")).toBeGreaterThan(advancedIndex);
    expect(settings.indexOf("<h2>Credential vault</h2>")).toBeGreaterThan(advancedIndex);
    expect(settings.indexOf("<h2>MCP servers</h2>")).toBeGreaterThan(advancedIndex);
  });

  it("provides responsive provider/model layout styles", () => {
    expect(css).toContain(".providerGrid");
    expect(css).toContain(".connectPanel");
    expect(css).toContain(".defaultModelPanel");
    expect(css).toContain(".advanced");
  });
});
