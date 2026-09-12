import type {
  RuntimeSettingsAdmin,
  RuntimeSettingsPatch,
  RuntimeSettingsSnapshot,
} from "./runtime-settings.js";

function applyOperatorGate(
  snapshot: RuntimeSettingsSnapshot,
  hostedCallsAllowed: boolean,
): RuntimeSettingsSnapshot {
  if (hostedCallsAllowed || !snapshot.settings.hostedCallsEnabled) return snapshot;
  return {
    revision: snapshot.revision,
    settings: { ...snapshot.settings, hostedCallsEnabled: false },
  };
}

/**
 * Operator-level emergency stop for hosted calls.
 *
 * Runtime settings may further disable hosted calls, but they can never re-enable
 * hosted dispatch while the process-level operator gate is closed.
 */
export function withHostedOperatorGate(
  runtimeSettings: RuntimeSettingsAdmin,
  hostedCallsAllowed: boolean,
): RuntimeSettingsAdmin {
  return {
    get(): RuntimeSettingsSnapshot {
      return applyOperatorGate(runtimeSettings.get(), hostedCallsAllowed);
    },
    update(patch: RuntimeSettingsPatch): RuntimeSettingsSnapshot {
      const safePatch = hostedCallsAllowed
        ? patch
        : { ...patch, hostedCallsEnabled: false };
      return applyOperatorGate(runtimeSettings.update(safePatch), hostedCallsAllowed);
    },
  };
}
