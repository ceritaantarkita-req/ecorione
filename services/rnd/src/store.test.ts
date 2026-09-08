import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Timestamp } from "@ecorione/shared-schema";
import { openRndDatabase, type RndDatabase } from "./db.js";
import { TraceStore } from "./store.js";

const T0 = "2026-09-01T00:00:00.000Z" as Timestamp;
const T1 = "2026-09-01T00:00:05.000Z" as Timestamp;

let db: RndDatabase;
let store: TraceStore;

beforeEach(() => {
  db = openRndDatabase();
  store = new TraceStore(db);
});

afterEach(() => {
  db.close();
});

describe("TraceStore", () => {
  it("menyimpan dan membaca kembali satu span", () => {
    const record = store.record({
      name: "chat claude-sonnet-4-5-20250929",
      attributes: { "gen_ai.provider.name": "anthropic" },
      operationId: "op_a",
      recordedAt: T0,
    });

    const fetched = store.get(record.id);
    expect(fetched?.name).toBe("chat claude-sonnet-4-5-20250929");
    expect(fetched?.attributes["gen_ai.provider.name"]).toBe("anthropic");
    expect(fetched?.operationId).toBe("op_a");
  });

  it("get() mengembalikan null untuk id yang tidak ada", () => {
    expect(store.get("span_tidak_ada")).toBeNull();
  });

  it("list() memfilter berdasarkan operationId, terbaru dulu", () => {
    store.record({ name: "a", attributes: {}, operationId: "op_a", recordedAt: T0 });
    store.record({ name: "b", attributes: {}, operationId: "op_b", recordedAt: T0 });
    store.record({ name: "c", attributes: {}, operationId: "op_a", recordedAt: T1 });

    const results = store.list({ operationId: "op_a" });
    expect(results.map((r) => r.name)).toEqual(["c", "a"]);
  });

  it("list() memfilter berdasarkan traceId", () => {
    store.record({ name: "a", attributes: {}, traceId: "trace_1", recordedAt: T0 });
    store.record({ name: "b", attributes: {}, traceId: "trace_2", recordedAt: T0 });

    expect(store.list({ traceId: "trace_1" }).map((r) => r.name)).toEqual(["a"]);
  });

  it("list() menghormati limit", () => {
    for (let i = 0; i < 5; i += 1) {
      store.record({ name: `span-${String(i)}`, attributes: {}, recordedAt: T0 });
    }
    expect(store.list({ limit: 2 })).toHaveLength(2);
  });

  it("summary() menjumlahkan biaya lintas beberapa panggilan (mis. retry eskalasi)", () => {
    store.record({
      name: "chat model-murah",
      attributes: {
        "ecorione.cost.actual_usd": 0.001,
        "ecorione.cost.naive_usd": 0.01,
      },
      operationId: "op_a",
      recordedAt: T0,
    });
    store.record({
      name: "chat model-kuat (eskalasi)",
      attributes: {
        "ecorione.cost.actual_usd": 0.02,
        "ecorione.cost.naive_usd": 0.01,
      },
      operationId: "op_a",
      recordedAt: T1,
    });

    const summary = store.summary("op_a");
    expect(summary.callCount).toBe(2);
    expect(summary.totalActualUsd).toBeCloseTo(0.021);
    expect(summary.totalNaiveUsd).toBeCloseTo(0.02);
    // Boleh negatif — eskalasi dua panggilan bisa lebih mahal dari baseline naif satu
    // panggilan, dan itu memang harus terlihat (ADR-13, tidak pernah di-clamp).
    expect(summary.totalSavedUsd).toBeCloseTo(-0.001);
  });

  it("summary() mengabaikan span tanpa atribut biaya", () => {
    store.record({
      name: "no-cost-span",
      attributes: { note: "bukan panggilan model" },
      operationId: "op_x",
      recordedAt: T0,
    });
    expect(store.summary("op_x")).toEqual({
      callCount: 0,
      totalActualUsd: 0,
      totalNaiveUsd: 0,
      totalSavedUsd: 0,
    });
  });

  it("summary() untuk operationId yang tidak ada span-nya sama sekali", () => {
    expect(store.summary("op_kosong")).toEqual({
      callCount: 0,
      totalActualUsd: 0,
      totalNaiveUsd: 0,
      totalSavedUsd: 0,
    });
  });
});
