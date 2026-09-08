import { describe, it, expect, afterEach } from "vitest";
import type { ContextDatabase } from "./db.js";
import type { ContextRepository } from "./repository.js";
import {
  ContextRetriever,
  MissingScopeError,
  reciprocalRankFusion,
  toFtsQuery,
} from "./retrieval.js";
import type { VectorIndex } from "./vector.js";
import { NOW, T0, T2, factInput, makeRepo, makeRepoWithVectors, vec } from "./test-helpers.js";
import type { MemoryFactId } from "@ecorione/shared-schema";

let open: ContextDatabase | null = null;

afterEach(() => {
  open?.close();
  open = null;
});

function setup(withVectors = false): {
  repo: ContextRepository;
  retriever: ContextRetriever;
  vectors?: VectorIndex;
} {
  if (withVectors) {
    const { db, repo, vectors } = makeRepoWithVectors();
    open = db;
    return { repo, retriever: new ContextRetriever(repo, vectors), vectors };
  }
  const { db, repo } = makeRepo();
  open = db;
  return { repo, retriever: new ContextRetriever(repo) };
}

describe("Gerbang scope — kebocoran lintas konteks", () => {
  it("fakta scope work tidak pernah muncul untuk query scope personal", () => {
    const { repo, retriever } = setup();

    repo.insertFact(
      factInput({
        id: "mem_kerja",
        scope: "work",
        text: "Gaji Amanda naik jadi 40 juta",
        subject: "Amanda",
        predicate: "bergaji",
        object: "40 juta",
      }),
    );
    repo.insertFact(
      factInput({ id: "mem_pribadi", scope: "personal", text: "Amanda suka kopi gaji" }),
    );

    const { hits } = retriever.retrieve({
      query: "gaji",
      scopes: ["personal"],
      now: NOW,
    });

    expect(hits.map((h) => h.fact.id)).toEqual(["mem_pribadi"]);
    expect(hits.some((h) => h.fact.scope === "work")).toBe(false);
  });

  it("scope wajib di runtime, bukan cuma di tipe", () => {
    // Penjaga tipe tidak menolong pemanggil dari luar TypeScript — tool MCP menerima
    // JSON dari model hosted. "Tanpa scope" harus gagal keras di kedua lapis.
    const { retriever } = setup();

    // @ts-expect-error scopes tidak boleh bisa dihilangkan dari tipe.
    expect(() => retriever.retrieve({ query: "apa saja", now: NOW })).toThrow(
      MissingScopeError,
    );
    expect(() => retriever.retrieve({ query: "apa saja", scopes: [], now: NOW })).toThrow(
      MissingScopeError,
    );
  });
});

describe("Gerbang sensitivitas", () => {
  it("maxSensitivity menyaring sebelum ranking", () => {
    const { repo, retriever } = setup();

    repo.insertFact(factInput({ id: "mem_publik", sensitivity: "PUBLIC", text: "kopi enak" }));
    repo.insertFact(
      factInput({ id: "mem_rahasia", sensitivity: "RESTRICTED", text: "kopi rahasia" }),
    );

    const { hits } = retriever.retrieve({
      query: "kopi",
      scopes: ["personal"],
      maxSensitivity: "INTERNAL",
      now: NOW,
    });

    expect(hits.map((h) => h.fact.id)).toEqual(["mem_publik"]);
  });
});

describe("Fakta yang di-invalidate", () => {
  it("tidak muncul di retrieval setelah digantikan", () => {
    const { repo, retriever } = setup();

    const lama = repo.insertFact(
      factInput({ id: "mem_lama", text: "Amanda tinggal di Jakarta" }),
    );
    repo.supersedeFact(
      lama.id,
      factInput({
        id: "mem_baru",
        text: "Amanda tinggal di Bandung",
        tValid: T2,
        createdAt: T2,
      }),
    );

    const { hits } = retriever.retrieve({
      query: "Amanda tinggal",
      scopes: ["personal"],
      now: NOW,
    });

    expect(hits.map((h) => h.fact.id)).toEqual(["mem_baru"]);
  });
});

