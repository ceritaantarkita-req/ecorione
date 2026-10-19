import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ContextDatabase } from "./db.js";
import { buildContextServer } from "./http.js";
import { type ContextRepository } from "./repository.js";
import { createVectorIndex, type VectorIndex } from "./vector.js";
import { factInput, makeRepo, NOW, PROVENANCE, T0 } from "./test-helpers.js";

let db: ContextDatabase;
let repo: ContextRepository;
let vectors: VectorIndex;
let app: FastifyInstance;

beforeEach(() => {
  ({ db, repo } = makeRepo());
  vectors = createVectorIndex(db.raw, { dim: 3, model: "test-embed-1", prefer: "brute-force" });
  app = buildContextServer(repo, vectors, { extractLocal: vi.fn().mockResolvedValue("[]") });
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe("episodes", () => {
  it("POST /v1/episodes lalu GET mengembalikannya, terbaru dulu", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "halo dunia",
        provenance: PROVENANCE,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().id).toMatch(/^epi_/);

    const listed = await app.inject({ method: "GET", url: "/v1/episodes" });
    expect(listed.json().episodes).toHaveLength(1);
  });

  it("GET /v1/episodes memfilter berdasarkan sessionId", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "a",
        provenance: { sourceApp: "cli", sessionId: "sess_x" },
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });
    await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "b",
        provenance: { sourceApp: "cli", sessionId: "sess_y" },
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });

    const res = await app.inject({ method: "GET", url: "/v1/episodes?sessionId=sess_x" });
    expect(res.json().episodes).toHaveLength(1);
    expect(res.json().episodes[0].rawText).toBe("a");
  });
  it("filters episodic context by project, session, scope, sensitivity and cloud egress", async () => {
    const cases = [
      {
        text: "allowed",
        projectId: "prj_caps",
        sessionId: "sess_guard",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "CLOUD_ALLOWED",
      },
      {
        text: "restricted",
        projectId: "prj_caps",
        sessionId: "sess_guard",
        scope: "personal",
        sensitivity: "RESTRICTED",
        syncClass: "CLOUD_ALLOWED",
      },
      {
        text: "local only",
        projectId: "prj_caps",
        sessionId: "sess_guard",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
      {
        text: "other scope",
        projectId: "prj_caps",
        sessionId: "sess_guard",
        scope: "work",
        sensitivity: "INTERNAL",
        syncClass: "CLOUD_ALLOWED",
      },
      {
        text: "sibling",
        projectId: "prj_sibling",
        sessionId: "sess_guard",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "CLOUD_ALLOWED",
      },
      {
        text: "other session",
        projectId: "prj_caps",
        sessionId: "sess_other",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "CLOUD_ALLOWED",
      },
    ] as const;
    for (const item of cases) {
      const created = await app.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: {
          ts: T0,
          rawText: item.text,
          projectId: item.projectId,
          provenance: { sourceApp: "test", sessionId: item.sessionId },
          scope: item.scope,
          sensitivity: item.sensitivity,
          syncClass: item.syncClass,
          trust: "USER",
        },
      });
      expect(created.statusCode).toBe(201);
    }

    const listed = await app.inject({
      method: "GET",
      url: "/v1/episodes?sessionId=sess_guard&projectId=prj_caps&scope=personal&maxSensitivity=INTERNAL&hostedEligible=1&limit=6",
    });
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json().episodes.map((episode: { rawText: string }) => episode.rawText),
    ).toEqual(["allowed"]);
  });
});

