import type { LocalModelDigest } from "./local-model-identity.js";
import {
  LocalModelDigestMismatchError,
  resolveLocalModelProvenance,
  type LocalModelProvenanceStatus,
} from "./providers/local-model-provenance.js";
import type { LocalRuntimeId } from "./providers/local-runtime.js";

export type LocalRuntimeDiscoveryState =
  | "connected"
  | "model-missing"
  | "identity-mismatch"
  | "unreachable"
  | "unsupported";

export interface LocalRuntimeDiscoveryInput {
  readonly runtime: LocalRuntimeId;
  readonly baseUrl: string;
  readonly modelTag: string;
  readonly declaredDigest?: LocalModelDigest | null | undefined;
}

export interface LocalRuntimeDiscoveryResult {
  readonly runtime: LocalRuntimeId;
  readonly state: LocalRuntimeDiscoveryState;
  readonly reachable: boolean;
  readonly ready: boolean;
  readonly configuredModel: string;
  readonly models: readonly string[];
  readonly modelDigest: LocalModelDigest | null;
  readonly identityProvenance: LocalModelProvenanceStatus;
  readonly identitySource: string;
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
      modelDigest: input.declaredDigest ?? null,
      identityProvenance: input.declaredDigest == null ? "unverified" : "declared-unverified",
      identitySource: input.declaredDigest == null ? "none" : "operator-declaration",
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
      modelDigest: input.declaredDigest ?? null,
      identityProvenance: input.declaredDigest == null ? "unverified" : "declared-unverified",
      identitySource: input.declaredDigest == null ? "none" : "operator-declaration",
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
      modelDigest: input.declaredDigest ?? null,
      identityProvenance: input.declaredDigest == null ? "unverified" : "declared-unverified",
      identitySource: input.declaredDigest == null ? "none" : "operator-declaration",
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
      modelDigest: input.declaredDigest ?? null,
      identityProvenance: input.declaredDigest == null ? "unverified" : "declared-unverified",
      identitySource: input.declaredDigest == null ? "none" : "operator-declaration",
      message: `Local endpoint is connected, but model ${input.modelTag} is not available.`,
    };
  }

  const provenanceFetch = async (
    url: string,
    init?: { signal?: AbortSignal | undefined },
  ) => {
    const response = await fetcher(url, { signal: init?.signal });
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    };
  };

  try {
    const provenance = await resolveLocalModelProvenance({
      baseUrl: input.baseUrl,
      modelTag: input.modelTag,
      declaredDigest: input.declaredDigest ?? null,
      fetchImpl: provenanceFetch,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      runtime: input.runtime,
      state: "connected",
      reachable: true,
      ready: true,
      configuredModel: input.modelTag,
      models,
      modelDigest: provenance.digest,
      identityProvenance: provenance.status,
      identitySource: provenance.source,
      message: `Local AI · Connected · ${input.modelTag}.`,
    };
  } catch (error) {
    if (error instanceof LocalModelDigestMismatchError) {
      return {
        runtime: input.runtime,
        state: "identity-mismatch",
        reachable: true,
        ready: false,
        configuredModel: input.modelTag,
        models,
        modelDigest: error.observed,
        identityProvenance: "unverified",
        identitySource: "runtime-observation",
        message: "Local AI reachable, but the configured model digest does not match the runtime.",
      };
    }
    throw error;
  }
}
