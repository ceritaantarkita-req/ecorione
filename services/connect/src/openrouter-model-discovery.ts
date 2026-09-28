import { Buffer } from "node:buffer";
import { z } from "zod";
import {
  executableHostedModelRegistryEntry,
  hostedModelRegistry,
} from "./hosted-model-registry.js";

export const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
export const DEFAULT_OPENROUTER_DISCOVERY_TTL_MS = 10 * 60 * 1_000;
export const DEFAULT_OPENROUTER_DISCOVERY_TIMEOUT_MS = 8_000;
export const MAX_OPENROUTER_CATALOG_BYTES = 8 * 1024 * 1024;

const OpenRouterPricingSchema = z
  .object({
    prompt: z.string().max(64).optional(),
    completion: z.string().max(64).optional(),
  })
  .passthrough();

const OpenRouterArchitectureSchema = z
  .object({
    input_modalities: z.array(z.string().max(64)).max(16).optional(),
    output_modalities: z.array(z.string().max(64)).max(16).optional(),
  })
  .passthrough();

const OpenRouterUpstreamModelSchema = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string().min(1).max(512),
    created: z.number().int().nonnegative().optional(),
    context_length: z.number().int().nonnegative().nullable().optional(),
    architecture: OpenRouterArchitectureSchema.optional(),
    pricing: OpenRouterPricingSchema.optional(),
    supported_parameters: z.array(z.string().max(128)).max(128).optional(),
  })
  .passthrough();

const OpenRouterUpstreamResponseSchema = z
  .object({
    data: z.array(OpenRouterUpstreamModelSchema).max(5_000),
  })
  .passthrough();

export interface OpenRouterDiscoveredModel {
  readonly id: string;
  readonly displayName: string;
  readonly sourceProvider: string;
  readonly contextWindowTokens: number | null;
  readonly inputModalities: readonly string[];
  readonly outputModalities: readonly string[];
  readonly supportedParameters: readonly string[];
  readonly promptPricePerToken: string | null;
  readonly completionPricePerToken: string | null;
  readonly mutableAlias: boolean;
  readonly admission: "verified-executable" | "discovered-only";
  readonly executable: boolean;
  readonly selectionId: string | null;
}

export interface OpenRouterDiscoveryQuery {
  readonly q?: string | undefined;
  readonly sourceProvider?: string | undefined;
  readonly limit?: number | undefined;
  readonly forceRefresh?: boolean | undefined;
}

export interface OpenRouterDiscoverySnapshot {
  readonly source: "openrouter:/api/v1/models";
  readonly cache: "hit" | "refreshed" | "stale";
  readonly stale: boolean;
  readonly fetchedAt: string;
  readonly expiresAt: string;
  readonly total: number;
  readonly returned: number;
  readonly models: readonly OpenRouterDiscoveredModel[];
}

interface CachedCatalog {
  readonly models: readonly OpenRouterDiscoveredModel[];
  readonly fetchedAtMs: number;
  readonly expiresAtMs: number;
}

export class OpenRouterModelDiscoveryError extends Error {
  constructor(
    readonly kind: "unreachable" | "invalid-response",
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterModelDiscoveryError";
  }
}

export interface OpenRouterModelDiscoveryReader {
  list(query?: OpenRouterDiscoveryQuery): Promise<OpenRouterDiscoverySnapshot>;
}

export interface OpenRouterModelDiscoveryOptions {
  readonly endpoint?: string | undefined;
  readonly ttlMs?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly now?: (() => number) | undefined;
  readonly fetcher?: typeof fetch | undefined;
}

function sourceProviderFromId(id: string): string {
  const normalized = id.replace(/^~/u, "");
  const [provider] = normalized.split("/", 1);
  return provider?.trim().toLowerCase() || "unknown";
}

function isMutableAlias(id: string): boolean {
  return id.startsWith("~");
}

function normalizeModel(
  model: z.infer<typeof OpenRouterUpstreamModelSchema>,
): OpenRouterDiscoveredModel {
  const verified = hostedModelRegistry("openrouter").find(
    (entry) => entry.providerRuntime === model.id,
  );
  const executable =
    verified !== undefined &&
    executableHostedModelRegistryEntry("openrouter", verified.id) !== undefined;
  return {
    id: model.id,
    displayName: model.name,
    sourceProvider: sourceProviderFromId(model.id),
    contextWindowTokens: model.context_length ?? null,
    inputModalities: [...(model.architecture?.input_modalities ?? [])],
    outputModalities: [...(model.architecture?.output_modalities ?? [])],
    supportedParameters: [...(model.supported_parameters ?? [])],
    promptPricePerToken: model.pricing?.prompt ?? null,
    completionPricePerToken: model.pricing?.completion ?? null,
    mutableAlias: isMutableAlias(model.id),
    admission: executable ? "verified-executable" : "discovered-only",
    executable,
    selectionId: executable ? (verified?.id ?? null) : null,
  };
}