describe("aggregate Project Memory diagnostics", () => {
  it("reports only own Project counts, not episode content or sibling facts", async () => {
    for (const [id, projectId, syncClass] of [
      ["epi_alpha", "prj_alpha", "LOCAL_ONLY"],
      ["epi_beta", "prj_beta", "CLOUD_ALLOWED"],
    ] as const) {
      const saved = await app.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: {
          ts: T0,
          rawText: "private token must not appear in diagnostics",
          projectId,
          provenance: { sourceApp: "ai", sessionId: "sess_test" },
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass,
          trust: "USER",
        },
      });
      expect(saved.statusCode).toBe(201);
      expect(saved.json().id).toMatch(/^epi_/);
      void id;
    }
    repo.insertFact(
      factInput({
        id: "mem_alpha_local",
        projectId: "prj_alpha" as never,
        object: "ALPHA_ONLY",
        text: "ALPHA_ONLY",
        syncClass: "LOCAL_ONLY",
      }),
    );
    repo.insertFact(
      factInput({
        id: "mem_beta_cloud",
        projectId: "prj_beta" as never,
        object: "BETA_ONLY",
        text: "BETA_ONLY",
        syncClass: "CLOUD_ALLOWED",
      }),
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/memory/status?projectId=prj_alpha",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: "prj_alpha",
      pendingEpisodes: 1,
      consolidatedEpisodes: 0,
      savedFacts: 1,
      localOnlyFacts: 1,
      cloudEligibleFacts: 0,
      processing: false,
      queued: false,
      lastAttempt: "unknown",
      lastFinishedAttemptSequence: 0,
      lastFailureCodes: [],
      lastAttemptDurationMs: null,
      lastExtractionDurationMs: null,
      lastExtractionPromptBytes: null,
    });
    expect(response.body).not.toContain("private token");
    expect(response.body).not.toContain("BETA_ONLY");
    expect((await app.inject({ method: "GET", url: "/v1/memory/status" })).statusCode).toBe(
      400,
    );
  });
});

describe("Project Memory attempt identity", () => {
  it("does not treat the previous verdict as completion of an in-flight chat", async () => {
    let releaseSecond: ((value: string) => void) | undefined;
    const extractLocal = vi
      .fn()
      .mockResolvedValueOnce("[]")
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            releaseSecond = resolve;
          }),
      );
    const autoApp = buildContextServer(repo, vectors, {
      extractLocal,
      autoConsolidate: true,
    });
    const status = async (projectId: string) =>
      (
        await autoApp.inject({
          method: "GET",
          url: `/v1/memory/status?projectId=${projectId}`,
        })
      ).json();
    const append = async (rawText: string, trust: "USER" | "LOCAL_AGENT") => {
      const response = await autoApp.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: {
          ts: NOW,
          rawText,
          projectId: "prj_alpha",
          provenance: { sourceApp: "ai", sessionId: "sess_serial" },
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
          trust,
        },
      });
      expect(response.statusCode).toBe(201);
    };
    try {
      await append("First user message", "USER");
      await append("First assistant reply", "LOCAL_AGENT");
      await vi.waitFor(async () => {
        expect(await status("prj_alpha")).toMatchObject({
          lastAttempt: "complete",
          lastFinishedAttemptSequence: 1,
          processing: false,
        });
      });
      await append("Second user message", "USER");
      await append("Second assistant reply", "LOCAL_AGENT");
      await vi.waitFor(async () => {
        expect(await status("prj_alpha")).toMatchObject({
          lastAttempt: "complete",
          lastFinishedAttemptSequence: 1,
          processing: true,
        });
      });
      expect(await status("prj_beta")).toMatchObject({
        lastFinishedAttemptSequence: 0,
      });
      releaseSecond?.("[]");
      await vi.waitFor(async () => {
        expect(await status("prj_alpha")).toMatchObject({
          lastAttempt: "complete",
          lastFinishedAttemptSequence: 2,
          processing: false,
        });
      });
      expect(extractLocal).toHaveBeenCalledTimes(2);
    } finally {
      releaseSecond?.("[]");
      await autoApp.close();
    }
  });
});

