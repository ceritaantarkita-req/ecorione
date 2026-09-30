import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { isMutableModelAlias } from "@ecorione/shared-telemetry";
import { z } from "zod";
import { isLocalReachableHost, localBaseUrlPublicAllowed } from "./local-base-url.js";
import {
  GOVERNED_HOSTED_MODEL,
  HostedModelPreferenceSchema,
  hostedModelSupported,
  type HostedModelPreference,
} from "./hosted-model-catalog.js";
import { executableHostedModelRegistryEntry } from "./hosted-model-registry.js";
import { LocalModelDigestSchema, type LocalModelDigest } from "./local-model-identity.js";
import { HostedProviderIdSchema, type HostedProviderId } from "./provider-types.js";
import { LocalRuntimeIdSchema, type LocalRuntimeId } from "./providers/local-runtime.js";

function safeBaseUrl(value: string, ctx: z.RefinementCtx): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "localBaseUrl harus URL valid." });
    return;
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    ctx.addIssue({ code: "custom", message: "localBaseUrl hanya boleh HTTP/HTTPS." });
  }
  if (url.username !== "" || url.password !== "" || url.hash !== "") {
    ctx.addIssue({
      code: "custom",
      message: "localBaseUrl tidak boleh memuat credential atau fragment.",
    });
  }
  if (!isLocalReachableHost(url.hostname) && !localBaseUrlPublicAllowed()) {
    ctx.addIssue({
      code: "custom",
      message:
        `localBaseUrl \`${url.hostname}\` di luar jangkauan loopback/private. Target Local ` +
        "tidak boleh meninggalkan mesin. Set ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC=1 kalau " +
        "itu memang disengaja.",
    });
  }
}

/**
 * ADR-14 untuk identitas lokal: tag yang bisa drift (`:latest`, `@latest`, `latest`)
 * hanya boleh dipakai kalau digest terpin ikut dinyatakan — kalau tidak, nama model di
 * evidence tidak berarti apa-apa karena isinya bisa berubah tanpa nama berubah.
 *
 * Sengaja ditegakkan pada jalur MUTASI saja, bukan di skema yang juga dipakai membaca
 * file persisten: instalasi lama yang terlanjur menyimpan `gemma4:latest` harus tetap
 * bisa boot (dan akan terbaca `pinned=false`) alih-alih membuat Connect tidak bisa
 * dijalankan sama sekali setelah upgrade.
 */
export function assertLocalModelTagWritable(settings: {
  localModelTag: string;
  localModelDigest?: LocalModelDigest | null | undefined;
}): void {
  if (!isMutableModelAlias(settings.localModelTag)) return;
  if (settings.localModelDigest != null) return;
  throw new MutableLocalModelTagError(settings.localModelTag);
}

export class MutableLocalModelTagError extends Error {
  constructor(tag: string) {
    super(
      `Tag model lokal ${JSON.stringify(tag)} adalah alias yang bisa berubah (ADR-14). ` +
        "Pakai tag berversi, atau sertakan localModelDigest supaya identitasnya terpin.",
    );
    this.name = "MutableLocalModelTagError";
  }
}

export const ChatTargetPreferenceSchema = z.enum(["local", "hosted"]);
export type ChatTargetPreference = z.infer<typeof ChatTargetPreferenceSchema>;
export const LocalBaseUrlSchema = z.string().min(1).max(2048).superRefine(safeBaseUrl);

function safeCustomOpenAiBaseUrl(value: string, ctx: z.RefinementCtx): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Base URL custom provider harus URL valid." });
    return;
  }
  if (url.protocol !== "https:") {
    ctx.addIssue({ code: "custom", message: "Base URL custom provider wajib HTTPS." });
  }
  if (
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.search !== ""
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Base URL custom provider tidak boleh memuat credential, query, atau fragment.",
    });
  }
  if (isLocalReachableHost(url.hostname)) {
    ctx.addIssue({
      code: "custom",
      message: "Base URL custom provider wajib memakai host publik.",
    });
  }
}

