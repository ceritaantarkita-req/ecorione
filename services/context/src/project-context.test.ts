import { describe, expect, it } from "vitest";
import { ContextRetriever } from "./retrieval.js";
import { openContextDatabase } from "./db.js";
import { loadMigrations, migrate } from "./migrate.js";
import { ContextRepository } from "./repository.js";
import { NOW, T0, factInput } from "./test-helpers.js";

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

      expect(repo.getFactForProject("mem_project_a" as never, "prj_alpha" as never)?.id).toBe(
        "mem_project_a",
      );
      expect(repo.getFactForProject("mem_project_a" as never, "prj_beta" as never)).toBeNull();
      expect(repo.getFactForProject("mem_global" as never, "prj_beta" as never)?.id).toBe(
        "mem_global",
      );
    } finally {
      db.close();
    }
  });

  it("intersects Project isolation with sensitivity and hosted egress filters", () => {
    const db = openContextDatabase();
    try {
      const repo = new ContextRepository(db);
      const retriever = new ContextRetriever(repo);
      repo.insertFact(
        factInput({
          id: "mem_a_cloud",
          text: "FILTER_TOKEN A cloud",
          object: "A cloud",
          projectId: "prj_alpha" as never,
          sensitivity: "INTERNAL",
          syncClass: "CLOUD_ALLOWED",
        }),
      );
      repo.insertFact(
        factInput({
          id: "mem_a_local",
          text: "FILTER_TOKEN A local",
          object: "A local",
          projectId: "prj_alpha" as never,
          sensitivity: "PUBLIC",
          syncClass: "LOCAL_ONLY",
        }),
      );
      repo.insertFact(
        factInput({
          id: "mem_a_restricted",
          text: "FILTER_TOKEN A restricted",
          object: "A restricted",
          projectId: "prj_alpha" as never,
          sensitivity: "RESTRICTED",
          syncClass: "CLOUD_ALLOWED",
        }),
      );
      repo.insertFact(
        factInput({
          id: "mem_b_cloud",
          text: "FILTER_TOKEN B cloud",
          object: "B cloud",
          projectId: "prj_beta" as never,
          sensitivity: "INTERNAL",
          syncClass: "CLOUD_ALLOWED",
        }),
      );

      const { hits } = retriever.retrieve({
        query: "FILTER_TOKEN",
        scopes: ["personal"],
        projectId: "prj_alpha" as never,
        maxSensitivity: "INTERNAL",
        hostedEligibleOnly: true,
        now: NOW,
      });

      expect(hits.map((hit) => hit.fact.id)).toEqual(["mem_a_cloud"]);
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

  it("migrates deterministic legacy rows, quarantines ambiguity, and is reopen-safe", () => {
    const db = openContextDatabase({ runMigrations: false });
    try {
      const all = loadMigrations();
      migrate(
        db.raw,
        all.filter((migration) => migration.version <= 4),
      );

      const insertEpisode = db.raw.prepare(
        `INSERT INTO episodes (
          id,ts,raw_text,source_app,session_id,tool_call_id,source_uri,
          scope,sensitivity,sync_class,trust,summary,consolidated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      insertEpisode.run(
        "epi_legacy_ai",
        T0,
        "legacy user",
        "ai",
        "sess_legacy_ai",
        null,
        null,
        "personal",
        "INTERNAL",
        "LOCAL_ONLY",
        "USER",
        null,
        null,
      );
      insertEpisode.run(
        "epi_legacy_assistant",
        T0,
        "legacy assistant",
        "connect:gemma-test",
        "sess_legacy_ai",
        null,
        null,
        "personal",
        "INTERNAL",
        "LOCAL_ONLY",
        "LOCAL_AGENT",
        null,
        null,
      );
      insertEpisode.run(
        "epi_legacy_cli",
        T0,
        "legacy ambiguous",
        "cli",
        "sess_legacy_cli",
        null,
        null,
        "personal",
        "INTERNAL",
        "LOCAL_ONLY",
        "USER",
        null,
        null,
      );

      const insertFact = db.raw.prepare(
        `INSERT INTO facts (
          id,subject,predicate,object,text,confidence,salience,source_episode_ids,
          t_valid,t_invalid,superseded_by,created_at,scope,sensitivity,sync_class,trust,
          source_app,session_id,tool_call_id,source_uri
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      insertFact.run(
        "mem_legacy_ai",
        "legacy",
        "kind",
        "personal",
        "MIGRATION_TOKEN deterministic",
        1,
        0.5,
        JSON.stringify(["epi_legacy_ai"]),
        T0,
        null,
        null,
        T0,
        "personal",
        "INTERNAL",
        "LOCAL_ONLY",
        "USER",
        "context:legacy",
        "sess_legacy_ai",
        null,
        null,
      );
      insertFact.run(
        "mem_legacy_cli",
        "legacy",
        "kind",
        "ambiguous",
        "MIGRATION_TOKEN ambiguous",
        1,
        0.5,
        JSON.stringify(["epi_legacy_cli"]),
        T0,
        null,
        null,
        T0,
        "personal",
        "INTERNAL",
        "LOCAL_ONLY",
        "USER",
        "context:legacy",
        "sess_legacy_cli",
        null,
        null,
      );
      db.raw
        .prepare(
          `INSERT INTO core_memory
            (label,description,value,read_only,updated_at,scope,sensitivity,sync_class,trust)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          "legacy-global",
          "legacy",
          "global stays global",
          0,
          T0,
          "personal",
          "INTERNAL",
          "LOCAL_ONLY",
          "USER",
        );

      expect(migrate(db.raw, all).applied).toEqual([5]);

      const states = db.raw
        .prepare(
          `SELECT id,project_id,project_state FROM episodes
           WHERE id IN ('epi_legacy_ai','epi_legacy_assistant','epi_legacy_cli')
           ORDER BY id ASC`,
        )
        .all() as Array<{
        id: string;
        project_id: string | null;
        project_state: string;
      }>;
      expect(states).toEqual([
        {
          id: "epi_legacy_ai",
          project_id: "prj_personal",
          project_state: "ASSIGNED",
        },
        {
          id: "epi_legacy_assistant",
          project_id: "prj_personal",
          project_state: "ASSIGNED",
        },
        {
          id: "epi_legacy_cli",
          project_id: null,
          project_state: "LEGACY_UNASSIGNED",
        },
      ]);

      const repo = new ContextRepository(db);
      const visible = repo.listFacts({
        scopes: ["personal"],
        projectId: "prj_personal" as never,
        includeGlobal: true,
      });
      expect(visible.map((fact) => fact.id)).toEqual(["mem_legacy_ai"]);
      expect(
        repo.getFactForProject("mem_legacy_cli" as never, "prj_personal" as never),
      ).toBeNull();

      const factStates = db.raw
        .prepare(
          `SELECT id,project_id,project_state FROM facts
           WHERE id IN ('mem_legacy_ai','mem_legacy_cli')
           ORDER BY id ASC`,
        )
        .all() as Array<{
        id: string;
        project_id: string | null;
        project_state: string;
      }>;
      expect(factStates).toEqual([
        {
          id: "mem_legacy_ai",
          project_id: "prj_personal",
          project_state: "ASSIGNED",
        },
        {
          id: "mem_legacy_cli",
          project_id: null,
          project_state: "LEGACY_UNASSIGNED",
        },
      ]);

      const core = db.raw
        .prepare("SELECT project_id FROM core_memory WHERE label='legacy-global'")
        .get() as { project_id: string | null };
      expect(core.project_id).toBeNull();
      expect(migrate(db.raw, all).applied).toEqual([]);
    } finally {
      db.close();
    }
  });
});
