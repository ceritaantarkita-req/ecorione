import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import {
  BrainGraphResponseSchema,
  BrainNeighborhoodQuerySchema,
  EcxPacketSchema,
  type MemoryFact,
} from "@ecorione/shared-schema";
import { selectBrainNeighborhood } from "../apps/ai/lib/brain-projection.js";
import { openContextDatabase, type ContextDatabase } from "../services/context/src/db.js";
import { ContextRepository } from "../services/context/src/repository.js";
import { ContextRetriever } from "../services/context/src/retrieval.js";
import { factInput } from "../services/context/src/test-helpers.js";
import { selectEcxReferenceIndexes } from "../services/hub/src/exchange-selector.js";

const NOW = "2026-09-19T12:00:00.000Z";
const WORKSPACE_ID = "ws_personal";
const PROJECT_ID = "prj_alpha";

const CASES = [
  {
    id: "routing",
    query: "PE07_ROUTING deployment control",
    need: "deployment-control",
    sourceUri: "https://alpha.example/routing",
    requiredFactId: "mem_pe07routing_required",
    requiredText: "PE07_ROUTING current deployment control requires approved routing.",
    noise: [
      ["mem_pe07routing_noise1", "https://alpha.example/archive", "PE07_ROUTING archived generic note."],
      ["mem_pe07routing_noise2", "https://alpha.example/legacy", "PE07_ROUTING legacy unrelated note."],
    ],
  },
  {
    id: "backup",
    query: "PE07_BACKUP restore verification",
    need: "restore-verification",
    sourceUri: "https://alpha.example/backup",
    requiredFactId: "mem_pe07backup_required",
    requiredText: "PE07_BACKUP restore verification requires the current checksum receipt.",
    noise: [
      ["mem_pe07backup_noise1", "https://alpha.example/old-backup", "PE07_BACKUP older generic schedule."],
      ["mem_pe07backup_noise2", "https://alpha.example/noise-backup", "PE07_BACKUP unrelated illustrative note."],
    ],
  },
  {
    id: "release",
    query: "PE07_RELEASE approval evidence",
    need: "approval-evidence",
    sourceUri: "https://alpha.example/release",
    requiredFactId: "mem_pe07release_required",
    requiredText: "PE07_RELEASE final approval evidence is the signed release receipt.",
    noise: [
      ["mem_pe07release_noise1", "https://alpha.example/retired-release", "PE07_RELEASE retired draft note."],
      ["mem_pe07release_noise2", "https://alpha.example/generic-release", "PE07_RELEASE generic historical note."],
    ],
  },
] as const;

let db: ContextDatabase | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

function sourceGraph(caseId: string, sourceUri: string) {
  const sourceNodeId = `source:${caseId}:required`;
  return {
    sourceNodeId,
    graph: BrainGraphResponseSchema.parse({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      totalNodes: 2,
      totalEdges: 1,
      truncated: false,
      nodes: [
        {
          id: "project:alpha",
          type: "Project",
          canonicalId: PROJECT_ID,
          owner: "Hub",
          label: "Alpha",
          workspaceId: WORKSPACE_ID,
          projectId: PROJECT_ID,
          availability: "AVAILABLE",
          href: "/projects",
          metadata: {},
        },
        {
          id: sourceNodeId,
          type: "Source",
          canonicalId: `url:${sourceUri}:source`,
          owner: "Connect",
          label: `url · ${sourceUri}`,
          workspaceId: WORKSPACE_ID,
          projectId: PROJECT_ID,
          availability: "AVAILABLE",
          href: "/projects",
          metadata: {
            resourceType: "url",
            resourceId: sourceUri,
            role: "source",
          },
        },
      ],
      edges: [
        {
          id: `BELONGS_TO:${sourceNodeId}->project:alpha`,
          type: "BELONGS_TO",
          sourceNodeId,
          targetNodeId: "project:alpha",
        },
      ],
    }),
  };
}

