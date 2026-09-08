import { describe, expect, it } from "vitest";
import { coreMemory, prefix, tool } from "./fixtures.js";
import {
  assertPrefixCacheable,
  assertPrefixStable,
  findVolatilePatterns,
  PrefixDivergenceError,
  prefixDigest,
  serializePrefix,
  VolatilePrefixError,
  type StablePrefix,
} from "./prefix.js";

describe("serializePrefix / prefixDigest", () => {
  /**
   * Ini regresi yang paling penting di seluruh package. Kalau test ini pernah merah,
   * klaim optimizer (ADR-01) sudah bocor: prefix yang sama menghasilkan hash berbeda,
   * cache provider tidak pernah kena, dan tidak ada satu pun error yang memberi tahu.
   */
  it("merakit prefix yang sama dua kali menghasilkan byte dan digest identik", () => {
    const a = prefix();
    const b = prefix();

    expect(serializePrefix(a)).toBe(serializePrefix(b));
    expect(prefixDigest(a)).toBe(prefixDigest(b));
    expect(prefixDigest(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("urutan penyisipan kunci tidak mempengaruhi serialisasi", () => {
    const schemaA = { type: "object", properties: { query: { type: "string" } } };
    const schemaB: Record<string, unknown> = {};
    schemaB["properties"] = { query: { type: "string" } };
    schemaB["type"] = "object";

    const a: StablePrefix = {
      systemPrompt: "sama",
      toolDefinitions: [tool({ inputSchema: schemaA })],
      coreMemory: coreMemory(),
    };
    // Urutan properti objek dibalik total — termasuk di JSON Schema tool.
    const b: StablePrefix = {
      coreMemory: coreMemory(),
      toolDefinitions: [tool({ inputSchema: schemaB })],
      systemPrompt: "sama",
    };

    expect(serializePrefix(a)).toBe(serializePrefix(b));
    expect(prefixDigest(a)).toBe(prefixDigest(b));
  });

  it("mengabaikan metadata yang tidak pernah dirender ke model", () => {
    // `updatedAt` berubah tiap kali pengguna mengedit blok, tapi tidak ikut ke wire.
    // Kalau ia ikut dihash, alarm cache akan menyala padahal teksnya identik.
    const a = prefix();
    const b = prefix({
      coreMemory: {
        blocks: coreMemory().blocks.map((blk) => ({
          ...blk,
          updatedAt: "2026-09-08T23:59:00Z",
          readOnly: true,
        })),
      },
    });

    expect(prefixDigest(a)).toBe(prefixDigest(b));
  });

  it("nilai yang berubah di prefix menghasilkan digest berbeda", () => {
    const a = prefix();
    const b = prefix({ systemPrompt: "Kamu asisten yang hemat konteks. Jawab ringkas!" });

    expect(prefixDigest(a)).not.toBe(prefixDigest(b));
  });

  it("urutan tool ikut dihitung — urutan berbeda adalah prefix berbeda", () => {
    const t1 = tool();
    const t2 = tool({ name: "memory_open", description: "Buka artifact." });

    expect(prefixDigest(prefix({ toolDefinitions: [t1, t2] }))).not.toBe(
      prefixDigest(prefix({ toolDefinitions: [t2, t1] })),
    );
  });
});

describe("findVolatilePatterns", () => {
  it("menangkap timestamp yang disuntikkan ke system prompt", () => {
    const injected = "Kamu asisten. Waktu sekarang 2026-09-08T10:30:00Z, jawab ringkas.";
    const findings = findVolatilePatterns(injected);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("iso-timestamp");
    expect(findings[0]?.match).toBe("2026-09-08T10:30:00Z");
    expect(injected.slice(findings[0]?.index ?? 0)).toMatch(/^2026-09-08T10:30:00Z/);
  });

  it("menangkap UUID, epoch, dan tanggal telanjang tanpa laporan ganda", () => {
    const text =
      "request 3f2504e0-4f89-41d3-9a0c-0305e82c3301, dibuat 1757318400000, berlaku 2026-09-08";
    const kinds = findVolatilePatterns(text).map((f) => f.kind);

    expect(kinds).toEqual(["uuid", "unix-epoch", "iso-date"]);
  });

  it("tidak menyala pada teks yang memang stabil", () => {
    expect(findVolatilePatterns("Nama panggilan: Rio. Bahasa kerja: Indonesia.")).toEqual([]);
  });

  it("assertPrefixCacheable menyebut jalur persis nilai volatilnya", () => {
    const bad = prefix({ coreMemory: coreMemory("Sesi dimulai 2026-09-08T10:30:00Z.") });

    try {
      assertPrefixCacheable(bad);
      expect.unreachable("seharusnya melempar");
    } catch (err) {
      expect(err).toBeInstanceOf(VolatilePrefixError);
      const message = (err as Error).message;
      expect(message).toContain('coreMemory.blocks["persona"].value');
      expect(message).toContain("2026-09-08T10:30:00Z");
      expect(message).toContain("ADR-01");
    }
  });
});

describe("assertPrefixStable", () => {
  it("lolos diam-diam untuk prefix yang identik", () => {
    expect(() => assertPrefixStable(prefix(), prefix())).not.toThrow();
  });

  it("menyebut blok memori inti mana yang bergeser, lengkap dengan cuplikan", () => {
    const before = prefix();
    const after = prefix({
      coreMemory: coreMemory("Nama panggilan: Rio. Bahasa kerja: Inggris."),
    });

    try {
      assertPrefixStable(before, after);
      expect.unreachable("seharusnya melempar");
    } catch (err) {
      expect(err).toBeInstanceOf(PrefixDivergenceError);
      const message = (err as Error).message;

      // Menyebut bagian yang tepat — bukan sekadar "prefix berubah".
      expect(message).toContain('coreMemory.blocks["persona"].value');
      // Tidak menuduh bagian yang tidak berubah.
      expect(message).not.toContain("systemPrompt");
      expect(message).not.toContain('coreMemory.blocks["proyek_aktif"]');
      // Cuplikan diff yang bisa dibaca jam 2 pagi.
      expect(message).toContain("sebelum:");
      expect(message).toContain("sesudah:");
      expect(message).toContain("Indonesia");
      expect(message).toContain("Inggris");
      expect(message).toContain("ADR-01");
    }
  });

  it("menyebut tool mana yang deskripsinya berubah", () => {
    const before = prefix();
    const after = prefix({
      toolDefinitions: [
        tool({ description: "Cari fakta di memori pengguna. Kembalikan k besar." }),
      ],
    });

    const err = captureError(() => assertPrefixStable(before, after));
    expect(err.message).toContain('toolDefinitions["memory_search"].description');
    expect(err.message).not.toContain("coreMemory");
  });

  it("membedakan tool yang hilang dari tool yang isinya berubah", () => {
    const before = prefix({ toolDefinitions: [tool(), tool({ name: "memory_open" })] });
    const after = prefix({ toolDefinitions: [tool()] });

    const err = captureError(() => assertPrefixStable(before, after));
    expect(err.message).toContain('toolDefinitions["memory_open"]');
    expect(err.message).toContain("hilang");
  });

  it("menyebut pola volatil sebagai penyebab kalau ada di bagian yang bergeser", () => {
    const before = prefix({ systemPrompt: "Kamu asisten. Sesi dimulai." });
    const after = prefix({ systemPrompt: "Kamu asisten. Sesi dimulai 2026-09-08T10:30:00Z." });

    const err = captureError(() => assertPrefixStable(before, after));
    expect(err.message).toContain("systemPrompt");
    expect(err.message).toContain("pola volatil");
    expect(err.message).toContain("2026-09-08T10:30:00Z");
  });

  it("melaporkan digest sebelum dan sesudah pada error", () => {
    const err = captureError(() =>
      assertPrefixStable(prefix(), prefix({ systemPrompt: "beda" })),
    ) as PrefixDivergenceError;

    expect(err.digestBefore).not.toBe(err.digestAfter);
    expect(err.divergences.map((d) => d.path)).toEqual(["systemPrompt"]);
  });
});

function captureError(fn: () => void): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error("seharusnya melempar, tapi tidak");
}
