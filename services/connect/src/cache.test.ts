import { describe, expect, it } from "vitest";
import { cacheKey, ExactMatchCache } from "./cache.js";

const BASE_INPUT = {
  model: "claude-sonnet-4-5-20250929",
  prefixDigest: "abc123",
  dynamicText: "<untrusted_memory></untrusted_memory>",
  userMessage: "halo",
};

describe("cacheKey", () => {
  it("deterministik: input sama → key sama", () => {
    expect(cacheKey(BASE_INPUT)).toBe(cacheKey({ ...BASE_INPUT }));
  });

  it("berbeda kalau salah satu field berbeda", () => {
    const a = cacheKey(BASE_INPUT);
    const b = cacheKey({ ...BASE_INPUT, userMessage: "beda" });
    expect(a).not.toBe(b);
  });

  it("tidak ambigu di batas antar-field (konkatenasi polos akan tabrakan di sini)", () => {
    const a = cacheKey({ ...BASE_INPUT, dynamicText: "ab", userMessage: "c" });
    const b = cacheKey({ ...BASE_INPUT, dynamicText: "a", userMessage: "bc" });
    expect(a).not.toBe(b);
  });
});

describe("ExactMatchCache", () => {
  it("get sebelum set → null", () => {
    const cache = new ExactMatchCache();
    expect(cache.get("k", 1000)).toBeNull();
  });

  it("set lalu get dalam TTL → entry yang sama", () => {
    const cache = new ExactMatchCache(10_000);
    const entry = { reply: "halo", model: "m", usage: tokenUsage() };
    cache.set("k", entry, 1000);
    expect(cache.get("k", 5000)).toEqual(entry);
  });

  it("kedaluwarsa setelah TTL lewat → null, dan entry dibuang", () => {
    const cache = new ExactMatchCache(10_000);
    const entry = { reply: "halo", model: "m", usage: tokenUsage() };
    cache.set("k", entry, 1000);
    expect(cache.get("k", 1000 + 10_000)).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("tepat di batas TTL (expiresAtMs === nowMs) dianggap kedaluwarsa", () => {
    const cache = new ExactMatchCache(1000);
    cache.set("k", { reply: "x", model: "m", usage: tokenUsage() }, 0);
    expect(cache.get("k", 1000)).toBeNull();
  });
});

function tokenUsage(): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
} {
  return { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 };
}