function packet(
  caseId: string,
  query: string,
  need: string,
  hits: readonly { fact: MemoryFact }[],
) {
  return EcxPacketSchema.parse({
    version: 1,
    packetId: `evt_pe07${caseId}packet`,
    operationId: `op_pe07${caseId}eval`,
    sender: "agent:pe07-eval",
    recipient: "agent:pe07-context",
    intent: "context-pack",
    task: query,
    need: [need],
    refs: hits.map((hit) => ({ kind: "memoryFact", factId: hit.fact.id })),
    budget: { maxHydratedBytes: 262_144 },
    responseMode: "delta",
  });
}

function selectedFactIds(
  caseId: string,
  query: string,
  need: string,
  hits: readonly { fact: MemoryFact }[],
): string[] {
  const ecxPacket = packet(caseId, query, need, hits);
  const indexes = selectEcxReferenceIndexes(
    ecxPacket,
    hits.map((hit, index) => ({
      index,
      text: [hit.fact.subject, hit.fact.predicate, hit.fact.object, hit.fact.text].join("\n"),
    })),
    { maxRefs: 2 },
  );
  return indexes.map((index) => hits[index]!.fact.id);
}

function bytes(hits: readonly { fact: MemoryFact }[]): number {
  return hits.reduce(
    (total, hit) => total + Buffer.byteLength(JSON.stringify(hit.fact), "utf8"),
    0,
  );
}