function normalizeSearch(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function filterCatalog(
  models: readonly OpenRouterDiscoveredModel[],
  query: OpenRouterDiscoveryQuery,
): readonly OpenRouterDiscoveredModel[] {
  const search = normalizeSearch(query.q);
  const sourceProvider = normalizeSearch(query.sourceProvider);
  return models.filter((model) => {
    if (sourceProvider !== null && model.sourceProvider !== sourceProvider) return false;
    if (search === null) return true;
    return (
      model.id.toLowerCase().includes(search) ||
      model.displayName.toLowerCase().includes(search) ||
      model.sourceProvider.includes(search)
    );
  });
}

export class OpenRouterModelDiscovery implements OpenRouterModelDiscoveryReader {
  private readonly endpoint: string;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly fetcher: typeof fetch;
  private cache: CachedCatalog | null = null;
  private refreshInFlight: Promise<CachedCatalog> | null = null;

  constructor(options: OpenRouterModelDiscoveryOptions = {}) {
    this.endpoint = options.endpoint ?? OPENROUTER_MODELS_ENDPOINT;
    this.ttlMs = options.ttlMs ?? DEFAULT_OPENROUTER_DISCOVERY_TTL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_OPENROUTER_DISCOVERY_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
    this.fetcher = options.fetcher ?? fetch;
  }

  private async fetchCatalog(): Promise<CachedCatalog> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetcher(this.endpoint, {
          method: "GET",
          headers: { accept: "application/json" },
          redirect: "error",
          signal: controller.signal,
        });
      } catch {
        const reason = controller.signal.aborted ? "timeout" : "network error";
        throw new OpenRouterModelDiscoveryError(
          "unreachable",
          `OpenRouter model catalog tidak bisa dihubungi (${reason}).`,
        );
      }

      if (!response.ok) {
        throw new OpenRouterModelDiscoveryError(
          "unreachable",
          `OpenRouter model catalog mengembalikan HTTP ${String(response.status)}.`,
        );
      }

      let raw: unknown;
      try {
        const text = await response.text();
        if (Buffer.byteLength(text, "utf8") > MAX_OPENROUTER_CATALOG_BYTES) {
          throw new OpenRouterModelDiscoveryError(
            "invalid-response",
            "OpenRouter model catalog melewati batas ukuran discovery ECORIONE.",
          );
        }
        raw = JSON.parse(text) as unknown;
      } catch (error) {
        if (error instanceof OpenRouterModelDiscoveryError) throw error;
        throw new OpenRouterModelDiscoveryError(
          "invalid-response",
          "OpenRouter model catalog mengembalikan JSON yang tidak valid.",
        );
      }

      const parsed = OpenRouterUpstreamResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new OpenRouterModelDiscoveryError(
          "invalid-response",
          "OpenRouter model catalog tidak sesuai kontrak discovery ECORIONE.",
        );
      }

      const fetchedAtMs = this.now();
      const models = parsed.data.data.map(normalizeModel);
      return {
        models,
        fetchedAtMs,
        expiresAtMs: fetchedAtMs + this.ttlMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async refresh(): Promise<CachedCatalog> {
    if (this.refreshInFlight !== null) return this.refreshInFlight;
    this.refreshInFlight = this.fetchCatalog()
      .then((catalog) => {
        this.cache = catalog;
        return catalog;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }

  async list(query: OpenRouterDiscoveryQuery = {}): Promise<OpenRouterDiscoverySnapshot> {
    const now = this.now();
    let catalog = this.cache;
    let cacheState: OpenRouterDiscoverySnapshot["cache"] = "hit";
    let stale = false;

    const needsRefresh =
      query.forceRefresh === true || catalog === null || now >= catalog.expiresAtMs;
    if (needsRefresh) {
      try {
        catalog = await this.refresh();
        cacheState = "refreshed";
      } catch (error) {
        if (this.cache === null) throw error;
        catalog = this.cache;
        cacheState = "stale";
        stale = true;
      }
    }

    if (catalog === null) {
      throw new OpenRouterModelDiscoveryError(
        "unreachable",
        "OpenRouter model catalog belum tersedia.",
      );
    }

    const filtered = filterCatalog(catalog.models, query);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const models = filtered.slice(0, limit);
    return {
      source: "openrouter:/api/v1/models",
      cache: cacheState,
      stale,
      fetchedAt: new Date(catalog.fetchedAtMs).toISOString(),
      expiresAt: new Date(catalog.expiresAtMs).toISOString(),
      total: filtered.length,
      returned: models.length,
      models,
    };
  }
}
