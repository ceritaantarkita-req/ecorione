/** Bounded exact-match cache. */
import { createHash } from "node:crypto";
import type { TokenUsage } from "@ecorione/shared-telemetry";

export interface CacheKeyInput {
  readonly model: string;
  readonly prefixDigest: string;
  readonly dynamicText: string;
  readonly userMessage: string;
}
export function cacheKey(input: CacheKeyInput): string {
  const h = createHash("sha256");
  for (const part of [input.model, input.prefixDigest, input.dynamicText, input.userMessage]) {
    h.update(part);
    h.update("\u0000");
  }
  return h.digest("hex");
}
export interface CacheEntry {
  readonly reply: string;
  readonly model: string;
  readonly usage: TokenUsage;
}
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1_000;
export class ExactMatchCache {
  readonly #entries = new Map<string, { entry: CacheEntry; expiresAtMs: number }>();
  constructor(
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
  ) {
    if (ttlMs <= 0 || maxEntries <= 0)
      throw new RangeError("Cache TTL/maxEntries harus positif.");
  }
  private prune(nowMs: number): void {
    for (const [key, value] of this.#entries)
      if (value.expiresAtMs <= nowMs) this.#entries.delete(key);
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }
  get(key: string, nowMs: number): CacheEntry | null {
    this.prune(nowMs);
    const found = this.#entries.get(key);
    if (found === undefined) return null;
    // refresh insertion order for basic LRU behavior
    this.#entries.delete(key);
    this.#entries.set(key, found);
    return found.entry;
  }
  set(key: string, entry: CacheEntry, nowMs: number): void {
    this.prune(nowMs);
    this.#entries.delete(key);
    this.#entries.set(key, { entry, expiresAtMs: nowMs + this.ttlMs });
    this.prune(nowMs);
  }
  size(): number {
    return this.#entries.size;
  }
}
