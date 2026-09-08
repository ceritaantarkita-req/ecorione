import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextRetriever } from "./retrieval.js";
import { runConsolidation } from "./consolidate.js";
import { episodeInput, factInput, makeRepo, NOW, T0, T1 } from "./test-helpers.js";
import type { ContextDatabase } from "./db.js";

let open: ContextDatabase | null = null;
afterEach(() => { open?.close(); open = null; });

describe("audit regressions — Context", () => {
  it("FTS menerapkan scope sebelum bm25 LIMIT sehingga kandidat scope lain tidak bisa menenggelamkan hasil sah", () => {
    const { db, repo } = makeRepo(); open = db;
    for (let i = 0; i < 30; i += 1) {
      repo.insertFact(factInput({ id: `mem_work_${i}`, scope: "work", text: `needle needle needle work ${i}`, object: `work ${i}` }));
    }
    repo.insertFact(factInput({ id: "mem_personal", scope: "personal", text: "needle personal", object: "personal" }));
    const result = new ContextRetriever(repo).retrieve({ query: "needle", scopes: ["personal"], now: NOW });
    expect(result.hits.map((h) => h.fact.id)).toContain("mem_personal");
    expect(result.hits.every((h) => h.fact.scope === "personal")).toBe(true);
  });

  it("hosted retrieval hanya mengembalikan CLOUD_ALLOWED/PUBLIC, bukan LOCAL_ONLY", () => {
    const { db, repo } = makeRepo(); open = db;
    repo.insertFact(factInput({ id: "mem_local", text: "kopi lokal", object: "lokal", syncClass: "LOCAL_ONLY" }));
    repo.insertFact(factInput({ id: "mem_cloud", text: "kopi cloud", object: "cloud", syncClass: "CLOUD_ALLOWED" }));
    const result = new ContextRetriever(repo).retrieve({ query: "kopi", scopes: ["personal"], hostedEligibleOnly: true, now: NOW });
    expect(result.hits.map((h) => h.fact.id)).toEqual(["mem_cloud"]);
  });

  it("session filter terjadi sebelum limit dan urutan terbaru-dulu", () => {
    const { db, repo } = makeRepo(); open = db;
    for (let i = 0; i < 10; i += 1) {
      repo.appendEpisode(episodeInput({ id: `epi_other_${i}`, ts: T1, provenance: { sourceApp: "ai", sessionId: "sess_other" } }));
    }
    repo.appendEpisode(episodeInput({ id: "epi_target_old", ts: T0, provenance: { sourceApp: "ai", sessionId: "sess_target" } }));
    repo.appendEpisode(episodeInput({ id: "epi_target_new", ts: T1, provenance: { sourceApp: "ai", sessionId: "sess_target" } }));
    const episodes = repo.listEpisodes({ sessionId: "sess_target", limit: 2, order: "desc" });
    expect(episodes.map((e) => e.id)).toEqual(["epi_target_new", "epi_target_old"]);
  });

  it("mixed-scope consolidation mempertahankan sourceEpisodeId, scope, sensitivity, dan syncClass per kandidat", async () => {
    const { db, repo } = makeRepo(); open = db;
    repo.appendEpisode(episodeInput({ id: "epi_personal", rawText: "Rio suka kopi", scope: "personal", sensitivity: "INTERNAL", syncClass: "CLOUD_ALLOWED" }));
    repo.appendEpisode(episodeInput({ id: "epi_work", rawText: "Proyek Atlas deadline Jumat", scope: "work", sensitivity: "SENSITIVE", syncClass: "LOCAL_ONLY", provenance: { sourceApp: "ai", sessionId: "sess_work" } }));
    const extractLocal = vi.fn().mockResolvedValue(JSON.stringify({
      facts: [
        { sourceEpisodeId: "epi_personal", subject: "Rio", predicate: "suka", object: "kopi", confidence: 0.9, worthRemembering: true },
        { sourceEpisodeId: "epi_work", subject: "Proyek Atlas", predicate: "deadline", object: "Jumat", confidence: 0.9, worthRemembering: true },
      ],
      summaries: [
        { sourceEpisodeId: "epi_personal", summary: "Rio suka kopi." },
        { sourceEpisodeId: "epi_work", summary: "Proyek Atlas deadline Jumat." },
      ],
    }));
    const result = await runConsolidation({ repo, extractLocal }, { now: NOW });
    expect(result.promoted).toBe(2);
    const personal = repo.listFacts({ scopes: ["personal"] })[0];
    const work = repo.listFacts({ scopes: ["work"] })[0];
    expect(personal?.sourceEpisodeIds).toEqual(["epi_personal"]);
    expect(personal?.syncClass).toBe("CLOUD_ALLOWED");
    expect(work?.sourceEpisodeIds).toEqual(["epi_work"]);
    expect(work?.sensitivity).toBe("SENSITIVE");
    expect(work?.syncClass).toBe("LOCAL_ONLY");
  });

  it("rebuild L1 setelah proposal promoted tidak gagal FK dan tidak menghapus L2", () => {
    const { db, repo } = makeRepo(); open = db;
    repo.appendEpisode(episodeInput({ id: "epi_source" }));
    repo.setCoreMemoryBlock({ label: "persona", description: "identitas", value: "Rio", updatedAt: T0 }, { trust: "USER" });
    const id = repo.proposeFact({ id: "mem_promoted", proposedText: "Rio suka kopi", proposedAt: T0, provenance: { sourceApp: "local" }, trust: "LOCAL_AGENT", scope: "personal" });
    repo.promoteFromQuarantine(id, factInput({ id: "mem_promoted", sourceEpisodeIds: ["epi_source"] }), T1);
    expect(() => repo.rebuildDerivedTiers(() => undefined)).not.toThrow();
    expect(repo.getCoreMemoryBlock("persona")?.value).toBe("Rio");
  });
});
