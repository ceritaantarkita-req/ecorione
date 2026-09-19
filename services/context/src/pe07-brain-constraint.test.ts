import { afterEach, describe, expect, it } from "vitest";
import { buildContextServer } from "./http.js";
import { ContextRetriever } from "./retrieval.js";
import type { ContextDatabase } from "./db.js";
import { factInput, makeRepo, NOW } from "./test-helpers.js";

let open: ContextDatabase | null = null;

afterEach(() => {
  open?.close();
  open = null;
});

describe("PE-07 Brain-derived Context constraint", () => {
  it("intersects exact source URIs after normal Project authorization", () => {
    const { db, repo } = makeRepo();
    open = db;
    const retriever = new ContextRetriever(repo);

    repo.insertFact(
      factInput({
        id: "mem_alpha_a",
        text: "PE07_TOKEN alpha source A",
        projectId: "prj_alpha" as never,
        provenance: { sourceApp: "test", sourceUri: "https://a.example/source" },
      }),
    );
    repo.insertFact(
      factInput({
        id: "mem_alpha_b",
        text: "PE07_TOKEN alpha source B",
        projectId: "prj_alpha" as never,
        provenance: { sourceApp: "test", sourceUri: "https://b.example/source" },
      }),
    );
    repo.insertFact(
      factInput({
        id: "mem_beta_a",
        text: "PE07_TOKEN beta sibling",
        projectId: "prj_beta" as never,
        provenance: { sourceApp: "test", sourceUri: "https://a.example/source" },
      }),
    );

    const baseline = retriever.retrieve({
      query: "PE07_TOKEN",
      scopes: ["personal"],
      projectId: "prj_alpha" as never,
      now: NOW,
    });
    expect(baseline.hits.map((hit) => hit.fact.id).sort()).toEqual([
      "mem_alpha_a",
      "mem_alpha_b",
    ]);
    expect(baseline.diagnostics.constraintApplied).toBe(false);

    const narrowed = retriever.retrieve({
      query: "PE07_TOKEN",
      scopes: ["personal"],
      projectId: "prj_alpha" as never,
      candidateSourceUris: ["https://a.example/source"],
      now: NOW,
    });
    expect(narrowed.hits.map((hit) => hit.fact.id)).toEqual(["mem_alpha_a"]);
    expect(narrowed.diagnostics.authorizedCandidates).toBe(2);
    expect(narrowed.diagnostics.narrowedCandidates).toBe(1);
    expect(narrowed.diagnostics.constraintApplied).toBe(true);
    expect(narrowed.hits.some((hit) => hit.fact.id === "mem_beta_a")).toBe(false);
  });

  it("treats an explicit empty Brain candidate set as fail-closed, not baseline", () => {
    const { db, repo } = makeRepo();
    open = db;
    const retriever = new ContextRetriever(repo);
    repo.insertFact(factInput({ id: "mem_visible", text: "PE07_EMPTY visible" }));

    const result = retriever.retrieve({
      query: "PE07_EMPTY",
      scopes: ["personal"],
      candidateSourceUris: [],
      now: NOW,
    });

    expect(result.hits).toEqual([]);
    expect(result.diagnostics.constraintApplied).toBe(true);
    expect(result.diagnostics.narrowedCandidates).toBe(0);
  });

  it("validates candidateSourceUris at the Context HTTP boundary", async () => {
    const { db, repo } = makeRepo();
    open = db;
    const app = buildContextServer(repo, undefined, { logger: false });
    try {
      const invalid = await app.inject({
        method: "POST",
        url: "/v1/retrieve",
        payload: {
          query: "PE07",
          scopes: ["personal"],
          now: NOW,
          candidateSourceUris: ["not-a-url"],
        },
      });
      expect(invalid.statusCode).toBe(400);

      const valid = await app.inject({
        method: "POST",
        url: "/v1/retrieve",
        payload: {
          query: "PE07",
          scopes: ["personal"],
          now: NOW,
          candidateSourceUris: [],
        },
      });
      expect(valid.statusCode).toBe(200);
      expect(valid.json().diagnostics.constraintApplied).toBe(true);
    } finally {
      await app.close();
    }
  });
});