export const CustomOpenAiBaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .superRefine(safeCustomOpenAiBaseUrl);
export const CustomOpenAiModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u);
export const CustomOpenAiConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    baseUrl: CustomOpenAiBaseUrlSchema,
    model: CustomOpenAiModelSchema,
    inputUsdPerMTok: z.number().finite().nonnegative().max(1_000_000),
    outputUsdPerMTok: z.number().finite().nonnegative().max(1_000_000),
    validatedAt: z.string().datetime({ offset: false }),
  })
  .strict();
export type CustomOpenAiConfig = z.infer<typeof CustomOpenAiConfigSchema>;

const RuntimeSettingsObjectSchema = z
  .object({
    hostedProvider: HostedProviderIdSchema,
    hostedModel: HostedModelPreferenceSchema.default(GOVERNED_HOSTED_MODEL),
    customOpenAi: CustomOpenAiConfigSchema.optional(),
    openRouterModelSelection: HostedModelPreferenceSchema.optional(),
    /**
     * Legacy field name kept for persisted-file compatibility.
     * This is trusted Connect-owned execution authority for the selected dynamic OpenRouter
     * model and is never writable through generic runtime PATCH.
     */
    openRouterCertifiedModelId: HostedModelPreferenceSchema.optional(),
    localRuntime: LocalRuntimeIdSchema,
    localBaseUrl: LocalBaseUrlSchema,
    localModelTag: z.string().min(1).max(256),
    localModelDigest: LocalModelDigestSchema.nullable().default(null),
    hostedCallsEnabled: z.boolean(),
    spendDailyUsd: z.number().finite().positive().nullable().optional(),
    spendMonthlyUsd: z.number().finite().positive().nullable().optional(),
    spendUnlimited: z.boolean().optional(),
    defaultChatTarget: ChatTargetPreferenceSchema.default("local"),
  })
  .strict();

export const RuntimeSettingsSchema = RuntimeSettingsObjectSchema.superRefine(
  (settings, ctx) => {
    if (settings.hostedProvider === "custom-openai") {
      if (settings.customOpenAi === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["customOpenAi"],
          message: "Custom provider harus melewati validasi Connect sebelum diaktifkan.",
        });
        return;
      }
      if (settings.hostedModel !== settings.customOpenAi.model) {
        ctx.addIssue({
          code: "custom",
          path: ["hostedModel"],
          message: "Model custom provider harus sama dengan model yang sudah divalidasi Connect.",
        });
      }
      return;
    }
    if (hostedModelSupported(settings.hostedProvider, settings.hostedModel)) return;
    ctx.addIssue({
      code: "custom",
      path: ["hostedModel"],
      message: `Model ${settings.hostedModel} belum diverifikasi untuk provider ${settings.hostedProvider}.`,
    });
  },
);

type ParsedRuntimeSettings = z.infer<typeof RuntimeSettingsSchema>;
export type RuntimeSettings = Omit<
  ParsedRuntimeSettings,
  "localModelDigest" | "openRouterModelSelection" | "openRouterCertifiedModelId"
> & {
  readonly openRouterModelSelection?: HostedModelPreference | undefined;
  readonly openRouterCertifiedModelId?: HostedModelPreference | undefined;
  readonly localModelDigest?: LocalModelDigest | null | undefined;
};

export const RuntimeSettingsPatchSchema = RuntimeSettingsObjectSchema.omit({
  openRouterCertifiedModelId: true,
  customOpenAi: true,
})
  .partial()
  .strict();
export type RuntimeSettingsPatch = z.infer<typeof RuntimeSettingsPatchSchema>;

export interface RuntimeSettingsSnapshot {
  readonly revision: number;
  readonly settings: RuntimeSettings;
}

export interface RuntimeSettingsReader {
  get(): RuntimeSettingsSnapshot;
}

