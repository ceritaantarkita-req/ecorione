import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09 Settings frontend decomposition contract", () => {
  const page = readFileSync("apps/ai/app/settings/page.tsx", "utf8");
  const controller = readFileSync("apps/ai/app/settings/useSettingsController.ts", "utf8");

  it("keeps the Settings presentation page below its audited concentration baseline", () => {
    expect(page.length).toBeLessThan(30_000);
    expect(page).toContain('from "./useSettingsController"');
  });

  it("keeps Settings owner API orchestration in the controller boundary", () => {
    expect(controller).toContain("/api/settings/settings/runtime");
    expect(controller).toContain("/api/settings/settings/credentials");
    expect(controller).toContain("/api/settings/settings/mcp/servers");
    expect(controller).toContain("async function saveRuntime");
    expect(controller).toContain("async function saveCredential");
    expect(controller).toContain("async function saveMcpServer");
  });

  it("keeps product sections in the presentation boundary", () => {
    expect(page).toContain("<h2>AI Providers</h2>");
    expect(page).toContain("<h2>Default provider & model</h2>");
    expect(page).toContain("<h2>Credential vault</h2>");
    expect(page).toContain("<h2>MCP servers</h2>");
  });
});
