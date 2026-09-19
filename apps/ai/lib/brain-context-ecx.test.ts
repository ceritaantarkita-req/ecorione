import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrainContextEcxRequestSchema, runBrainContextEcx } from "./brain-context-ecx";

const NOW = "2026-09-19T12:00:00.000Z";
const WORKSPACE_ID = "ws_personal";
const PROJECT_ID = "prj_alpha";
const SOURCE_URI = "https://alpha.example/source";

function project() {
  return {
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: "Alpha",
    description: "",
    instruction: "",
    memoryPolicy: "GLOBAL_PLUS_PROJECT",
    autonomyCeiling: "L3",
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
  };
}

function fact(id: string, text: string, sourceUri?: string) {
  return {
    id,
    subject: "PE07",
    predicate: "states",
    object: text,
    text,
    confidence: 1,
    salience: 0.8,
    sourceEpisodeIds: ["epi_pe07source"],
    tValid: NOW,
    tInvalid: null,
    supersededBy: null,
    createdAt: NOW,
    projectId: PROJECT_ID,
    scope: "personal",
    sensitivity: "INTERNAL",
    syncClass: "LOCAL_ONLY",
    trust: "USER",
    provenance: {
      sourceApp: "test",
      ...(sourceUri === undefined ? {} : { sourceUri }),
    },
  };
}

