import { describe, expect, it } from "vitest";
import { CORE_MEMORY_TOKEN_LIMIT } from "@ecorione/shared-schema";
import { coreMemory, episode, hit, NOW, pointer, prefix, T0 } from "./fixtures.js";
import {
  assembleContextPack,
  ContextBudgetError,
  estimateTokens,
  type ContextPackInput,
} from "./pack.js";
import { prefixDigest } from "./prefix.js";
import { renderContextPack } from "./render.js";

const LONG =
  "Pengguna memilih pnpm untuk monorepo ini dan menolak turborepo karena alasan disk.";

function input(overrides: Partial<ContextPackInput> = {}): ContextPackInput {
  return {
    prefix: prefix(),
    candidateFacts: [
      hit("mem_a", `${LONG} A`, 0.9),
      hit("mem_b", `${LONG} B`, 0.8),
      hit("mem_c", `${LONG} C`, 0.7),
      hit("mem_d", `${LONG} D`, 0.6),
      hit("mem_e", `${LONG} E`, 0.5),
    ],
    episodicSummaries: [episode("epi_1", "Membahas anggaran token.", T0)],
    artifactPointers: [pointer("ab", "Catatan rapat minggu ini.")],
    ...overrides,
  };
}

describe("assembleContextPack", () => {
  it("memisahkan sisi stabil dan dinamis secara struktural", () => {
    const pack = assembleContextPack(input(), { tokenBudget: 4000, now: NOW });

    expect(pack.cacheBreakpointAfter).toBe("prefix");
    expect(Object.keys(pack.stable).sort()).toEqual(["digest", "prefix"]);
    expect(pack.stable.digest).toBe(prefixDigest(pack.stable.prefix));
    expect(pack.dynamic.assembledAt).toBe(NOW);
  });

  it("tidak pernah membocorkan konten dinamis ke sisi stabil", () => {
    const pack = assembleContextPack(input(), { tokenBudget: 4000, now: NOW });
    const stableJson = JSON.stringify(pack.stable);
    const { stableText } = renderContextPack(pack);

    for (const probe of [LONG, NOW, "Membahas anggaran token.", "Catatan rapat minggu ini."]) {
      expect(stableJson).not.toContain(probe);
      expect(stableText).not.toContain(probe);
    }
    // Sisi dinamis memang memuatnya — kalau tidak, test di atas jadi hijau palsu.
    expect(renderContextPack(pack).dynamicText).toContain(LONG);
  });

  it("membuang fakta peringkat terendah dulu, dan tidak menyentuh memori inti", () => {
    const data = input();
    const pack = assembleContextPack(data, { tokenBudget: 300, now: NOW });
    const kept = pack.dynamic.recalledFacts.map((h) => h.fact.id);

    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(data.candidateFacts.length);

    // Yang bertahan persis prefix teratas dari urutan skor.
    const rankedIds = ["mem_a", "mem_b", "mem_c", "mem_d", "mem_e"];
    expect(kept).toEqual(rankedIds.slice(0, kept.length));
    expect(pack.budget.droppedFactIds).toEqual(rankedIds.slice(kept.length));

    // Memori inti utuh — ia tidak pernah jadi variabel penyesuaian anggaran.
    expect(pack.stable.prefix.coreMemory).toEqual(coreMemory());
    expect(pack.budget.perTier.core).toBeGreaterThan(0);
    expect(pack.budget.usedTokens).toBeLessThanOrEqual(300);
  });

  it("menghormati k dan melaporkan berapa kandidat yang gugur karenanya", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      hit(`mem_${String.fromCharCode(97 + i)}`, `${LONG} ${String(i)}`, 1 - i / 100),
    );
    const pack = assembleContextPack(input({ candidateFacts: many }), {
      tokenBudget: 4000,
      k: 5,
      now: NOW,
    });

    expect(pack.dynamic.recalledFacts).toHaveLength(5);
    expect(pack.budget.trimmedByK).toBe(7);
  });

  it("menolak k di luar rentang — k besar bukan trade-off netral", () => {
    expect(() => assembleContextPack(input(), { tokenBudget: 4000, k: 50, now: NOW })).toThrow(
      RangeError,
    );
    expect(() => assembleContextPack(input(), { tokenBudget: 4000, k: 0, now: NOW })).toThrow(
      RangeError,
    );
  });

  it("melempar kalau memori inti melewati batas keras — itu bug konsolidasi", () => {
    const oversized = coreMemory("x".repeat((CORE_MEMORY_TOKEN_LIMIT + 200) * 4));

    try {
      assembleContextPack(input({ prefix: prefix({ coreMemory: oversized }) }), {
        tokenBudget: 100_000,
        now: NOW,
      });
      expect.unreachable("seharusnya melempar");
    } catch (err) {
      expect(err).toBeInstanceOf(ContextBudgetError);
      expect((err as ContextBudgetError).tier).toBe("core");
      expect((err as Error).message).toContain("konsolidasi");
    }
  });

  it("melempar kalau memori inti sendiri tidak muat di anggaran, bukan memangkasnya", () => {
    const big = coreMemory("y".repeat(4000)); // ~1000 token, masih di bawah batas keras
    expect(estimateTokens("y".repeat(4000))).toBe(1000);

    const err = (() => {
      try {
        assembleContextPack(input({ prefix: prefix({ coreMemory: big }) }), {
          tokenBudget: 500,
          now: NOW,
        });
        return null;
      } catch (e) {
        return e as ContextBudgetError;
      }
    })();

    expect(err).toBeInstanceOf(ContextBudgetError);
    expect(err?.tier).toBe("core");
  });

  it("menolak prefix yang mengandung nilai volatil sebelum request dikirim", () => {
    const bad = prefix({ coreMemory: coreMemory("Sesi dimulai 2026-09-08T10:30:00Z.") });

    expect(() =>
      assembleContextPack(input({ prefix: bad }), { tokenBudget: 4000, now: NOW }),
    ).toThrow(/pola|volatil|ADR-01/i);
    // Bisa dimatikan secara sadar (mis. saat mereproduksi trace lama), tidak diam-diam.
    expect(() =>
      assembleContextPack(input({ prefix: bad }), {
        tokenBudget: 4000,
        now: NOW,
        assertCacheablePrefix: false,
      }),
    ).not.toThrow();
  });

  it("mengurutkan ringkasan episodik dari yang terbaru", () => {
    const pack = assembleContextPack(
      input({
        episodicSummaries: [
          episode("epi_lama", "Percakapan lama.", "2026-09-01T09:00:00Z"),
          episode("epi_baru", "Percakapan barusan.", "2026-09-08T09:00:00Z"),
        ],
      }),
      { tokenBudget: 4000, now: NOW },
    );

    expect(pack.dynamic.episodicSummaries.map((e) => e.id)).toEqual(["epi_baru", "epi_lama"]);
  });
});

describe("estimateTokens", () => {
  it("heuristik ~4 karakter/token — gerbang, bukan penagihan", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
