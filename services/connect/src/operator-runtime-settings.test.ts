import { describe, expect, it } from "vitest";
import type {
  RuntimeSettingsAdmin,
  RuntimeSettingsPatch,
  RuntimeSettingsSnapshot,
} from "./runtime-settings.js";
import { withHostedOperatorGate } from "./operator-runtime-settings.js";

function inMemoryRuntime(hostedCallsEnabled: boolean): RuntimeSettingsAdmin {
  let snapshot: RuntimeSettingsSnapshot = {
    revision: 0,
    settings: {
      hostedProvider: "anthropic",
      localRuntime: "openai-compatible",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "local-model",
      hostedCallsEnabled,
    },
  };
  return {
    get: () => ({
      revision: snapshot.revision,
      settings: { ...snapshot.settings },
    }),
    update: (patch: RuntimeSettingsPatch) => {
      const prior = snapshot.settings;
      snapshot = {
        revision: snapshot.revision + 1,
        settings: {
          hostedProvider: patch.hostedProvider ?? prior.hostedProvider,
          localRuntime: patch.localRuntime ?? prior.localRuntime,
          localBaseUrl: patch.localBaseUrl ?? prior.localBaseUrl,
          localModelTag: patch.localModelTag ?? prior.localModelTag,
          hostedCallsEnabled: patch.hostedCallsEnabled ?? prior.hostedCallsEnabled,
        },
      };
      return {
        revision: snapshot.revision,
        settings: { ...snapshot.settings },
      };
    },
  };
}

describe("withHostedOperatorGate", () => {
  it("memaksa hosted off saat operator gate tertutup walaupun durable settings sebelumnya true", () => {
    const runtime = withHostedOperatorGate(inMemoryRuntime(true), false);
    expect(runtime.get().settings.hostedCallsEnabled).toBe(false);
  });

  it("tidak mengizinkan update runtime mengaktifkan hosted saat operator gate tertutup", () => {
    const runtime = withHostedOperatorGate(inMemoryRuntime(false), false);
    const result = runtime.update({ hostedCallsEnabled: true, hostedProvider: "openai" });
    expect(result.settings.hostedCallsEnabled).toBe(false);
    expect(result.settings.hostedProvider).toBe("openai");
    expect(runtime.get().settings.hostedCallsEnabled).toBe(false);
  });

  it("membiarkan runtime setting mengontrol hosted saat operator gate terbuka", () => {
    const runtime = withHostedOperatorGate(inMemoryRuntime(false), true);
    expect(runtime.update({ hostedCallsEnabled: true }).settings.hostedCallsEnabled).toBe(true);
  });
});