function retrievePayload(hits: ReturnType<typeof fact>[], constraintApplied: boolean) {
  return {
    hits: hits.map((entry, index) => ({
      fact: entry,
      score: 1 - index * 0.1,
      matchedBy: ["lexical"],
    })),
    diagnostics: {
      lexicalCandidates: hits.length,
      vectorCandidates: 0,
      afterFilter: hits.length,
      returned: hits.length,
      authorizedCandidates: constraintApplied ? 2 : hits.length,
      narrowedCandidates: hits.length,
      constraintApplied,
    },
  };
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function packetFromPlan(body: Record<string, any>) {
  return {
    version: 1,
    packetId: "evt_pe07packet01",
    operationId: body.operationId,
    sender: body.sender,
    recipient: "agent:brain-context-pack",
    intent: body.intent,
    task: body.task,
    need: body.need,
    refs: body.refs,
    budget: body.budget,
    responseMode: body.responseMode,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PE-07 Brain -> Context -> ECX integration", () => {
  it("keeps baseline explicit and does not traverse Brain owners", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const alpha = fact("mem_pe07alpha", "PE07 alpha authoritative", SOURCE_URI);
    const global = fact("mem_pe07global", "PE07 global supporting");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));
        calls.push({ url, body });

        if (url.includes("/v1/projects/") && !url.includes("/sources")) return json(project());
        if (url.endsWith("/v1/retrieve")) return json(retrievePayload([alpha, global], false));
        if (url.endsWith("/v1/exchange/plan")) {
          const packet = packetFromPlan(body);
          return json({
            packets: [packet],
            metrics: {
              candidateCount: 1,
              recipientCount: 1,
              packetBytes: 100,
            },
          });
        }
        if (url.endsWith("/v1/exchange/hydrate")) {
          const packet = body.packet;
          return json({
            packetId: packet.packetId,
            hydratedBytes: 80,
            items: [
              {
                index: 0,
                ref: packet.refs[0],
                mediaType: "application/json",
                contentBase64: Buffer.from(JSON.stringify(alpha), "utf8").toString("base64"),
                sizeBytes: 80,
              },
            ],
          });
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const result = await runBrainContextEcx(
      BrainContextEcxRequestSchema.parse({
        mode: "baseline",
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        question: "PE07 authoritative?",
        scope: "personal",
        now: NOW,
      }),
    );

    expect(result.neighborhood).toBeNull();
    expect(result.ecx.selectedFactIds).toEqual(["mem_pe07alpha"]);
    expect(calls.some((call) => call.url.includes("/v1/graphs"))).toBe(false);
    expect(calls.some((call) => call.url.includes("/sources"))).toBe(false);

    const contextCall = calls.find((call) => call.url.endsWith("/v1/retrieve"));
    expect(contextCall?.body.candidateSourceUris).toBeUndefined();

    const planCall = calls.find((call) => call.url.endsWith("/v1/exchange/plan"));
    expect(planCall?.body.refs).toEqual([
      { kind: "memoryFact", factId: "mem_pe07alpha" },
      { kind: "memoryFact", factId: "mem_pe07global" },
    ]);
  });

  it("uses authorized Brain source neighborhood as a Context constraint before ECX", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const alpha = fact("mem_pe07alpha", "PE07 alpha authoritative", SOURCE_URI);
    const projectNodeId =
      "project:" + createHash("sha256").update(PROJECT_ID).digest("hex");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));
        calls.push({ url, body });

        if (url.includes("/v1/projects/") && !url.includes("/sources")) return json(project());
        if (url.includes("/v1/projects/") && url.includes("/sources")) {
          return json({
            sources: [
              {
                binding: {
                  projectId: PROJECT_ID,
                  workspaceId: WORKSPACE_ID,
                  resourceType: "url",
                  resourceId: SOURCE_URI,
                  owner: "Connect",
                  role: "source",
                  createdAt: NOW,
                },
                availability: "AVAILABLE",
                metadata: { url: SOURCE_URI },
                unavailableReason: null,
              },
            ],
          });
        }
        if (url.includes("/v1/graphs?")) return json({ graphs: [] });
        if (url.includes("/v1/triggers?")) return json({ triggers: [] });
        if (url.includes("/v1/runs?")) return json({ runs: [] });
        if (url.endsWith("/v1/retrieve")) {
          expect(body.candidateSourceUris).toEqual([SOURCE_URI]);
          return json(retrievePayload([alpha], true));
        }
        if (url.endsWith("/v1/exchange/plan")) {
          expect(body.refs).toEqual([{ kind: "memoryFact", factId: "mem_pe07alpha" }]);
          const packet = packetFromPlan(body);
          return json({
            packets: [packet],
            metrics: {
              candidateCount: 1,
              recipientCount: 1,
              packetBytes: 100,
            },
          });
        }
        if (url.endsWith("/v1/exchange/hydrate")) {
          const packet = body.packet;
          expect(body.selection).toEqual({ mode: "semantic-v1", maxRefs: 4 });
          return json({
            packetId: packet.packetId,
            hydratedBytes: 80,
            items: [
              {
                index: 0,
                ref: packet.refs[0],
                mediaType: "application/json",
                contentBase64: Buffer.from(JSON.stringify(alpha), "utf8").toString("base64"),
                sizeBytes: 80,
              },
            ],
          });
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const result = await runBrainContextEcx(
      BrainContextEcxRequestSchema.parse({
        mode: "brain-narrowed",
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        question: "PE07 authoritative?",
        scope: "personal",
        now: NOW,
        seedNodeIds: [projectNodeId],
        maxHops: 1,
      }),
    );

    expect(result.neighborhood?.contextConstraint.sourceUris).toEqual([SOURCE_URI]);
    expect(result.retrieval.diagnostics.authorizedCandidates).toBe(2);
    expect(result.retrieval.diagnostics.narrowedCandidates).toBe(1);
    expect(result.ecx.selectedFactIds).toEqual(["mem_pe07alpha"]);
  });

  it("fails before Context and ECX when the Brain seed is not authorized", async () => {
    const calls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/v1/projects/") && !url.includes("/sources")) return json(project());
        if (url.includes("/v1/projects/") && url.includes("/sources")) return json({ sources: [] });
        if (url.includes("/v1/graphs?")) return json({ graphs: [] });
        if (url.includes("/v1/triggers?")) return json({ triggers: [] });
        if (url.includes("/v1/runs?")) return json({ runs: [] });
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    await expect(
      runBrainContextEcx(
        BrainContextEcxRequestSchema.parse({
          mode: "brain-narrowed",
          workspaceId: WORKSPACE_ID,
          projectId: PROJECT_ID,
          question: "PE07?",
          scope: "personal",
          now: NOW,
          seedNodeIds: ["source:not-authorized"],
        }),
      ),
    ).rejects.toThrow("Brain seed tidak tersedia");

    expect(calls.some((url) => url.endsWith("/v1/retrieve"))).toBe(false);
    expect(calls.some((url) => url.endsWith("/v1/exchange/plan"))).toBe(false);
  });
});
