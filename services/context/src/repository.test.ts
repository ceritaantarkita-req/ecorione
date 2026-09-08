import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CORE_MEMORY_CHAR_LIMIT, type MemoryFactId } from "@ecorione/shared-schema";
import type { ContextDatabase } from "./db.js";
import {
  ContextRepository,
  CoreMemoryLimitError,
  CoreMemoryWriteForbiddenError,
  FactAlreadyInvalidatedError,
  FactDeletionForbiddenError,
  FactNotFoundError,
  QuarantineRequiredError,
  QuarantineStateError,
  ScopeEscalationError,
} from "./repository.js";
import { createVectorIndex } from "./vector.js";
import {
  T0,
  T1,
  T2,
  episodeInput,
  factInput,
  makeRepo,
  proposalInput,
} from "./test-helpers.js";

let db: ContextDatabase;
let repo: ContextRepository;

beforeEach(() => {
  ({ db, repo } = makeRepo());
});

afterEach(() => {
  db.close();
});

describe("L0 — log episodik", () => {
  it("menyimpan dan membaca kembali episode", () => {
    const written = repo.appendEpisode(episodeInput({ rawText: "halo" }));
    expect(repo.getEpisode(written.id)?.rawText).toBe("halo");
  });

  it("menolak UPDATE — L0 append-only (ADR-06)", () => {
    const written = repo.appendEpisode(episodeInput({}));
    expect(() =>
      db.raw.prepare("UPDATE episodes SET raw_text = ? WHERE id = ?").run("diubah", written.id),
    ).toThrow();
  });

  it("menolak DELETE", () => {
    const written = repo.appendEpisode(episodeInput({}));
    expect(() => db.raw.prepare("DELETE FROM episodes WHERE id = ?").run(written.id)).toThrow();
  });
});

describe("L1 — fakta & invalidasi", () => {
  it("supersede mengisi tInvalid + supersededBy, tidak menghapus", () => {
    const lama = repo.insertFact(
      factInput({ id: "mem_lama", object: "Jakarta", text: "Amanda di Jakarta" }),
    );
    const { invalidated, replacement } = repo.supersedeFact(
      lama.id,
      factInput({ id: "mem_baru", object: "Bandung", text: "Amanda di Bandung", tValid: T2 }),
    );

    expect(invalidated.tInvalid).toBe(T2);
    expect(invalidated.supersededBy).toBe(replacement.id);

    // Hilang dari hasil default…
    expect(repo.getFact(lama.id)).toBeNull();
    // …tapi masih ada dan bisa dijelaskan.
    expect(repo.getFact(lama.id, { includeInvalidated: true })?.object).toBe("Jakarta");
  });

  it("default listFacts hanya mengembalikan fakta yang masih berlaku", () => {
    const lama = repo.insertFact(factInput({ id: "mem_a" }));
    repo.supersedeFact(lama.id, factInput({ id: "mem_b", tValid: T2 }));

    expect(repo.listFacts().map((f) => f.id)).toEqual(["mem_b"]);
    expect(repo.listFacts({ includeInvalidated: true })).toHaveLength(2);
  });

  it("penghapusan fakta tidak mungkin lewat API repository (aturan 4)", () => {
    const fact = repo.insertFact(factInput({ id: "mem_a" }));
    expect(() => repo.deleteFact(fact.id)).toThrow(FactDeletionForbiddenError);
  });
});

describe("forgetFact — lupakan satu-klik (prd.md §7)", () => {
  it("meng-invalidate tanpa pengganti: tInvalid terisi, supersededBy tetap null", () => {
    const fact = repo.insertFact(factInput({ id: "mem_a" }));
    const forgotten = repo.forgetFact(fact.id, T1);

    expect(forgotten.tInvalid).toBe(T1);
    expect(forgotten.supersededBy).toBeNull();

    // Hilang dari hasil default, tapi baris lama tetap ada (ADR-06) — tidak dihapus.
    expect(repo.getFact(fact.id)).toBeNull();
    expect(repo.getFact(fact.id, { includeInvalidated: true })?.tInvalid).toBe(T1);
  });

  it("menolak forget pada fakta yang tidak ada", () => {
    expect(() => repo.forgetFact("mem_nope" as MemoryFactId, T1)).toThrow(FactNotFoundError);
  });

  it("menolak forget dua kali pada fakta yang sama", () => {
    const fact = repo.insertFact(factInput({ id: "mem_a" }));
    repo.forgetFact(fact.id, T1);
    expect(() => repo.forgetFact(fact.id, T2)).toThrow(FactAlreadyInvalidatedError);
  });

  it("menolak forget dengan waktu sebelum tValid fakta", () => {
    const fact = repo.insertFact(factInput({ id: "mem_a", tValid: T1 }));
    expect(() => repo.forgetFact(fact.id, T0)).toThrow(/mendahului t_valid/);
  });
});

