import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { openContextDatabase, type ContextDatabase } from "./db.js";
import {
  ContextMaintenanceEngine,
  MaintenanceConflictError,
  contextProjectionDigest,
  contextSourceDigest,
} from "./maintenance.js";
import { ContextRepository } from "./repository.js";
import { createVectorIndex } from "./vector.js";

const NOW = "2026-09-10T02:00:00.000Z";
const LATER = "2026-09-10T02:05:00.000Z";

describe("Context maintenance / rebuild engine", () => {
  let db: ContextDatabase | null = null;
  let directory: string | null = null;

  afterEach(() => {
    db?.close();
    db = null;
    if (directory !== null) rmSync(directory, { recursive: true, force: true });
    directory = null;
  });

  function setup(options: { extractLocal?: (prompt: string) => Promise<string> } = {}) {
    directory = mkdtempSync(join(tmpdir(), "ecorione-maint-"));
    const dbPath = join(directory, "context.sqlite");
    db = openContextDatabase({ path: dbPath });
    const vectors = createVectorIndex(db.raw, { dim: 2, model: "test-embedding" });
    const repo = new ContextRepository(db, vectors);
    const maintenance = new ContextMaintenanceEngine(repo, {
      extractLocal: options.extractLocal,
      snapshotDir: join(directory, "snapshots"),
    });
    return { repo, maintenance };
  }

  function seedEpisode(repo: ContextRepository, id = "ep_maint001") {
    const episodeId = assertId("episode", id);
    repo.appendEpisode({
      id: episodeId,
      ts: "2026-09-10T01:00:00.000Z",
      rawText: "User menyukai kopi hitam.",
      provenance: { sourceApp: "maintenance:test" },
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "USER",
    });
    return episodeId;
  }

  function seedDuplicateFacts(repo: ContextRepository, episodeId: ReturnType<typeof seedEpisode>) {
    const first = assertId("memoryFact", "mf_maint001");
    const second = assertId("memoryFact", "mf_maint002");
    repo.insertFact({
      id: first,
      subject: " user ",
      predicate: "likes",
      object: "coffee",
      text: " user  likes coffee ",
      confidence: 0.7,
      salience: 0.4,
      sourceEpisodeIds: [episodeId],
      tValid: "2026-09-10T01:00:00.000Z",
      createdAt: "2026-09-10T01:01:00.000Z",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "LOCAL_AGENT",
      provenance: { sourceApp: "maintenance:test" },
    });
    repo.insertFact({
      id: second,
      subject: "user",
      predicate: " likes ",
      object: "coffee ",
      text: "user likes coffee ",
      confidence: 0.9,
      salience: 0.6,
      sourceEpisodeIds: [episodeId, episodeId],
      tValid: "2026-09-10T01:00:00.000Z",
      createdAt: "2026-09-10T01:02:00.000Z",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "LOCAL_AGENT",
      provenance: { sourceApp: "maintenance:test" },
    });
    repo.putFactEmbedding(first, new Float32Array([1, 0]));
    return { first, second };
  }

  it("dry-runs, snapshots, normalizes/dedupes, rebuilds indexes, verifies, and rolls projection back", async () => {
    const { repo, maintenance } = setup();
    const episodeId = seedEpisode(repo);
    seedDuplicateFacts(repo, episodeId);
    const sourceBefore = contextSourceDigest(repo.db.raw);
    const projectionBefore = contextProjectionDigest(repo);

    const plan = maintenance.plan({
      operationId: assertId("operation", "op_maint001"),
      actions: ["normalize-metadata", "dedupe-facts", "rebuild-fts", "reindex-vector", "verify"],
      now: NOW,
    });
    expect(plan.findings.normalizableFacts).toBe(2);
    expect(plan.findings.duplicateLiveDerivedGroups).toBe(1);
    expect(plan.sourceDigest).toBe(sourceBefore);

    const receipt = await maintenance.execute(plan);
    expect(receipt.status).toBe("SUCCEEDED");
    expect(receipt.sourceDigestAfter).toBe(sourceBefore);
    expect(receipt.snapshotPath).not.toBeNull();
    expect(existsSync(receipt.snapshotPath ?? "")).toBe(true);
    expect(repo.listFacts({ includeInvalidated: false })).toHaveLength(1);
    expect(repo.listFacts({ includeInvalidated: true })).toHaveLength(2);
    expect(maintenance.verify().duplicateLiveDerivedGroups).toBe(0);

    const rollback = await maintenance.rollback({
      operationId: assertId("operation", "op_maintrollback001"),
      sourceReceiptId: receipt.id,
      now: LATER,
    });
    expect(rollback.status).toBe("SUCCEEDED");
    expect(rollback.projectionDigestAfter).toBe(projectionBefore);
    expect(repo.listFacts({ includeInvalidated: false })).toHaveLength(2);
  });

  it("rejects execution when L0 changes after the dry-run", async () => {
    const { repo, maintenance } = setup();
    seedEpisode(repo);
    const plan = maintenance.plan({
      operationId: assertId("operation", "op_mainttoctou001"),
      actions: ["verify"],
      now: NOW,
    });
    seedEpisode(repo, "ep_maint002");
    await expect(maintenance.execute(plan)).rejects.toBeInstanceOf(MaintenanceConflictError);
  });

  it("rebuilds L1 in staging from immutable L0 before swapping the projection", async () => {
    const extractLocal = async (prompt: string) => {
      const source = /\"id\":\"([^\"]+)\"/.exec(prompt)?.[1];
      if (source === undefined) throw new Error("source episode id missing");
      return JSON.stringify({
        facts: [
          {
            sourceEpisodeId: source,
            subject: "user",
            predicate: "likes",
            object: "black coffee",
            confidence: 0.95,
            worthRemembering: true,
          },
        ],
        summaries: [{ sourceEpisodeId: source, summary: "User likes black coffee." }],
      });
    };
    const { repo, maintenance } = setup({ extractLocal });
    const episodeId = seedEpisode(repo);
    repo.insertFact({
      id: assertId("memoryFact", "mf_stale001"),
      subject: "stale",
      predicate: "is",
      object: "projection",
      text: "stale is projection",
      confidence: 0.5,
      salience: 0.5,
      sourceEpisodeIds: [episodeId],
      tValid: "2026-09-10T01:00:00.000Z",
      createdAt: "2026-09-10T01:01:00.000Z",
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "LOCAL_AGENT",
      provenance: { sourceApp: "maintenance:test" },
    });
    const sourceBefore = contextSourceDigest(repo.db.raw);
    const plan = maintenance.plan({
      operationId: assertId("operation", "op_rebuildl1001"),
      actions: ["rebuild-l1", "rebuild-fts", "reindex-vector", "verify"],
      now: NOW,
    });

    const receipt = await maintenance.execute(plan);
    expect(receipt.status).toBe("SUCCEEDED");
    expect(contextSourceDigest(repo.db.raw)).toBe(sourceBefore);
    const live = repo.listFacts({ includeInvalidated: false });
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({ subject: "user", object: "black coffee" });
    expect(repo.getEpisode(episodeId)?.summary).toBe("User likes black coffee.");
  });

  it("refuses projection rollback after immutable L0 advances", async () => {
    const { repo, maintenance } = setup();
    const episodeId = seedEpisode(repo);
    seedDuplicateFacts(repo, episodeId);
    const plan = maintenance.plan({
      operationId: assertId("operation", "op_maintadvance001"),
      actions: ["dedupe-facts", "verify"],
      now: NOW,
    });
    const receipt = await maintenance.execute(plan);
    seedEpisode(repo, "ep_maint003");

    await expect(
      maintenance.rollback({
        operationId: assertId("operation", "op_maintadvanceback001"),
        sourceReceiptId: receipt.id,
        now: LATER,
      }),
    ).rejects.toBeInstanceOf(MaintenanceConflictError);
  });
});