describe("automatic cross-session Project memory", () => {
  it("persists user facts after an assistant reply without blocking the response", async () => {
    const extractLocal = vi.fn(async (prompt: string) => {
      const match = /"id":"(epi_[^"]+)"/.exec(prompt);
      const sourceEpisodeId = match?.[1];
      if (sourceEpisodeId === undefined) throw new Error("missing source episode");
      return JSON.stringify({
        facts: [
          {
            sourceEpisodeId,
            subject: "kode uji",
            predicate: "adalah",
            object: "BIRU-742",
            confidence: 1,
            worthRemembering: true,
          },
        ],
        summaries: [],
      });
    });
    const autoApp = buildContextServer(repo, vectors, {
      extractLocal,
      autoConsolidate: true,
    });
    try {
      const user = await autoApp.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: {
          ts: T0,
          rawText: "Ingat kode Project ini adalah BIRU-742",
          projectId: "prj_alpha",
          provenance: { sourceApp: "ai", sessionId: "sess_alpha_1" },
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "CLOUD_ALLOWED",
          trust: "USER",
        },
      });
      expect(user.statusCode).toBe(201);
      expect(extractLocal).not.toHaveBeenCalled();

      const agent = await autoApp.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: {
          ts: NOW,
          rawText: "Okay",
          projectId: "prj_alpha",
          provenance: { sourceApp: "connect:hosted", sessionId: "sess_alpha_1" },
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "CLOUD_ALLOWED",
          trust: "HOSTED_AGENT",
        },
      });
      expect(agent.statusCode).toBe(201);
      await vi.waitFor(() =>
        expect(repo.listFacts({ projectId: "prj_alpha" as never })).toHaveLength(1),
      );
      // Only numeric, owner-scoped timing metadata may be emitted; no memory text.
      await vi.waitFor(async () => {
        const metrics = await autoApp.inject({
          method: "GET",
          url: "/v1/memory/status?projectId=prj_alpha",
        });
        const snapshot = metrics.json() as {
          lastAttempt: string;
          lastAttemptDurationMs: number | null;
          lastExtractionDurationMs: number | null;
          lastExtractionPromptBytes: number | null;
        };
        expect(snapshot.lastAttempt).toBe("complete");
        expect(snapshot.lastAttemptDurationMs).toBeGreaterThanOrEqual(0);
        expect(snapshot.lastExtractionDurationMs).toBeGreaterThanOrEqual(0);
        expect(snapshot.lastExtractionPromptBytes).toBeGreaterThan(0);
        expect(metrics.body).not.toContain("BIRU-742");
      });
      const recall = await autoApp.inject({
        method: "POST",
        url: "/v1/retrieve",
        payload: {
          query: "Apa kode uji Project ini?",
          scopes: ["personal"],
          projectId: "prj_alpha",
          hostedEligibleOnly: true,
          maxSensitivity: "INTERNAL",
          now: NOW,
        },
      });
      expect(recall.statusCode).toBe(200);
      expect(recall.json().hits[0].fact.object).toBe("BIRU-742");

      const sibling = await autoApp.inject({
        method: "POST",
        url: "/v1/retrieve",
        payload: {
          query: "BIRU-742",
          scopes: ["personal"],
          projectId: "prj_beta",
          hostedEligibleOnly: true,
          maxSensitivity: "INTERNAL",
          now: NOW,
        },
      });
      expect(sibling.json().hits).toEqual([]);
    } finally {
      await autoApp.close();
    }
  });
});

describe("automatic memory local-only safety", () => {
  it("retries failed local extraction while preventing LOCAL_ONLY facts from entering hosted recall", async () => {
    const extractLocal = vi
      .fn()
      .mockRejectedValueOnce(new Error("sensitive model output must never appear in logs"))
      .mockResolvedValueOnce(
        JSON.stringify([
          {
            subject: "kode internal",
            predicate: "adalah",
            object: "LOKAL-742",
            confidence: 1,
            worthRemembering: true,
          },
        ]),
      );
    const autoApp = buildContextServer(repo, vectors, {
      extractLocal,
      autoConsolidate: true,
    });
    try {
      const user = await autoApp.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: {
          ts: T0,
          rawText: "Kode internal adalah LOKAL-742",
          projectId: "prj_alpha",
          provenance: { sourceApp: "ai", sessionId: "sess_alpha_local" },
          scope: "personal",
          sensitivity: "INTERNAL",
          syncClass: "LOCAL_ONLY",
          trust: "USER",
        },
      });
      expect(user.statusCode).toBe(201);

      const agentPayload = {
        ts: NOW,
        rawText: "OK",
        projectId: "prj_alpha",
        provenance: { sourceApp: "connect:local", sessionId: "sess_alpha_local" },
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "LOCAL_AGENT",
      };
      const first = await autoApp.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: agentPayload,
      });
      expect(first.statusCode).toBe(201);
      await vi.waitFor(async () => {
        expect(extractLocal).toHaveBeenCalledTimes(1);
        const status = await autoApp.inject({
          method: "GET",
          url: "/v1/memory/status?projectId=prj_alpha",
        });
        expect(status.json()).toMatchObject({
          lastAttempt: "failed",
          lastFailureCodes: ["LOCAL_MODEL_ERROR"],
        });
        expect(status.body).not.toContain("sensitive model output");
      });
      expect(repo.listFacts({ projectId: "prj_alpha" as never })).toHaveLength(0);
      expect(
        repo.listEpisodes({ projectId: "prj_alpha" as never, onlyUnconsolidated: true }),
      ).toHaveLength(2);

      const retry = await autoApp.inject({
        method: "POST",
        url: "/v1/episodes",
        payload: agentPayload,
      });
      expect(retry.statusCode).toBe(201);
      await vi.waitFor(() =>
        expect(repo.listFacts({ projectId: "prj_alpha" as never })).toHaveLength(1),
      );
      expect(repo.listFacts({ projectId: "prj_alpha" as never })[0]?.syncClass).toBe(
        "LOCAL_ONLY",
      );
      await vi.waitFor(async () => {
        const status = await autoApp.inject({
          method: "GET",
          url: "/v1/memory/status?projectId=prj_alpha",
        });
        expect(status.json()).toMatchObject({
          lastAttempt: "complete",
          lastFailureCodes: [],
        });
      });

      const cloud = await autoApp.inject({
        method: "POST",
        url: "/v1/retrieve",
        payload: {
          query: "LOKAL-742",
          scopes: ["personal"],
          projectId: "prj_alpha",
          maxSensitivity: "INTERNAL",
          hostedEligibleOnly: true,
          now: NOW,
        },
      });
      expect(cloud.json().hits).toEqual([]);
      const local = await autoApp.inject({
        method: "POST",
        url: "/v1/retrieve",
        payload: {
          query: "LOKAL-742",
          scopes: ["personal"],
          projectId: "prj_alpha",
          maxSensitivity: "INTERNAL",
          hostedEligibleOnly: false,
          now: NOW,
        },
      });
      expect(local.json().hits[0]?.fact.object).toBe("LOKAL-742");
    } finally {
      await autoApp.close();
    }
  });
});

