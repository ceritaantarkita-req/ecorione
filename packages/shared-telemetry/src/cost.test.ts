import { describe, it, expect } from "vitest";
import {
  CostLedger,
  DEFAULT_NAIVE_MODEL,
  computeCost,
  computeNaiveCost,
  recordCall,
  tokenUsage,
  type CallCostRecord,
} from "./cost.js";

const SONNET = "claude-sonnet-4-5-20250929";
const HAIKU = "claude-haiku-4-5-20251001";
const OPUS = "claude-opus-4-1-20250805";
const LOCAL = "local/qwen3-8b-instruct-q4_k_m";

const POLICY = { routeReason: "default", policyVersion: "v1", optimizerOverheadMs: 0 } as const;

describe("computeCost", () => {
  it("menagih tiap kelas token di tarifnya masing-masing", () => {
    // Sonnet: input 3, output 15, tulis 3,75, baca 0,3 per juta token.
    const cost = computeCost(SONNET, {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3 + 15 + 0.3 + 3.75, 10);
  });

  it("inputTokens adalah input yang TIDAK kena cache", () => {
    // Kalau adapter provider lupa mengurangi token ter-cache dari prompt_tokens, token
    // yang sama tertagih dua kali di sini — dan tidak ada yang gagal keras.
    const dobel = tokenUsage({ inputTokens: 100_000, cacheReadTokens: 100_000 });
    const salah = computeCost(SONNET, dobel);
    const benar = computeCost(SONNET, tokenUsage({ cacheReadTokens: 100_000 }));
    expect(salah).toBeGreaterThan(benar);
    expect(salah - benar).toBeCloseTo((100_000 * 3) / 1_000_000, 10);
  });

  it("biaya model lokal nol berapa pun tokennya", () => {
    const cost = computeCost(LOCAL, {
      inputTokens: 500_000,
      outputTokens: 500_000,
      cacheReadTokens: 500_000,
      cacheWriteTokens: 500_000,
    });
    expect(cost).toBe(0);
  });

  it("menolak usage yang tidak masuk akal", () => {
    const base = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(() => computeCost(SONNET, { ...base, inputTokens: -1 })).toThrow();
    expect(() => computeCost(SONNET, { ...base, outputTokens: 1.5 })).toThrow();
    expect(() => computeCost(SONNET, { ...base, cacheReadTokens: Number.NaN })).toThrow();
  });
});

describe("computeNaiveCost", () => {
  it("menagih seluruh token prompt di tarif input penuh, tanpa cache", () => {
    const usage = tokenUsage({
      inputTokens: 1_000,
      cacheReadTokens: 10_000,
      cacheWriteTokens: 5_000,
    });
    const naive = computeNaiveCost(SONNET, usage);
    expect(naive).toBeCloseTo((16_000 * 3) / 1_000_000, 10);
  });

  it("baseline default adalah model kuat yang wajar, bukan yang termahal", () => {
    // Memilih Opus sebagai baseline akan melipattigakan angka penghematan tanpa satu byte
    // pun benar-benar dihemat.
    expect(DEFAULT_NAIVE_MODEL).toBe(SONNET);
    expect(computeNaiveCost(OPUS, tokenUsage({ inputTokens: 1_000 }))).toBeGreaterThan(
      computeNaiveCost(SONNET, tokenUsage({ inputTokens: 1_000 })),
    );
  });
});

/**
 * Klaim ekonomi inti produk (ADR-01 + ADR-13). Dengan pengali Anthropic — tulis 1,25x,
 * baca 0,1x — memakai ulang satu prefix stabil sebanyak N kali berbiaya `1,25 + 0,1N`
 * satuan, melawan `N + 1` satuan di kebijakan naif. Kalau aritmetika biaya bergeser,
 * test ini yang harus merah lebih dulu, bukan slide penjualan.
 */
describe("aritmetika break-even prefix stabil", () => {
  const PREFIX_TOKENS = 10_000;

  function reusePrefix(n: number): CostLedger {
    const ledger = new CostLedger();
    // Panggilan pertama menulis prefix ke cache.
    ledger.record(
      recordCall({
        ...POLICY,
        model: SONNET,
        naiveModel: SONNET,
        usage: tokenUsage({ cacheWriteTokens: PREFIX_TOKENS }),
        routeReason: "prefix-warm",
      }),
    );
    // N panggilan berikutnya membacanya kembali.
    for (let i = 0; i < n; i += 1) {
      ledger.record(
        recordCall({
          ...POLICY,
          model: SONNET,
          naiveModel: SONNET,
          usage: tokenUsage({ cacheReadTokens: PREFIX_TOKENS }),
          routeReason: "prefix-hit",
        }),
      );
    }
    return ledger;
  }

  it("N=10 menghemat ~80%", () => {
    const s = reusePrefix(10).savingsSummary();
    const unit = (PREFIX_TOKENS * 3) / 1_000_000;
    expect(s.callCount).toBe(11);
    expect(s.actualUsd).toBeCloseTo((1.25 + 0.1 * 10) * unit, 12);
    expect(s.naiveUsd).toBeCloseTo(11 * unit, 12);
    expect(s.savedPct).toBeCloseTo((8.75 / 11) * 100, 10);
    expect(s.savedPct).toBeGreaterThan(79);
    expect(s.savedPct).toBeLessThan(81);
  });

  it("N=20 menghemat ~84%", () => {
    const s = reusePrefix(20).savingsSummary();
    const unit = (PREFIX_TOKENS * 3) / 1_000_000;
    expect(s.callCount).toBe(21);
    expect(s.actualUsd).toBeCloseTo((1.25 + 0.1 * 20) * unit, 12);
    expect(s.naiveUsd).toBeCloseTo(21 * unit, 12);
    expect(s.savedPct).toBeCloseTo((17.75 / 21) * 100, 10);
    expect(s.savedPct).toBeGreaterThan(83.5);
    expect(s.savedPct).toBeLessThan(85);
  });

  it("pemakaian ulang sekali saja masih rugi — titik impasnya bukan di N=1", () => {
    // 1,25 + 0,1 = 1,35 lawan 2,0 naif: sudah untung. Tapi tanpa pemakaian ulang sama
    // sekali (N=0) menulis cache justru 25% lebih mahal.
    const s = reusePrefix(0).savingsSummary();
    expect(s.savedPct).toBeCloseTo(-25, 10);
  });
});

describe("CostLedger", () => {
  it("meneruskan tiap entri ke sink yang diinjeksikan", () => {
    const seen: CallCostRecord[] = [];
    const ledger = new CostLedger((r) => seen.push(r));
    ledger.record(
      recordCall({ ...POLICY, model: SONNET, usage: tokenUsage({ inputTokens: 100 }) }),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.model).toBe(SONNET);
  });

  it("menjumlahkan biaya aktual dan naif lintas panggilan campuran", () => {
    const ledger = new CostLedger();
    ledger.record(
      recordCall({ ...POLICY, model: HAIKU, usage: tokenUsage({ inputTokens: 100_000 }) }),
    );
    ledger.record(
      recordCall({ ...POLICY, model: LOCAL, usage: tokenUsage({ inputTokens: 100_000 }) }),
    );
    const s = ledger.savingsSummary();
    // Haiku 0,1 USD + lokal 0 USD lawan naif Sonnet 2 x 0,3 USD.
    expect(ledger.total()).toBeCloseTo(0.1, 10);
    expect(s.actualUsd).toBeCloseTo(0.1, 10);
    expect(s.naiveUsd).toBeCloseTo(0.6, 10);
    expect(s.savedUsd).toBeCloseTo(0.5, 10);
    expect(s.callCount).toBe(2);
    expect(s.escalatedCallCount).toBe(0);
  });

  it("menghitung biaya retry yang naik model, dan tidak meng-clamp hasilnya", () => {
    const usage = tokenUsage({ inputTokens: 10_000, outputTokens: 1_000 });
    const ledger = new CostLedger();
    // Percobaan pertama di model murah — gagal, tapi uangnya sudah keluar.
    ledger.record(recordCall({ ...POLICY, model: HAIKU, usage, routeReason: "cheap-first" }));
    // Retry naik ke Opus. Biaya ini WAJIB ikut terhitung.
    ledger.record(
      recordCall({
        ...POLICY,
        model: OPUS,
        usage,
        routeReason: "escalate",
        escalatedFrom: HAIKU,
      }),
    );

    const s = ledger.savingsSummary();
    expect(s.callCount).toBe(2);
    expect(s.escalatedCallCount).toBe(1);
    expect(s.actualUsd).toBeCloseTo(0.015 + 0.225, 10);
    expect(s.naiveUsd).toBeCloseTo(0.045 * 2, 10);
    // Rangkaian ini benar-benar lebih mahal dari kebijakan naif. Angkanya negatif, dan
    // memang harus terlihat negatif.
    expect(s.savedUsd).toBeLessThan(0);
    expect(s.savedPct).toBeCloseTo((-0.15 / 0.09) * 100, 8);
  });

  it("baseline nol menghasilkan 0%, bukan NaN", () => {
    const ledger = new CostLedger();
    ledger.record(
      recordCall({ ...POLICY, model: LOCAL, naiveModel: LOCAL, usage: tokenUsage() }),
    );
    expect(ledger.savingsSummary().savedPct).toBe(0);
  });
});

describe("recordCall", () => {
  it("membawa alasan rute, versi kebijakan, dan overhead optimizer", () => {
    const r = recordCall({
      model: HAIKU,
      usage: tokenUsage({ inputTokens: 1_000 }),
      routeReason: "sensitivity-gate:public",
      policyVersion: "2026.09.1",
      optimizerOverheadMs: 12,
    });
    expect(r.routeReason).toBe("sensitivity-gate:public");
    expect(r.policyVersion).toBe("2026.09.1");
    // Latensi routing dibebankan ke optimizer, bukan disembunyikan di latensi model.
    expect(r.optimizerOverheadMs).toBe(12);
    expect(r.naiveModel).toBe(DEFAULT_NAIVE_MODEL);
  });

  it("tidak memasang field opsional kalau tidak diisi", () => {
    const r = recordCall({ ...POLICY, model: HAIKU, usage: tokenUsage({ inputTokens: 1 }) });
    expect("escalatedFrom" in r).toBe(false);
    expect("operationId" in r).toBe(false);
  });
});