describe("PE-07 deterministic Brain + Context + ECX comparative evidence", () => {
  it("meets the predeclared retention/security gate and records bounded optimization metrics", () => {
    const results = [];

    for (const fixture of CASES) {
      const opened = openContextDatabase();
      db = opened;
      const repo = new ContextRepository(opened);
      const retriever = new ContextRetriever(repo);

      repo.insertFact(
        factInput({
          id: fixture.requiredFactId,
          text: fixture.requiredText,
          object: fixture.requiredText,
          projectId: PROJECT_ID as never,
          provenance: { sourceApp: "pe07-eval", sourceUri: fixture.sourceUri },
        }),
      );
      for (const [id, sourceUri, text] of fixture.noise) {
        repo.insertFact(
          factInput({
            id,
            text,
            object: text,
            projectId: PROJECT_ID as never,
            provenance: { sourceApp: "pe07-eval", sourceUri },
          }),
        );
      }

      // Same URI + same query token in a sibling Project must never enter either lane.
      repo.insertFact(
        factInput({
          id: `mem_pe07${fixture.id}_sibling`,
          text: fixture.requiredText,
          object: "sibling",
          projectId: "prj_beta" as never,
          provenance: { sourceApp: "pe07-eval", sourceUri: fixture.sourceUri },
        }),
      );
      // Normal Context sensitivity policy remains stronger than Brain membership.
      repo.insertFact(
        factInput({
          id: `mem_pe07${fixture.id}_restricted`,
          text: fixture.requiredText,
          object: "restricted",
          projectId: PROJECT_ID as never,
          sensitivity: "RESTRICTED",
          provenance: { sourceApp: "pe07-eval", sourceUri: fixture.sourceUri },
        }),
      );

      const baselineStarted = performance.now();
      const baseline = retriever.retrieve({
        query: fixture.query,
        scopes: ["personal"],
        projectId: PROJECT_ID as never,
        maxSensitivity: "INTERNAL",
        now: NOW as never,
        k: 20,
      });
      const baselineLatencyMs = performance.now() - baselineStarted;

      const { graph, sourceNodeId } = sourceGraph(fixture.id, fixture.sourceUri);
      const neighborhood = selectBrainNeighborhood(
        graph,
        BrainNeighborhoodQuerySchema.parse({
          workspaceId: WORKSPACE_ID,
          projectId: PROJECT_ID,
          seedNodeIds: [sourceNodeId],
          maxHops: 0,
          maxNodes: 1,
        }),
      );

      const narrowedStarted = performance.now();
      const narrowed = retriever.retrieve({
        query: fixture.query,
        scopes: ["personal"],
        projectId: PROJECT_ID as never,
        maxSensitivity: "INTERNAL",
        now: NOW as never,
        k: 20,
        candidateSourceUris: neighborhood.contextConstraint.sourceUris,
      });
      const narrowedLatencyMs = performance.now() - narrowedStarted;

      const baselineSelected = selectedFactIds(
        fixture.id,
        fixture.query,
        fixture.need,
        baseline.hits,
      );
      const narrowedSelected = selectedFactIds(
        fixture.id,
        fixture.query,
        fixture.need,
        narrowed.hits,
      );

      const baselineCandidates = baseline.diagnostics.authorizedCandidates;
      const narrowedCandidates = narrowed.diagnostics.narrowedCandidates;
      const candidateReductionPct =
        baselineCandidates === 0
          ? 0
          : ((baselineCandidates - narrowedCandidates) / baselineCandidates) * 100;

      results.push({
        id: fixture.id,
        requiredFactId: fixture.requiredFactId,
        baselineCandidates,
        narrowedCandidates,
        candidateReductionPct,
        baselineSelected,
        narrowedSelected,
        baselineContextBytes: bytes(baseline.hits),
        narrowedContextBytes: bytes(narrowed.hits),
        baselineLatencyMs,
        narrowedLatencyMs,
        sourceUris: neighborhood.contextConstraint.sourceUris,
        requiredRetained: narrowedSelected.includes(fixture.requiredFactId),
        provenanceRetained:
          narrowed.hits.find((hit) => hit.fact.id === fixture.requiredFactId)?.fact.provenance
            .sourceUri === fixture.sourceUri,
        siblingLeak: narrowed.hits.some((hit) => hit.fact.projectId === ("prj_beta" as never)),
        restrictedLeak: narrowed.hits.some((hit) => hit.fact.sensitivity === "RESTRICTED"),
      });

      opened.close();
      db = null;
    }

    const reductions = results
      .map((entry) => entry.candidateReductionPct)
      .sort((a, b) => a - b);
    const medianReductionPct = reductions[Math.floor(reductions.length / 2)] ?? 0;
    const strictReductionCases = results.filter(
      (entry) => entry.narrowedCandidates < entry.baselineCandidates,
    ).length;
    const summary = {
      profile: "deterministic-no-model",
      modelIdentity: null,
      cacheState: "N/A",
      hostedCostUsd: null,
      thresholds: {
        requiredReferenceRetentionPct: 100,
        unauthorizedReferenceCount: 0,
        medianCandidateReductionPct: 25,
        strictReductionCaseRatio: "2/3",
      },
      aggregate: {
        caseCount: results.length,
        requiredReferenceRetentionPct:
          (results.filter((entry) => entry.requiredRetained).length / results.length) * 100,
        provenanceRetentionPct:
          (results.filter((entry) => entry.provenanceRetained).length / results.length) * 100,
        unauthorizedReferenceCount: results.filter(
          (entry) => entry.siblingLeak || entry.restrictedLeak,
        ).length,
        medianCandidateReductionPct,
        strictReductionCases,
      },
      cases: results,
    };

    console.log(`PE07_EVIDENCE ${JSON.stringify(summary)}`);

    expect(summary.aggregate.requiredReferenceRetentionPct).toBe(100);
    expect(summary.aggregate.provenanceRetentionPct).toBe(100);
    expect(summary.aggregate.unauthorizedReferenceCount).toBe(0);
    expect(results.every((entry) => entry.narrowedCandidates <= entry.baselineCandidates)).toBe(
      true,
    );
    expect(summary.aggregate.medianCandidateReductionPct).toBeGreaterThanOrEqual(25);
    expect(summary.aggregate.strictReductionCases).toBeGreaterThanOrEqual(2);
    expect(results.every((entry) => entry.narrowedSelected.includes(entry.requiredFactId))).toBe(
      true,
    );
  });
});
