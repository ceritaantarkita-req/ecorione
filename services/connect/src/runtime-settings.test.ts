import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileRuntimeSettings } from "./runtime-settings.js";

const defaults = {
  hostedProvider: "anthropic" as const,
  localRuntime: "openai-compatible" as const,
  localBaseUrl: "http://127.0.0.1:11434/v1",
  localModelTag: "model-a",
  hostedCallsEnabled: true,
};

describe("FileRuntimeSettings", () => {
  it("memiliki revision monotonic dan file owner mode tanpa secret", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const path = join(dir, "settings.json");
    const store = new FileRuntimeSettings(path, defaults);
    expect(store.get()).toMatchObject({ revision: 0, settings: defaults });
    const next = store.update({ hostedProvider: "openai", localModelTag: "model-b" });
    expect(next.revision).toBe(1);
    expect(next.settings.hostedProvider).toBe("openai");
    expect(readFileSync(path, "utf8")).not.toContain("API_KEY");
  });

  it("menolak credential/fragment dan protocol non-http pada local runtime URL", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-settings-"));
    const store = new FileRuntimeSettings(join(dir, "settings.json"), defaults);
    expect(() => store.update({ localBaseUrl: "http://user:pass@host/v1" })).toThrow();
    expect(() => store.update({ localBaseUrl: "file:///tmp/model" })).toThrow();
  });
});
