import { performance } from "node:perf_hooks";
import { z } from "zod";
import {
  EcxHydrateResponseSchema,
  EcxPlanResponseSchema,
  ProjectIdSchema,
  RetrievalHitSchema,
  ScopeSchema,
  SensitivitySchema,
  WorkspaceIdSchema,
  makeId,
  type BrainNeighborhoodResponse,
  type EcxHydrateResponse,
  type RetrievalHit,
} from "@ecorione/shared-schema";
import { authorizeBrainProject, queryBrainNeighborhood } from "./brain-projection";

const DEFAULT_CONTEXT_URL = "http://127.0.0.1:17022";
const DEFAULT_HUB_URL = "http://127.0.0.1:17024";

export const BrainContextEcxRequestSchema = z
  .object({
    mode: z.enum(["baseline", "brain-narrowed"]),
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    question: z.string().min(1).max(2048),
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema.default("INTERNAL"),
    hostedEligible: z.boolean().default(false),
    now: z.string().datetime({ offset: false }),
    seedNodeIds: z.array(z.string().min(1).max(128)).max(8).default([]),
    maxHops: z.number().int().min(0).max(2).default(1),
    maxNodes: z.number().int().min(1).max(64).default(32),
    contextK: z.number().int().min(1).max(20).default(20),
    maxRefs: z.number().int().min(1).max(20).default(4),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "brain-narrowed" && value.seedNodeIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seedNodeIds"],
        message: "brain-narrowed membutuhkan minimal satu seedNodeId.",
      });
    }
    if (value.maxNodes < value.seedNodeIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxNodes"],
        message: "maxNodes tidak boleh lebih kecil dari jumlah seed.",
      });
    }
  });
export type BrainContextEcxRequest = z.infer<typeof BrainContextEcxRequestSchema>;

const RetrievalDiagnosticsSchema = z
  .object({
    lexicalCandidates: z.number().int().nonnegative(),
    vectorCandidates: z.number().int().nonnegative(),
    afterFilter: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    authorizedCandidates: z.number().int().nonnegative(),
    narrowedCandidates: z.number().int().nonnegative(),
    constraintApplied: z.boolean(),
  })
  .strict();

const RetrieveResponseSchema = z
  .object({
    hits: z.array(RetrievalHitSchema),
    diagnostics: RetrievalDiagnosticsSchema,
  })
  .strict();

type RetrieveResponse = z.infer<typeof RetrieveResponseSchema>;

export interface BrainContextEcxResult {
  readonly mode: BrainContextEcxRequest["mode"];
  readonly neighborhood: BrainNeighborhoodResponse | null;
  readonly retrieval: RetrieveResponse & { readonly latencyMs: number };
  readonly ecx: {
    readonly packetId: string;
    readonly selectedFactIds: string[];
    readonly hydratedBytes: number;
    readonly latencyMs: number;
    readonly items: EcxHydrateResponse["items"];
  };
}

function ownerBaseUrl(
  name: "ECORIONE_CONTEXT_URL" | "ECORIONE_HUB_URL",
  fallback: string,
): string {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : fallback;
}

function internalToken(): string | undefined {
  const value = process.env.ECORIONE_INTERNAL_TOKEN;
  return value !== undefined && value.length > 0 ? value : undefined;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const token = internalToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
    redirect: "error",
  });
  const parsed = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} HTTP ${String(response.status)} ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

function memoryRefs(hits: readonly RetrievalHit[]) {
  return hits.map((hit) => ({ kind: "memoryFact" as const, factId: hit.fact.id }));
}

export async function runBrainContextEcx(
  input: BrainContextEcxRequest,
): Promise<BrainContextEcxResult> {
  const neighborhood =
    input.mode === "brain-narrowed"
      ? await queryBrainNeighborhood({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          seedNodeIds: input.seedNodeIds,
          maxHops: input.maxHops,
          maxNodes: input.maxNodes,
        })
      : (await authorizeBrainProject(input), null);

  const retrievalStarted = performance.now();
  const retrieval = RetrieveResponseSchema.parse(
    await postJson(`${ownerBaseUrl("ECORIONE_CONTEXT_URL", DEFAULT_CONTEXT_URL)}/v1/retrieve`, {
      query: input.question,
      scopes: [input.scope],
      projectId: input.projectId,
      k: input.contextK,
      maxSensitivity: input.maxSensitivity,
      hostedEligibleOnly: input.hostedEligible,
      now: input.now,
      ...(neighborhood === null
        ? {}
        : {
            candidateSourceUris: neighborhood.contextConstraint.sourceUris,
            candidateFactIds: neighborhood.contextConstraint.factIds,
          }),
    }),
  );
  const retrievalLatencyMs = performance.now() - retrievalStarted;

  const plan = EcxPlanResponseSchema.parse(
    await postJson(`${ownerBaseUrl("ECORIONE_HUB_URL", DEFAULT_HUB_URL)}/v1/exchange/plan`, {
      operationId: makeId("operation"),
      requestedAt: input.now,
      sender: "agent:brain-context-pe07",
      intent: "context-pack",
      task: input.question,
      need: ["context"],
      refs: memoryRefs(retrieval.hits),
      budget: { maxHydratedBytes: 262_144 },
      responseMode: "delta",
      candidates: [
        {
          agentId: "agent:brain-context-pack",
          capabilities: ["context"],
          estimatedCost: 0,
        },
      ],
      maxRecipients: 1,
    }),
  );
  const packet = plan.packets[0];
  if (packet === undefined) throw new Error("ECX plan tidak menghasilkan packet.");

  const ecxStarted = performance.now();
  const hydrated = EcxHydrateResponseSchema.parse(
    await postJson(`${ownerBaseUrl("ECORIONE_HUB_URL", DEFAULT_HUB_URL)}/v1/exchange/hydrate`, {
      packet,
      selection: { mode: "semantic-v1", maxRefs: input.maxRefs },
      scope: input.scope,
      maxSensitivity: input.maxSensitivity,
      hostedEligible: input.hostedEligible,
    }),
  );
  const ecxLatencyMs = performance.now() - ecxStarted;

  return {
    mode: input.mode,
    neighborhood,
    retrieval: {
      ...retrieval,
      latencyMs: retrievalLatencyMs,
    },
    ecx: {
      packetId: hydrated.packetId,
      selectedFactIds: hydrated.items.flatMap((item) =>
        item.ref.kind === "memoryFact" ? [item.ref.factId] : [],
      ),
      hydratedBytes: hydrated.hydratedBytes,
      latencyMs: ecxLatencyMs,
      items: hydrated.items,
    },
  };
}
