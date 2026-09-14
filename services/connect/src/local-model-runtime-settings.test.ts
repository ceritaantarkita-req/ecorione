import { describe, expect, it } from "vitest";
import { RuntimeSettingsSchema } from "./runtime-settings.js";

const BASE = {
  hostedProvider: "anthropic" as const,
  localRuntime: "openai-compatible" as const,
  localBaseUrl: "http://127.0.0.1:11434/v1",
  localModelTag: "model-a",
  hostedCallsEnabled: true,
  defaultChatTarget: "local" as const,
};

describe("local model runtime identity settings", () => {
  it("migrates legacy settings to an explicitly unpinned identity", () => {
    expect(RuntimeSettingsSchema.parse(BASE).localModelDigest).toBeNull();
  });

  it("normalizes a configured SHA-256 digest", () => {
    const digest = "B".repeat(64);
    expect(
      RuntimeSettingsSchema.parse({ ...BASE, localModelDigest: digest }).localModelDigest,
    ).toBe(`sha256:${"b".repeat(64)}`);
  });

  it("rejects a malformed local model digest", () => {
    expect(() =>
      RuntimeSettingsSchema.parse({ ...BASE, localModelDigest: "sha256:abc" }),
    ).toThrow(/SHA-256/);
  });
});