export interface RuntimeSettingsAdmin extends RuntimeSettingsReader {
  update(patch: RuntimeSettingsPatch): RuntimeSettingsSnapshot;
  /**
   * Dedicated trusted mutation after Connect has admitted a fresh compatible OpenRouter
   * catalog entry. Generic runtime PATCH cannot mint this authority.
   */
  activateOpenRouterModel?: (modelId: HostedModelPreference) => RuntimeSettingsSnapshot;
  /** Legacy validation path; kept for explicit operator evidence workflows. */
  certifyOpenRouterModel?: (modelId: HostedModelPreference) => RuntimeSettingsSnapshot;
  /** Trusted activation after the custom endpoint/model/credential probe passes. */
  activateCustomOpenAi?: (config: CustomOpenAiConfig) => RuntimeSettingsSnapshot;
}

const RuntimeSettingsFileSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  settings: RuntimeSettingsSchema,
});

type RuntimeSettingsFile = z.infer<typeof RuntimeSettingsFileSchema>;

function cloneSettings(settings: RuntimeSettings): RuntimeSettings {
  return { ...settings };
}

/**
 * A raw OpenRouter preference is intentionally not execution authority. Only the
 * dedicated Connect admission path may bind the selected model to the trusted
 * openRouterCertifiedModelId marker (legacy field name).
 *
 * Generic Settings mutations therefore still fail closed: changing a selection clears the
 * trusted marker and normalization disables Hosted until Connect re-admits that exact model.
 */
export function normalizeOpenRouterRuntimeSettings<T extends RuntimeSettings>(settings: T): T {
  if (settings.hostedProvider !== "openrouter") return settings;

  const selection = settings.openRouterModelSelection ?? settings.hostedModel;
  const executable =
    selection === GOVERNED_HOSTED_MODEL ||
    executableHostedModelRegistryEntry("openrouter", selection) !== undefined ||
    settings.openRouterCertifiedModelId === selection;

  if (executable) return settings;

  return {
    ...settings,
    hostedModel: GOVERNED_HOSTED_MODEL,
    hostedCallsEnabled: false,
    defaultChatTarget: "local",
  } as T;
}