describe("facts — propose/promote/forget", () => {
  it("alur lengkap: propose → promote → forget", async () => {
    const proposed = await app.inject({
      method: "POST",
      url: "/v1/facts/propose",
      payload: {
        proposedText: "Amanda suka teh",
        proposedAt: T0,
        provenance: { sourceApp: "chatgpt" },
        trust: "HOSTED_AGENT",
        scope: "personal",
      },
    });
    expect(proposed.statusCode).toBe(201);
    const factId = proposed.json().id as string;

    const promoted = await app.inject({
      method: "POST",
      url: `/v1/facts/${factId}/promote`,
      payload: {
        now: T0,
        subject: "Amanda",
        predicate: "suka",
        object: "teh",
        text: "Amanda suka teh",
        confidence: 0.8,
        salience: 0.5,
        sourceEpisodeIds: ["epi_1"],
        tValid: T0,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
    });
    expect(promoted.statusCode).toBe(200);

    const listed = await app.inject({ method: "GET", url: "/v1/facts" });
    expect(listed.json().facts).toHaveLength(1);

    const forgotten = await app.inject({
      method: "POST",
      url: `/v1/facts/${factId}/forget`,
      payload: { now: NOW },
    });
    expect(forgotten.statusCode).toBe(200);
    expect(forgotten.json().tInvalid).toBe(NOW);

    const afterForget = await app.inject({ method: "GET", url: "/v1/facts" });
    expect(afterForget.json().facts).toHaveLength(0);
  });

  it("forget fakta yang tidak ada → 404, bukan 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/facts/mem_nope/forget",
      payload: { now: NOW },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.type).toBe("NOT_FOUND");
  });

  it("forget dua kali → 409 (FactAlreadyInvalidatedError dipetakan, bukan 500)", async () => {
    const fact = repo.insertFact(factInput());

    await app.inject({
      method: "POST",
      url: `/v1/facts/${fact.id}/forget`,
      payload: { now: T0 },
    });
    const second = await app.inject({
      method: "POST",
      url: `/v1/facts/${fact.id}/forget`,
      payload: { now: NOW },
    });
    expect(second.statusCode).toBe(409);
  });
});

describe("core memory", () => {
  it("PUT lalu GET mengembalikan blok yang sama", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/v1/core-memory/persona",
      payload: { description: "identitas", value: "Nama: Amanda", now: T0 },
    });
    expect(put.statusCode).toBe(200);

    const got = await app.inject({ method: "GET", url: "/v1/core-memory" });
    expect(got.json().blocks).toHaveLength(1);
    expect(got.json().blocks[0].value).toBe("Nama: Amanda");
  });
});

