import { describe, expect, it } from "vitest";
import {
  MODEL_PRICES,
  ModelAliasError,
  UnknownModelError,
  assertPinnedModel,
  isPinnedModel,
  pinnedModelIds,
  priceFor,
} from "./pricing.js";

describe("assertPinnedModel (ADR-14)", () => {
  it("menolak alias latest dan unsuffixed provider alias", () => {
    expect(() => assertPinnedModel("claude-x-latest")).toThrow(ModelAliasError); // naming-gate:allow
    expect(() => assertPinnedModel("latest")).toThrow(ModelAliasError);
    expect(() => assertPinnedModel("openai/gpt-4.1:latest")).toThrow(ModelAliasError);
    expect(() => assertPinnedModel("gpt-5.6")).toThrow(ModelAliasError);
  });

  it("alias diperiksa sebelum keanggotaan tabel", () => {
    expect(() => assertPinnedModel("claude-sonnet-latest")).toThrow(/ADR-14/); // naming-gate:allow
  });

  it("menerima explicit model identities", () => {
    expect(assertPinnedModel("claude-sonnet-4-5-20250929")).toBe("claude-sonnet-4-5-20250929");
    expect(assertPinnedModel("gpt-5.6-sol")).toBe("gpt-5.6-sol");
    expect(assertPinnedModel("gpt-5.6-terra")).toBe("gpt-5.6-terra");
    expect(assertPinnedModel("gpt-5.6-luna")).toBe("gpt-5.6-luna");
  });

  it("menolak model yang tidak ada di tabel harga", () => {
    expect(() => assertPinnedModel("gpt-9-20990101")).toThrow(UnknownModelError);
  });

  it("tidak tertipu properti prototype", () => {
    expect(isPinnedModel("toString")).toBe(false);
    expect(() => assertPinnedModel("constructor")).toThrow(UnknownModelError);
  });
});

describe("tabel harga", () => {
  it("tidak ada satu pun kunci yang berbentuk alias", () => {
    for (const id of pinnedModelIds()) {
      expect(isPinnedModel(id), `kunci tabel ${id} tidak lolos gerbang pin`).toBe(true);
    }
  });

  it("semua harga non-negatif dan baca-cache tidak pernah lebih mahal dari input", () => {
    for (const id of pinnedModelIds()) {
      const p = MODEL_PRICES[id];
      expect(p.inputPerMTok).toBeGreaterThanOrEqual(0);
      expect(p.outputPerMTok).toBeGreaterThanOrEqual(0);
      expect(p.cacheWritePerMTok).toBeGreaterThanOrEqual(0);
      expect(p.cacheReadPerMTok).toBeGreaterThanOrEqual(0);
      expect(p.cacheReadPerMTok, id).toBeLessThanOrEqual(p.inputPerMTok);
    }
  });

  it("Anthropic dan GPT-5.6 memakai pricing snapshot yang eksplisit", () => {
    const claude = MODEL_PRICES["claude-sonnet-4-5-20250929"];
    expect(claude.cacheWritePerMTok / claude.inputPerMTok).toBeCloseTo(1.25, 10);
    expect(claude.cacheReadPerMTok / claude.inputPerMTok).toBeCloseTo(0.1, 10);

    expect(MODEL_PRICES["gpt-5.6-sol"]).toEqual({
      inputPerMTok: 4,
      outputPerMTok: 20,
      cacheWritePerMTok: 5,
      cacheReadPerMTok: 0.4,
    });
    expect(MODEL_PRICES["gpt-5.6-terra"]).toEqual({
      inputPerMTok: 2,
      outputPerMTok: 12,
      cacheWritePerMTok: 2.5,
      cacheReadPerMTok: 0.2,
    });
    expect(MODEL_PRICES["gpt-5.6-luna"]).toEqual({
      inputPerMTok: 0.2,
      outputPerMTok: 1.2,
      cacheWritePerMTok: 0.25,
      cacheReadPerMTok: 0.02,
    });
  });

  it("model lokal berharga nol", () => {
    const p = priceFor("local/qwen3-8b-instruct-q4_k_m");
    expect(p.inputPerMTok).toBe(0);
    expect(p.outputPerMTok).toBe(0);
  });

  it("tabel beku terhadap mutasi runtime", () => {
    expect(Object.isFrozen(MODEL_PRICES)).toBe(true);
    expect(Object.isFrozen(MODEL_PRICES["claude-sonnet-4-5-20250929"])).toBe(true);
  });
});

describe("priceFor", () => {
  it("melempar error yang menyebut nama modelnya", () => {
    expect(() => priceFor("mistral-medium-3")).toThrow(/mistral-medium-3/);
  });
});
