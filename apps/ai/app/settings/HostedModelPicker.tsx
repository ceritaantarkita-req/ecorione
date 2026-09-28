"use client";

import type {
  HostedModelPreference,
  HostedProviderId,
  RuntimeSnapshot,
} from "./useSettingsController";
import styles from "./Settings.module.css";

interface HostedModelOption {
  readonly id: string;
  readonly displayName: string;
}

interface OpenRouterPickerModel extends HostedModelOption {
  readonly executable: boolean;
}

interface HostedModelPickerProps {
  readonly runtime: RuntimeSnapshot;
  readonly hostedProviderOptions: readonly Array<{
    readonly id: HostedProviderId;
    readonly displayName: string;
  }>;
  readonly activeHostedModels: readonly HostedModelOption[];
  readonly openRouterPickerModels: readonly OpenRouterPickerModel[];
  readonly pendingAction: string | null;
  readonly onProviderChange: (provider: HostedProviderId) => void;
  readonly onModelChange: (model: HostedModelPreference) => void;
  readonly onSave: () => void;
}

export function HostedModelPicker({
  runtime,
  hostedProviderOptions,
  activeHostedModels,
  openRouterPickerModels,
  pendingAction,
  onProviderChange,
  onModelChange,
  onSave,
}: HostedModelPickerProps) {
  const selectedModelPreference =
    runtime.settings.hostedProvider === "openrouter"
      ? (runtime.settings.openRouterModelSelection ?? "governed")
      : runtime.settings.hostedModel;
  const selectedOpenRouterModel =
    runtime.settings.hostedProvider === "openrouter"
      ? (openRouterPickerModels.find((model) => model.id === selectedModelPreference) ?? null)
      : null;
  const selectedModelDisplayName =
    selectedModelPreference === "governed"
      ? "Governed / Recommended"
      : runtime.settings.hostedProvider === "openrouter"
        ? (selectedOpenRouterModel?.displayName ?? selectedModelPreference)
        : (activeHostedModels.find((model) => model.id === selectedModelPreference)?.displayName ??
          selectedModelPreference);
  const selectedModelExecutable =
    selectedModelPreference === "governed" ||
    runtime.settings.hostedProvider !== "openrouter" ||
    selectedOpenRouterModel?.executable === true;
  const modelOptions =
    runtime.settings.hostedProvider === "openrouter"
      ? openRouterPickerModels
      : activeHostedModels.map((model) => ({ ...model, executable: true }));

  return (
    <div className={styles.defaultModelPanel}>
      <label>
        Provider
        <select
          value={runtime.settings.hostedProvider}
          disabled={pendingAction !== null}
          onChange={(event) => onProviderChange(event.target.value as HostedProviderId)}
        >
          {hostedProviderOptions.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Model
        <select
          value={selectedModelPreference}
          disabled={pendingAction !== null}
          onChange={(event) => onModelChange(event.target.value as HostedModelPreference)}
        >
          <option value="governed">Governed / Recommended</option>
          {modelOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
              {runtime.settings.hostedProvider === "openrouter" && !model.executable
                ? " · Selectable"
                : ""}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.defaultModelSummary}>
        <strong>{selectedModelDisplayName}</strong>
        <span>
          {selectedModelPreference === "governed"
            ? "Policy dapat memilih pinned model yang sesuai sensitivity dan evidence."
            : runtime.settings.hostedProvider === "openrouter" && !selectedModelExecutable
              ? "Selectable untuk preference Settings, tetapi belum executable. Save akan menyimpan pilihan dan menonaktifkan hosted execution; tidak ada silent fallback."
              : "Pilihan ini executable untuk hosted chat normal. RESTRICTED tetap boleh di-override oleh policy."}
        </span>
      </div>
      <button type="button" disabled={pendingAction !== null} onClick={onSave}>
        {pendingAction === "default-provider-model" ? "Saving…" : "Save default"}
      </button>
    </div>
  );
}
