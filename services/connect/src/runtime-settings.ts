import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
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
}

export const RuntimeSettingsSchema = z
  .object({
    hostedProvider: HostedProviderIdSchema,
    localRuntime: LocalRuntimeIdSchema,
    localBaseUrl: z.string().min(1).max(2048).superRefine(safeBaseUrl),
    localModelTag: z.string().min(1).max(256),
    hostedCallsEnabled: z.boolean(),
  })
  .strict();
export type RuntimeSettings = z.infer<typeof RuntimeSettingsSchema>;

export const RuntimeSettingsPatchSchema = RuntimeSettingsSchema.partial().strict();
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
      localRuntime: LocalRuntimeId;
      localBaseUrl: string;
      localModelTag: string;
      hostedCallsEnabled: boolean;
    },
  ) {
    this.defaults = RuntimeSettingsSchema.parse(defaults);
  }

  private read(): RuntimeSettingsFile {
    if (!existsSync(this.path)) {
      return { version: 1, revision: 0, settings: cloneSettings(this.defaults) };
    }
    return RuntimeSettingsFileSchema.parse(JSON.parse(readFileSync(this.path, "utf8")) as unknown);
  }

  get(): RuntimeSettingsSnapshot {
    const state = this.read();
    return { revision: state.revision, settings: cloneSettings(state.settings) };
  }

  update(patch: RuntimeSettingsPatch): RuntimeSettingsSnapshot {
    const normalized = RuntimeSettingsPatchSchema.parse(patch);
    const prior = this.read();
    const settings = RuntimeSettingsSchema.parse({ ...prior.settings, ...normalized });
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
