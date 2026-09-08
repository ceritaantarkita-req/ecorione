import { describe, it, expect } from "vitest";
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
  it("menolak alias -latest", () => {
    expect(() => assertPinnedModel("claude-x-latest")).toThrow(ModelAliasError); // naming-gate:allow
  });

  it("menolak bentuk alias lainnya", () => {
    expect(() => assertPinnedModel("latest")).toThrow(ModelAliasError);
    expect(() => assertPinnedModel("openai/gpt-4.1:latest")).toThrow(ModelAliasError);
  });

  it("alias diperiksa sebelum keanggotaan tabel, supaya pesannya menyebut ADR-14", () => {
    // Kalau urutannya terbalik, alias yang tidak ada di tabel akan dilaporkan sebagai
    // "model tidak dikenal" dan alasan sebenarnya hilang dari pesan error.
    expect(() => assertPinnedModel("claude-sonnet-latest")).toThrow(/ADR-14/); // naming-gate:allow
  });

  it("menerima ID yang dipin dan mengembalikannya", () => {
    expect(assertPinnedModel("claude-sonnet-4-5-20250929")).toBe("claude-sonnet-4-5-20250929");
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
    // Penjaga untuk suntingan berikutnya: menambah "…-latest" ke tabel akan membuat
    // assertPinnedModel menolak model yang justru ada harganya.
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
      // Kalau baca cache lebih mahal dari input, seluruh premis ADR-01 terbalik.
      expect(p.cacheReadPerMTok, id).toBeLessThanOrEqual(p.inputPerMTok);
    }
  });

  it("model Anthropic memakai pengali 1,25x tulis dan 0,1x baca", () => {
    // Angka ini yang dipakai test break-even di cost.test.ts.
    const p = MODEL_PRICES["claude-sonnet-4-5-20250929"];
    expect(p.cacheWritePerMTok / p.inputPerMTok).toBeCloseTo(1.25, 10);
    expect(p.cacheReadPerMTok / p.inputPerMTok).toBeCloseTo(0.1, 10);
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
