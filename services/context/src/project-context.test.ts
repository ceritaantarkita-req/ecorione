import { describe, expect, it } from "vitest";
import { ContextRetriever } from "./retrieval.js";
import { openContextDatabase } from "./db.js";
import { loadMigrations, migrate } from "./migrate.js";
import { ContextRepository } from "./repository.js";
import { NOW, T0, episodeInput, factInput } from "./test-helpers.js";

describe("PE-01 Project context", () => {
  it("retrieves global + current Project memory without sibling leakage", () => {
    const db = openContextDatabase();
    try {
      const repo = new ContextRepository(db);
      const retriever = new ContextRetriever(repo);
      repo.insertFact(
        factInput({
          id: "mem_global",
          text: "GLOBAL_OK common memory",
          object: "GLOBAL_OK",
          projectId: null,
        }),
      );
      repo.insertFact(
        factInput({
          id: "mem_project_a",
          text: "A_ONLY project alpha",
          object: "A_ONLY",
          projectId: "prj_alpha" as never,
        }),
      );
      repo.insertFact(
        factInput({
          id: "mem_project_b",
          text: "B_ONLY project beta",
          object: "B_ONLY",
          projectId: "prj_beta" as never,
        }),
      );

      const a = retriever.retrieve({
        query: "GLOBAL_OK A_ONLY B_ONLY",
        scopes: ["personal"],
        projectId: "prj_alpha" as never,
        now: NOW,
      });
      expect(a.hits.map((hit) => hit.fact.id).sort()).toEqual(
        ["mem_global", "mem_project_a"].sort(),
      );

      const b = retriever.retrieve({
        query: "GLOBAL_OK A_ONLY B_ONLY",
        scopes: ["personal"],
        projectId: "prj_beta" as never,
        now: NOW,
      });
      expect(b.hits.map((hit) => hit.fact.id).sort()).toEqual(
        ["mem_global", "mem_project_b"].sort(),
      );
    } finally {
      db.close();
    }
  });

  it("allows the same core-memory label globally and per Project with Project override", () => {
    const db = openContextDatabase();
    try {
      const repo = new ContextRepository(db);
      repo.setCoreMemoryBlock(
        {
          label: "persona",
          description: "global",
          value: "GLOBAL",
          updatedAt: T0,
          projectId: null,
        },
        { trust: "USER" },
      );
      repo.setCoreMemoryBlock(
        {
          label: "persona",
          description: "alpha",
          value: "ALPHA",
          updatedAt: T0,
          projectId: "prj_alpha" as never,
        },
        { trust: "USER" },
      );
      repo.setCoreMemoryBlock(
        {
          label: "persona",
          description: "beta",
          value: "BETA",
          updatedAt: T0,
          projectId: "prj_beta" as never,
        },
        { trust: "USER" },
      );

      expect(repo.getCoreMemory().blocks.map((block) => block.value)).toEqual(["GLOBAL"]);
      expect(
        repo
          .getCoreMemory({ projectId: "prj_alpha" as never })
          .blocks.map((block) => block.value),
      ).toEqual(["ALPHA"]);
      expect(
        repo
          .getCoreMemory({ projectId: "prj_beta" as never })
          .blocks.map((block) => block.value),
      ).toEqual(["BETA"]);
    } finally {
      db.close();
    }
  });

  it("migrates only deterministic historical Ai chat rows to Personal and is reopen-safe", () => {
    const db = openContextDatabase({ runMigrations: false });
    try {
      const all = loadMigrations();
      migrate(
        db.raw,
        all.filter((migration) => migration.version <= 2),
      );
      const repo = new ContextRepository(db);
      repo.appendEpisode(
        episodeInput({
          id: "epi_legacy_ai",
          provenance: {
            sourceApp: "ai",
            sessionId: "sess_legacy_ai" as never,
          },
        }),
      );
      repo.appendEpisode(
        episodeInput({
          id: "epi_legacy_cli",
          provenance: {
            sourceApp: "cli",
            sessionId: "sess_legacy_cli" as never,
          },
        }),
      );
      repo.insertFact(
        factInput({
          id: "mem_legacy_ai",
          sourceEpisodeIds: ["epi_legacy_ai" as never],
        }),
      );
      repo.setCoreMemoryBlock(
        {
          label: "legacy-global",
          description: "legacy",
          value: "global stays global",
          updatedAt: T0,
        },
        { trust: "USER" },
      );

      expect(migrate(db.raw, all).applied).toContain(3);

      const ai = db.raw
        .prepare("SELECT project_id FROM episodes WHERE id='epi_legacy_ai'")
        .get() as { project_id: string | null };
      const cli = db.raw
        .prepare("SELECT project_id FROM episodes WHERE id='epi_legacy_cli'")
        .get() as { project_id: string | null };
      const fact = db.raw
        .prepare("SELECT project_id FROM facts WHERE id='mem_legacy_ai'")
        .get() as { project_id: string | null };
      const core = db.raw
        .prepare("SELECT project_id FROM core_memory WHERE label='legacy-global'")
        .get() as { project_id: string | null };

      expect(ai.project_id).toBe("prj_personal");
      expect(cli.project_id).toBeNull();
      expect(fact.project_id).toBe("prj_personal");
      expect(core.project_id).toBeNull();
      expect(migrate(db.raw, all).applied).toEqual([]);
    } finally {
      db.close();
    }
  });
});
