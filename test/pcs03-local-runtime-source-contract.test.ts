import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-03 Local AI resilience source contract", () => {
  const settings = [
    readFileSync("apps/ai/app/settings/page.tsx", "utf8"),
    readFileSync("apps/ai/app/settings/useSettingsController.ts", "utf8"),
  ].join("\n");
  const chat = readFileSync("apps/ai/app/page.tsx", "utf8");
  const proxy = readFileSync("apps/ai/lib/settings-proxy.ts", "utf8");

  it("surfaces Local AI as an explicit connected/not-connected product state", () => {
    expect(settings).toContain("Local AI");
    expect(settings).toContain("Not connected");
    expect(settings).toContain("/api/settings/settings/local-runtime/status");
    expect(settings).toContain("OpenAI-compatible runtime");
    expect(settings).toContain("ECORIONE tidak mewajibkan Ollama");
  });

  it("discovers a candidate before saving and keeps identity controls governed", () => {
    expect(settings).toContain('method: "POST"');
    expect(settings).toContain("Checking Local AI configuration before saving");
    expect(settings).toContain("localModelDigest: discovered.modelDigest");
    expect(settings).toContain("Advanced identity settings");
  });

  it("blocks known-unavailable Local chat instead of silently falling back to Hosted", () => {
    expect(chat).toContain('target === "local" && localRuntimeStatus?.ready !== true');
    expect(chat).toContain("disabled={localRuntimeStatus?.ready !== true}");
    expect(chat).toContain("Local AI belum terhubung");
    expect(chat).not.toContain('setTarget("hosted")');
  });

  it("allows only the dedicated Local status path through the Settings proxy", () => {
    expect(proxy).toContain("/local-runtime\\/status");
  });
});