describe("retrieve", () => {
  it("mengembalikan hits kosong kalau tidak ada fakta", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/retrieve",
      payload: { query: "kopi", scopes: ["personal"], now: NOW },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().hits).toEqual([]);
  });

  it("menolak request tanpa scopes (400, bukan mengembalikan semua data)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/retrieve",
      payload: { query: "kopi", scopes: [], now: NOW },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("artifacts", () => {
  it("GET /v1/artifacts mengembalikan pointer yang sudah disimpan", async () => {
    repo.putArtifactPointer({
      id: "art_ab",
      path: "catatan/x.md",
      description: "catatan",
      mimeType: "text/markdown",
      sizeBytes: 10,
      scope: "personal",
      sensitivity: "INTERNAL",
    });

    const res = await app.inject({ method: "GET", url: "/v1/artifacts?scope=personal" });
    expect(res.json().pointers).toHaveLength(1);
  });
});

describe("consolidate", () => {
  it("clears Project failure diagnostics after a successful explicit retry", async () => {
    repo.appendEpisode({
      id: "epi_retry",
      ts: T0,
      rawText: "harmless test",
      provenance: PROVENANCE,
      projectId: "prj_retry" as never,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "USER",
    });
    let invalid = true;
    const retryApp = buildContextServer(repo, vectors, {
      extractLocal: async () => (invalid ? "invalid" : "[]"),
    });
    try {
      for (const expected of ["failed", "complete"]) {
        const result = await retryApp.inject({
          method: "POST",
          url: "/v1/consolidate/run",
          payload: { now: NOW, projectId: "prj_retry" },
        });
        expect(result.statusCode).toBe(200);
        const status = await retryApp.inject({
          method: "GET",
          url: "/v1/memory/status?projectId=prj_retry",
        });
        expect(status.json()).toMatchObject({
          lastAttempt: expected,
          pendingEpisodes: invalid ? 1 : 0,
          lastFailureCodes: invalid ? ["INVALID_JSON"] : [],
        });
        invalid = false;
      }
    } finally {
      await retryApp.close();
    }
  });

  it("POST /v1/consolidate/run memproses episode yang belum terkonsolidasi", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "halo",
        provenance: PROVENANCE,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/consolidate/run",
      payload: { now: NOW },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().processed).toBe(1);
  });

  it("500→400 yang jelas kalau extractLocal tidak dikonfigurasi", async () => {
    const bareApp = buildContextServer(repo, vectors);
    const res = await bareApp.inject({
      method: "POST",
      url: "/v1/consolidate/run",
      payload: { now: NOW },
    });
    expect(res.statusCode).toBe(400);
    await bareApp.close();
  });
});

describe("/healthz", () => {
  it("jalan tanpa auth", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.json()).toEqual({ status: "ok", service: "context" });
  });
});

describe("maintenance owner API", () => {
  it("returns an explicit dry-run diff and rejects a stale plan fail-closed", async () => {
    const planned = await app.inject({
      method: "POST",
      url: "/v1/maintenance/plan",
      payload: { operationId: "op_httpmaint001", actions: ["verify"], now: NOW },
    });
    expect(planned.statusCode).toBe(200);
    const plan = planned.json();
    expect(plan.diff).toMatchObject({
      pendingMigrationVersions: [],
      normalizableFacts: 0,
      duplicateLiveDerivedGroups: 0,
      rebuildL1: false,
      rebuildFts: false,
      reindexVector: false,
    });

    const appended = await app.inject({
      method: "POST",
      url: "/v1/episodes",
      payload: {
        ts: T0,
        rawText: "advance immutable L0",
        provenance: PROVENANCE,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        trust: "USER",
      },
    });
    expect(appended.statusCode).toBe(201);

    const executed = await app.inject({
      method: "POST",
      url: "/v1/maintenance/execute",
      payload: { plan },
    });
    expect(executed.statusCode).toBe(409);

    const verified = await app.inject({ method: "GET", url: "/v1/maintenance/verify" });
    expect(verified.statusCode).toBe(200);
    const receipts = await app.inject({ method: "GET", url: "/v1/maintenance/receipts" });
    expect(receipts.statusCode).toBe(200);
    expect(receipts.json().receipts).toEqual([]);
  });
});
