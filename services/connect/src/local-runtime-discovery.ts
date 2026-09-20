import type { LocalRuntimeId } from "./providers/local-runtime.js";

export type LocalRuntimeDiscoveryState =
  | "connected"
  | "model-missing"
  | "unreachable"
  | "unsupported";

export interface LocalRuntimeDiscoveryInput {
  readonly runtime: LocalRuntimeId;
  readonly baseUrl: string;
  readonly modelTag: string;
}

export interface LocalRuntimeDiscoveryResult {
  readonly runtime: LocalRuntimeId;
  readonly state: LocalRuntimeDiscoveryState;
  readonly reachable: boolean;
  readonly ready: boolean;
  readonly configuredModel: string;
  readonly models: readonly string[];
  readonly message: string;
}

interface OpenAiModelsResponse {
  readonly data?: ReadonlyArray<{ readonly id?: unknown }>;
}

export function localModelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}/models`;
}

function modelIds(value: unknown): string[] | null {
  if (typeof value !== "object" || value === null) return null;
  const data = (value as OpenAiModelsResponse).data;
  if (!Array.isArray(data)) return null;
  const ids = data
    .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
    .filter((id) => id.length > 0);
  return [...new Set(ids)];
}

export async function discoverLocalRuntime(
  input: LocalRuntimeDiscoveryInput,
  options: {
    readonly fetcher?: typeof fetch | undefined;
    readonly timeoutMs?: number | undefined;
  } = {},
): Promise<LocalRuntimeDiscoveryResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2_500;
  let response: Response;
  try {
    response = await fetcher(localModelsUrl(input.baseUrl), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return {
      runtime: input.runtime,
      state: "unreachable",
      reachable: false,
      ready: false,
      configuredModel: input.modelTag,
      models: [],
      message: "Local AI · Not connected. Start or configure an OpenAI-compatible runtime.",
    };
  }

  if (!response.ok) {
    return {
      runtime: input.runtime,
      state: "unsupported",
      reachable: true,
      ready: false,
      configuredModel: input.modelTag,
      models: [],
      message:
        "Local endpoint is reachable, but model discovery is unavailable. Use Test local runtime to verify it.",
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    parsed = undefined;
  }
  const models = modelIds(parsed);
  if (models === null) {
    return {
      runtime: input.runtime,
      state: "unsupported",
      reachable: true,
      ready: false,
      configuredModel: input.modelTag,
      models: [],
      message:
        "Local endpoint is reachable, but it did not return an OpenAI-compatible model catalog.",
    };
  }

  if (!models.includes(input.modelTag)) {
    return {
      runtime: input.runtime,
      state: "model-missing",
      reachable: true,
      ready: false,
      configuredModel: input.modelTag,
      models,
      message: `Local endpoint is connected, but model ${input.modelTag} is not available.`,
    };
  }

  return {
    runtime: input.runtime,
    state: "connected",
    reachable: true,
    ready: true,
    configuredModel: input.modelTag,
    models,
    message: `Local AI · Connected · ${input.modelTag}.`,
  };
}