describe("Karantina — ADR-07", () => {
  it("tulisan dari model hosted tidak bisa langsung masuk L1", () => {
    expect(() => repo.insertFact(factInput({ id: "mem_x", trust: "HOSTED_AGENT" }))).toThrow(
      QuarantineRequiredError,
    );
  });

  it("usulan karantina tidak muncul di retrieval sampai dipromosikan", () => {
    const qid = repo.proposeFact(proposalInput({ id: "mem_q" }));
    expect(repo.listFacts()).toHaveLength(0);
    expect(repo.getQuarantined(qid)?.status).toBe("PENDING");

    repo.promoteFromQuarantine(qid, factInput({ id: "mem_q" }), T2);

    expect(repo.listFacts().map((f) => f.id)).toEqual(["mem_q"]);
    expect(repo.getQuarantined(qid)?.status).toBe("PROMOTED");
  });

  it("promosi tidak boleh menaikkan scope usulan", () => {
    const qid = repo.proposeFact(proposalInput({ id: "mem_q", scope: "work" }));
    expect(() =>
      repo.promoteFromQuarantine(qid, factInput({ id: "mem_q", scope: "personal" }), T2),
    ).toThrow(ScopeEscalationError);
  });

  it("usulan yang ditolak tidak bisa dipromosikan belakangan", () => {
    const qid = repo.proposeFact(proposalInput({ id: "mem_q" }));
    repo.rejectQuarantined(qid, "berisi konten imperatif", T1);
    expect(() => repo.promoteFromQuarantine(qid, factInput({ id: "mem_q" }), T2)).toThrow(
      QuarantineStateError,
    );
  });
});

describe("L2 — memori inti", () => {
  it("melewati batas token melempar, bukan memotong diam-diam", () => {
    expect(() =>
      repo.setCoreMemoryBlock(
        {
          label: "persona",
          description: "identitas",
          value: "x".repeat(CORE_MEMORY_CHAR_LIMIT + 1),
          updatedAt: T0,
        },
        { trust: "USER" },
      ),
    ).toThrow(CoreMemoryLimitError);
  });

  it("batas dihitung akumulatif lintas blok", () => {
    const half = "x".repeat(Math.floor(CORE_MEMORY_CHAR_LIMIT * 0.6));
    repo.setCoreMemoryBlock(
      { label: "a", description: "a", value: half, updatedAt: T0 },
      { trust: "USER" },
    );
    expect(() =>
      repo.setCoreMemoryBlock(
        { label: "b", description: "b", value: half, updatedAt: T0 },
        { trust: "USER" },
      ),
    ).toThrow(CoreMemoryLimitError);
  });

  it("model hosted tidak punya jalur ke memori inti sama sekali", () => {
    expect(() =>
      repo.setCoreMemoryBlock(
        { label: "persona", description: "identitas", value: "halo", updatedAt: T0 },
        { trust: "HOSTED_AGENT" },
      ),
    ).toThrow(CoreMemoryWriteForbiddenError);
  });

  it("konsolidasi lokal tidak boleh menimpa blok read-only", () => {
    repo.setCoreMemoryBlock(
      {
        label: "persona",
        description: "identitas",
        value: "asli",
        readOnly: true,
        updatedAt: T0,
      },
      { trust: "USER" },
    );
    expect(() =>
      repo.setCoreMemoryBlock(
        { label: "persona", description: "identitas", value: "ditimpa", updatedAt: T1 },
        { trust: "LOCAL_AGENT" },
      ),
    ).toThrow(CoreMemoryWriteForbiddenError);
  });

  it("blok terurut label — urutan yang berubah membatalkan cache prefix (ADR-01)", () => {
    for (const label of ["zulu", "alfa", "mike"]) {
      repo.setCoreMemoryBlock(
        { label, description: label, value: label, updatedAt: T0 },
        { trust: "USER" },
      );
    }
    expect(repo.getCoreMemory().blocks.map((b) => b.label)).toEqual(["alfa", "mike", "zulu"]);
  });
});

describe("Tier turunan bisa dibangun ulang", () => {
  it("L1 dibuang dan diturunkan ulang dari L0, yang tetap utuh (ADR-06)", () => {
    // Ini properti yang membuat kesalahan ekstraksi bisa dipulihkan: kalau konsolidasi
    // menulis fakta yang salah, tier turunannya dihapus dan diturunkan ulang dari log.
    const vectors = createVectorIndex(db.raw, {
      dim: 3,
      model: "test-embed-1",
      prefer: "brute-force",
    });
    const repoWithVectors = new ContextRepository(db, vectors);

    const episode = repoWithVectors.appendEpisode(
      episodeInput({ rawText: "Amanda tinggal di Jakarta" }),
    );
    const salah = repoWithVectors.insertFact(
      factInput({ id: "mem_salah", object: "Surabaya", text: "Amanda tinggal di Surabaya" }),
    );
    repoWithVectors.putFactEmbedding(salah.id, Float32Array.from([1, 0, 0]));

    expect(
      vectors.search(Float32Array.from([1, 0, 0]), 5, new Set<MemoryFactId>([salah.id])),
    ).toHaveLength(1);

    repoWithVectors.rebuildDerivedTiers((repo) => {
      // Menurunkan ulang dari L0 — di produksi ini pekerjaan konsolidasi model lokal.
      for (const e of repo.listEpisodes()) {
        repo.insertFact(
          factInput({
            id: "mem_benar",
            object: "Jakarta",
            text: e.rawText,
            sourceEpisodeIds: [e.id],
          }),
        );
      }
    });

    // L0 tidak tersentuh…
    expect(repoWithVectors.listEpisodes().map((e) => e.id)).toEqual([episode.id]);
    // …dan L1 sekarang berisi hasil turunan yang benar, bukan yang salah.
    expect(repoWithVectors.listFacts().map((f) => f.id)).toEqual(["mem_benar"]);
    expect(repoWithVectors.getFact("mem_salah" as MemoryFactId)).toBeNull();
  });

  it("di luar rebuild, menghapus baris fakta tetap ditolak database", () => {
    const fact = repo.insertFact(factInput({ id: "mem_a" }));
    expect(() => db.raw.prepare("DELETE FROM facts WHERE id = ?").run(fact.id)).toThrow();
  });
});
