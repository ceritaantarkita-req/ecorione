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

const RuntimeSettingsObjectSchema = z
  .object({
    hostedProvider: HostedProviderIdSchema,
    hostedModel: HostedModelPreferenceSchema.default(GOVERNED_HOSTED_MODEL),
    localRuntime: LocalRuntimeIdSchema,
    localBaseUrl: z.string().min(1).max(2048).superRefine(safeBaseUrl),
    localModelTag: z.string().min(1).max(256),
    localModelDigest: LocalModelDigestSchema.nullable().default(null),
    hostedCallsEnabled: z.boolean(),
    defaultChatTarget: ChatTargetPreferenceSchema.default("local"),
  })
  .strict();

export const RuntimeSettingsSchema = RuntimeSettingsObjectSchema.superRefine(
  (settings, ctx) => {
    if (hostedModelSupported(settings.hostedProvider, settings.hostedModel)) return;
    ctx.addIssue({
      code: "custom",
      path: ["hostedModel"],
      message: `Model ${settings.hostedModel} belum diverifikasi untuk provider ${settings.hostedProvider}.`,
    });
  },
);

type ParsedRuntimeSettings = z.infer<typeof RuntimeSettingsSchema>;
export type RuntimeSettings = Omit<ParsedRuntimeSettings, "localModelDigest"> & {
  readonly localModelDigest?: LocalModelDigest | null | undefined;
};

export const RuntimeSettingsPatchSchema = RuntimeSettingsObjectSchema.partial().strict();
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

export class FileRuntimeSettings implements RuntimeSettingsAdmin {
  private readonly defaults: RuntimeSettings;

  constructor(
    private readonly path: string,
    defaults: {
      hostedProvider: HostedProviderId;
      hostedModel?: HostedModelPreference | undefined;
      localRuntime: LocalRuntimeId;
      localBaseUrl: string;
      localModelTag: string;
      localModelDigest?: LocalModelDigest | null | undefined;
      hostedCallsEnabled: boolean;
      defaultChatTarget?: ChatTargetPreference | undefined;
    },
  ) {
    this.defaults = RuntimeSettingsSchema.parse(defaults);
    // Konfigurasi proses yang alias-mutable digagalkan saat boot, bukan dibiarkan
    // menghasilkan evidence dengan nama model yang tidak berarti apa-apa.
    assertLocalModelTagWritable(this.defaults);
  }

  private read(): RuntimeSettingsFile {
    if (!existsSync(this.path)) {
      return { version: 1, revision: 0, settings: RuntimeSettingsSchema.parse(this.defaults) };
    }
    return RuntimeSettingsFileSchema.parse(
      JSON.parse(readFileSync(this.path, "utf8")) as unknown,
    );
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
    const settings = RuntimeSettingsSchema.parse({
      ...prior.settings,
      ...normalized,
      ...(normalized.hostedProvider !== undefined &&
      normalized.hostedProvider !== prior.settings.hostedProvider &&
      normalized.hostedModel === undefined
        ? { hostedModel: GOVERNED_HOSTED_MODEL }
        : {}),
      ...(identityBoundaryChanged && normalized.localModelDigest === undefined
        ? { localModelDigest: null }
        : {}),
    });
    assertLocalModelTagWritable(settings);
    const next: RuntimeSettingsFile = {
      version: 1,
      revision: prior.revision + 1,
      settings,
    };
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp-${String(process.pid)}`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, this.path);
    chmodSync(this.path, 0o600);
    return { revision: next.revision, settings: cloneSettings(next.settings) };
  }
}