describe("Fusi RRF", () => {
  it("cukup baik di dua jalur mengalahkan juara satu jalur", () => {
    // Ini properti yang membuat hybrid search sepadan dengan kerumitannya. Kalau tes ini
    // gugur, kita hanya membayar dua mesin pencari untuk hasil satu mesin pencari.
    const a = "mem_a" as MemoryFactId;
    const b = "mem_b" as MemoryFactId;

    const fused = reciprocalRankFusion([
      [b, a], // leksikal: b juara, a kedua
      [a, b], // vektor:   a kedua di leksikal tapi juara di sini
    ]);

    const juaraSatuJalur = reciprocalRankFusion([
      [a, b],
      [b, a],
    ]);

    // Simetris pada contoh di atas; yang penting: keduanya dapat kontribusi dari 2 jalur.
    expect(fused.get(a)?.matchedBy).toEqual(["lexical", "vector"]);
    expect(juaraSatuJalur.get(a)?.matchedBy).toEqual(["lexical", "vector"]);

    // Asimetri sebenarnya: c juara mutlak di satu jalur saja, kalah dari a yang peringkat
    // 2–2 di kedua jalur.
    const c = "mem_c" as MemoryFactId;
    const campuran = reciprocalRankFusion([
      [c, a],
      [b, a],
    ]);
    expect(campuran.get(a)!.score).toBeGreaterThan(campuran.get(c)!.score);
  });

  it("menandai jalur mana yang mencocokkan", () => {
    const a = "mem_a" as MemoryFactId;
    const fused = reciprocalRankFusion([[a], []]);
    expect(fused.get(a)?.matchedBy).toEqual(["lexical"]);
  });
});

describe("Hybrid end-to-end", () => {
  it("menggabungkan jalur leksikal dan vektor", () => {
    const { repo, retriever, vectors } = setup(true);

    const kopi = repo.insertFact(
      factInput({ id: "mem_kopi", text: "Amanda minum kopi tiap pagi" }),
    );
    const teh = repo.insertFact(
      factInput({ id: "mem_teh", text: "Amanda kadang minum teh", createdAt: T0 }),
    );

    repo.putFactEmbedding(kopi.id, vec(1, 0, 0));
    repo.putFactEmbedding(teh.id, vec(0, 1, 0));
    expect(vectors).toBeDefined();

    const { hits, diagnostics } = retriever.retrieve({
      query: "kopi",
      scopes: ["personal"],
      queryEmbedding: vec(1, 0, 0),
      now: NOW,
    });

    expect(hits[0]?.fact.id).toBe("mem_kopi");
    expect(hits[0]?.matchedBy).toContain("vector");
    expect(diagnostics.vectorCandidates).toBeGreaterThan(0);
  });

  it("berjalan leksikal saja kalau tidak ada embedding query", () => {
    const { repo, retriever } = setup(true);
    repo.insertFact(factInput({ id: "mem_kopi", text: "Amanda minum kopi" }));

    const { hits, diagnostics } = retriever.retrieve({
      query: "kopi",
      scopes: ["personal"],
      now: NOW,
    });

    expect(hits.map((h) => h.fact.id)).toEqual(["mem_kopi"]);
    expect(diagnostics.vectorCandidates).toBe(0);
  });
});

describe("k kecil", () => {
  it("membatasi hasil ke k dan menolak k tidak valid", () => {
    const { repo, retriever } = setup();
    for (let i = 0; i < 12; i++) {
      repo.insertFact(factInput({ id: `mem_${i}`, text: `Amanda suka kopi nomor ${i}` }));
    }

    expect(
      retriever.retrieve({ query: "kopi", scopes: ["personal"], k: 3, now: NOW }).hits,
    ).toHaveLength(3);

    expect(() =>
      retriever.retrieve({ query: "kopi", scopes: ["personal"], k: 0, now: NOW }),
    ).toThrow(RangeError);
  });

  it("k di atas MAX_RETRIEVAL_K dijepit, bukan melempar", () => {
    const { repo, retriever } = setup();
    repo.insertFact(factInput({ id: "mem_a", text: "kopi" }));
    expect(
      retriever.retrieve({ query: "kopi", scopes: ["personal"], k: 999, now: NOW }).hits.length,
    ).toBeLessThanOrEqual(20);
  });
});

describe("Sanitasi query FTS", () => {
  it("memperlakukan sintaks FTS5 sebagai kata, bukan operator", () => {
    expect(toFtsQuery('kopi OR "susu*"')).toBe('"kopi" OR "OR" OR "susu"');
    expect(toFtsQuery("   ")).toBeNull();
  });

  it("query berisi tanda kutip tidak menggagalkan retrieval", () => {
    const { repo, retriever } = setup();
    repo.insertFact(factInput({ id: "mem_a", text: "Amanda minum kopi" }));

    expect(() =>
      retriever.retrieve({ query: 'kopi" NEAR/2 (', scopes: ["personal"], now: NOW }),
    ).not.toThrow();
  });
});

describe("Peluruhan recency", () => {
  it("fakta lebih baru menang saat relevansi leksikalnya setara", () => {
    const { repo, retriever } = setup();
    repo.insertFact(factInput({ id: "mem_lama", text: "Amanda minum kopi", createdAt: T0 }));
    repo.insertFact(factInput({ id: "mem_baru", text: "Amanda minum kopi", createdAt: T2 }));

    const { hits } = retriever.retrieve({ query: "kopi", scopes: ["personal"], now: NOW });
    expect(hits[0]?.fact.id).toBe("mem_baru");
  });
});