function settingsEqual(left: RuntimeSettings, right: RuntimeSettings): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class FileRuntimeSettings implements RuntimeSettingsAdmin {
  private readonly defaults: RuntimeSettings;

  constructor(
    private readonly path: string,
    defaults: {
      hostedProvider: HostedProviderId;
      hostedModel?: HostedModelPreference | undefined;
      customOpenAi?: CustomOpenAiConfig | undefined;
      openRouterModelSelection?: HostedModelPreference | undefined;
      openRouterCertifiedModelId?: HostedModelPreference | undefined;
      localRuntime: LocalRuntimeId;
      localBaseUrl: string;
      localModelTag: string;
      localModelDigest?: LocalModelDigest | null | undefined;
      hostedCallsEnabled: boolean;
      spendDailyUsd?: number | null | undefined;
      spendMonthlyUsd?: number | null | undefined;
      spendUnlimited?: boolean | undefined;
      defaultChatTarget?: ChatTargetPreference | undefined;
    },
  ) {
    this.defaults = normalizeOpenRouterRuntimeSettings(RuntimeSettingsSchema.parse(defaults));
    // Konfigurasi proses yang alias-mutable digagalkan saat boot, bukan dibiarkan
    // menghasilkan evidence dengan nama model yang tidak berarti apa-apa.
    assertLocalModelTagWritable(this.defaults);
  }

  private read(): RuntimeSettingsFile {
    if (!existsSync(this.path)) {
      return { version: 1, revision: 0, settings: RuntimeSettingsSchema.parse(this.defaults) };
    }
    const persisted = RuntimeSettingsFileSchema.parse(
      JSON.parse(readFileSync(this.path, "utf8")) as unknown,
    );
    const normalizedSettings = normalizeOpenRouterRuntimeSettings(persisted.settings);
    if (settingsEqual(persisted.settings, normalizedSettings)) return persisted;

    // One-time self-healing migration for a state created by the prior broad Settings
    // mutation. The revision advances so every client reload observes the repaired state.
    const repaired: RuntimeSettingsFile = {
      version: 1,
      revision: persisted.revision + 1,
      settings: normalizedSettings,
    };
    this.persist(repaired);
    return repaired;
  }

  private persist(next: RuntimeSettingsFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp-${String(process.pid)}`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, this.path);
    chmodSync(this.path, 0o600);
  }

  get(): RuntimeSettingsSnapshot {
    const state = this.read();
    return { revision: state.revision, settings: cloneSettings(state.settings) };
  }

  update(patch: RuntimeSettingsPatch): RuntimeSettingsSnapshot {
    const normalized = RuntimeSettingsPatchSchema.parse(patch);
    const prior = this.read();
    const identityBoundaryChanged =
      (normalized.localRuntime !== undefined &&
        normalized.localRuntime !== prior.settings.localRuntime) ||
      (normalized.localBaseUrl !== undefined &&
        normalized.localBaseUrl !== prior.settings.localBaseUrl) ||
      (normalized.localModelTag !== undefined &&
        normalized.localModelTag !== prior.settings.localModelTag);
    const parsed = RuntimeSettingsSchema.parse({
      ...prior.settings,
      ...normalized,
      ...(normalized.hostedProvider !== undefined &&
      normalized.hostedProvider !== prior.settings.hostedProvider &&
      normalized.hostedModel === undefined
        ? {
            hostedModel:
              normalized.hostedProvider === "custom-openai"
                ? (prior.settings.customOpenAi?.model ?? GOVERNED_HOSTED_MODEL)
                : GOVERNED_HOSTED_MODEL,
          }
        : {}),
      ...(identityBoundaryChanged && normalized.localModelDigest === undefined
        ? { localModelDigest: null }
        : {}),
      ...(normalized.openRouterModelSelection !== undefined &&
      normalized.openRouterModelSelection !== prior.settings.openRouterModelSelection
        ? { openRouterCertifiedModelId: undefined }
        : {}),
    });
    const settings = normalizeOpenRouterRuntimeSettings(parsed);
    assertLocalModelTagWritable(settings);
    const next: RuntimeSettingsFile = {
      version: 1,
      revision: prior.revision + 1,
      settings,
    };
    this.persist(next);
    return { revision: next.revision, settings: cloneSettings(next.settings) };
  }
  activateOpenRouterModel(modelId: HostedModelPreference): RuntimeSettingsSnapshot {
    const admitted = HostedModelPreferenceSchema.parse(modelId);
    if (admitted === GOVERNED_HOSTED_MODEL) {
      throw new Error("Model governed tidak memerlukan admission OpenRouter dinamis.");
    }
    const prior = this.read();
    const settings = RuntimeSettingsSchema.parse({
      ...prior.settings,
      hostedProvider: "openrouter",
      hostedModel: GOVERNED_HOSTED_MODEL,
      openRouterModelSelection: admitted,
      // Legacy persisted field name: this marker now means Connect admitted the exact
      // selection through its trusted fresh-catalog path, not that the user certified it.
      openRouterCertifiedModelId: admitted,
      hostedCallsEnabled: true,
      defaultChatTarget: "hosted",
    });
    const next: RuntimeSettingsFile = { revision: prior.revision + 1, version: 1, settings };
    this.persist(next);
    return { revision: next.revision, settings: cloneSettings(next.settings) };
  }

  certifyOpenRouterModel(modelId: HostedModelPreference): RuntimeSettingsSnapshot {
    return this.activateOpenRouterModel(modelId);
  }

  activateCustomOpenAi(config: CustomOpenAiConfig): RuntimeSettingsSnapshot {
    const admitted = CustomOpenAiConfigSchema.parse(config);
    const prior = this.read();
    const settings = RuntimeSettingsSchema.parse({
      ...prior.settings,
      hostedProvider: "custom-openai",
      hostedModel: admitted.model,
      customOpenAi: admitted,
      hostedCallsEnabled: true,
      defaultChatTarget: "hosted",
    });
    const next: RuntimeSettingsFile = { revision: prior.revision + 1, version: 1, settings };
    this.persist(next);
    return { revision: next.revision, settings: cloneSettings(next.settings) };
  }
}
