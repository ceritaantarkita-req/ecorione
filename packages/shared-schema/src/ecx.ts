/** Ecorione Compact Exchange (ECX) contracts — pointer-first agent handoff (ADR-19). */
import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import {
  ArtifactIdSchema,
  EventIdSchema,
  MemoryFactIdSchema,
  OperationIdSchema,
  SessionIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";

export const ECX_VERSION = 1 as const;
const TimestampSchema = z.string().datetime({ offset: false });
export const EcxAgentIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9:._-]*$/);
export type EcxAgentId = z.infer<typeof EcxAgentIdSchema>;

export const EcxRuntimeTargetSchema = z.enum(["local", "hosted"]);
export type EcxRuntimeTarget = z.infer<typeof EcxRuntimeTargetSchema>;

const EcxCapabilityNameSchema = z.string().min(1).max(64);

function uniqueCapabilities(
  value: { capabilities: readonly string[] },
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, capability] of value.capabilities.entries()) {
    const normalized = capability.trim().toLowerCase();
    if (seen.has(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities", index],
        message: `Capability agent duplikat: ${capability}.`,
      });
    }
    seen.add(normalized);
  }
}

export const EcxAgentBindingUpsertRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    target: EcxRuntimeTargetSchema,
    capabilities: z.array(EcxCapabilityNameSchema).min(1).max(64),
    systemPrompt: z.string().min(1).max(4096),
    enabled: z.boolean().default(true),
  })
  .strict()
  .superRefine(uniqueCapabilities);
export type EcxAgentBindingUpsertRequest = z.infer<typeof EcxAgentBindingUpsertRequestSchema>;

export const EcxAgentBindingSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    agentId: EcxAgentIdSchema,
    target: EcxRuntimeTargetSchema,
    capabilities: z.array(EcxCapabilityNameSchema).min(1).max(64),
    systemPrompt: z.string().min(1).max(4096),
    enabled: z.boolean(),
    updatedAt: TimestampSchema,
  })
  .strict()
  .superRefine(uniqueCapabilities);
export type EcxAgentBinding = z.infer<typeof EcxAgentBindingSchema>;

export const EcxAgentBindingListQuerySchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
  })
  .strict();

export const EcxHistoryRefSchema = z
  .object({
    kind: z.literal("history"),
    sessionId: SessionIdSchema,
    afterSeq: z.number().int().min(-1),
    throughSeq: z.number().int().nonnegative(),
  })
  .refine((value) => value.throughSeq > value.afterSeq, {
    message: "throughSeq harus lebih besar dari afterSeq.",
  });
export const EcxArtifactRefSchema = z.object({
  kind: z.literal("artifact"),
  artifactId: ArtifactIdSchema,
});
export const EcxMemoryFactRefSchema = z.object({
  kind: z.literal("memoryFact"),
  factId: MemoryFactIdSchema,
});
export const EcxReferenceSchema = z.discriminatedUnion("kind", [
  EcxHistoryRefSchema,
  EcxArtifactRefSchema,
  EcxMemoryFactRefSchema,
]);
export type EcxReference = z.infer<typeof EcxReferenceSchema>;

export const EcxBudgetSchema = z.object({
  maxHydratedBytes: z.number().int().min(256).max(2_000_000),
});
export type EcxBudget = z.infer<typeof EcxBudgetSchema>;

export const EcxPacketSchema = z.object({
  version: z.literal(ECX_VERSION),
  packetId: EventIdSchema,
  operationId: OperationIdSchema,
  sender: EcxAgentIdSchema,
  recipient: EcxAgentIdSchema,
  intent: z.string().min(1).max(128),
  task: z.string().min(1).max(2048),
  need: z.array(z.string().min(1).max(64)).min(1).max(32),
  refs: z.array(EcxReferenceSchema).max(32),
  budget: EcxBudgetSchema,
  responseMode: z.enum(["delta", "full"]),
  historySessionId: SessionIdSchema.optional(),
});
export type EcxPacket = z.infer<typeof EcxPacketSchema>;

export const EcxCandidateSchema = z.object({
  agentId: EcxAgentIdSchema,
  capabilities: z.array(z.string().min(1).max(64)).min(1).max(64),
  estimatedCost: z.number().nonnegative().finite(),
});
export type EcxCandidate = z.infer<typeof EcxCandidateSchema>;

export const EcxPlanRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    requestedAt: TimestampSchema,
    sender: EcxAgentIdSchema,
    intent: z.string().min(1).max(128),
    task: z.string().min(1).max(2048),
    need: z.array(z.string().min(1).max(64)).min(1).max(32),
    refs: z.array(EcxReferenceSchema).max(32).default([]),
    budget: EcxBudgetSchema,
    responseMode: z.enum(["delta", "full"]).default("delta"),
    candidates: z.array(EcxCandidateSchema).min(1).max(64),
    maxRecipients: z.number().int().min(1).max(8).default(1),
    historySessionId: SessionIdSchema.optional(),
  })
  .refine(
    (value) =>
      new Set(value.candidates.map((candidate) => candidate.agentId)).size ===
      value.candidates.length,
    {
      message: "candidate agentId tidak boleh duplikat.",
      path: ["candidates"],
    },
  );
export type EcxPlanRequest = z.infer<typeof EcxPlanRequestSchema>;

export const EcxPlanResponseSchema = z.object({
  packets: z.array(EcxPacketSchema),
  metrics: z.object({
    candidateCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
    packetBytes: z.number().int().nonnegative(),
  }),
});
export type EcxPlanResponse = z.infer<typeof EcxPlanResponseSchema>;

export const EcxReferenceSelectionSchema = z.object({
  mode: z.literal("semantic-v1"),
  maxRefs: z.number().int().min(1).max(32).default(4),
});
export type EcxReferenceSelection = z.infer<typeof EcxReferenceSelectionSchema>;

export const EcxHydrateRequestSchema = z
  .object({
    packet: EcxPacketSchema,
    refIndexes: z.array(z.number().int().nonnegative()).min(1).max(32).optional(),
    selection: EcxReferenceSelectionSchema.optional(),
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema,
    hostedEligible: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const explicit = value.refIndexes !== undefined;
    const automatic = value.selection !== undefined;
    if (explicit === automatic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pilih tepat satu: refIndexes atau selection.",
        path: ["refIndexes"],
      });
    }
    if (
      value.refIndexes !== undefined &&
      new Set(value.refIndexes).size !== value.refIndexes.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "refIndexes tidak boleh duplikat.",
        path: ["refIndexes"],
      });
    }
  });
export type EcxHydrateRequest = z.infer<typeof EcxHydrateRequestSchema>;

export const EcxHydratedItemSchema = z.object({
  index: z.number().int().nonnegative(),
  ref: EcxReferenceSchema,
  mediaType: z.string().min(1).max(128),
  contentBase64: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type EcxHydratedItem = z.infer<typeof EcxHydratedItemSchema>;

export const EcxHydrateResponseSchema = z.object({
  packetId: EventIdSchema,
  hydratedBytes: z.number().int().nonnegative(),
  items: z.array(EcxHydratedItemSchema),
});
export type EcxHydrateResponse = z.infer<typeof EcxHydrateResponseSchema>;

export const EcxExecuteRequestSchema = z
  .object({
    packet: EcxPacketSchema,
    workspaceId: WorkspaceIdSchema,
    refIndexes: z.array(z.number().int().nonnegative()).min(1).max(32).optional(),
    selection: EcxReferenceSelectionSchema.optional(),
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema,
    requestedAt: TimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const explicit = value.refIndexes !== undefined;
    const automatic = value.selection !== undefined;
    if (value.packet.refs.length === 0) {
      if (explicit || automatic) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Packet tanpa refs tidak menerima refIndexes/selection.",
          path: ["refIndexes"],
        });
      }
      return;
    }
    if (explicit === automatic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pilih tepat satu: refIndexes atau selection.",
        path: ["refIndexes"],
      });
    }
    if (
      value.refIndexes !== undefined &&
      new Set(value.refIndexes).size !== value.refIndexes.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "refIndexes tidak boleh duplikat.",
        path: ["refIndexes"],
      });
    }
  });
export type EcxExecuteRequest = z.infer<typeof EcxExecuteRequestSchema>;

export const EcxExecutionCompletionSchema = z.object({
  reply: z.string(),
  provider: z.string().min(1),
  model: z.string().min(1),
  responseModel: z.string().min(1),
  modelIdentity: z.string().min(1),
  modelIdentityPinned: z.boolean(),
  cacheHit: z.boolean(),
  routeReason: z.string().min(1),
});
export type EcxExecutionCompletion = z.infer<typeof EcxExecutionCompletionSchema>;

export const EcxExecutionStateSchema = z.enum(["STARTED", "SUCCEEDED", "FAILED", "UNCERTAIN"]);
export type EcxExecutionState = z.infer<typeof EcxExecutionStateSchema>;

export const EcxExecutionStatusSchema = z
  .object({
    packetId: EventIdSchema,
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    recipient: EcxAgentIdSchema,
    target: EcxRuntimeTargetSchema,
    historySessionId: SessionIdSchema.nullable(),
    state: EcxExecutionStateSchema,
    hydratedBytes: z.number().int().nonnegative(),
    selectedRefIndexes: z.array(z.number().int().nonnegative()),
    error: z.string().nullable(),
    resultAvailable: z.boolean(),
    startedAt: TimestampSchema,
    updatedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
  })
  .strict();
export type EcxExecutionStatus = z.infer<typeof EcxExecutionStatusSchema>;

export const EcxExecutionLookupQuerySchema = z
  .object({ workspaceId: WorkspaceIdSchema })
  .strict();

export const EcxExecuteResponseSchema = z
  .object({
    packetId: EventIdSchema,
    operationId: OperationIdSchema,
    recipient: EcxAgentIdSchema,
    target: EcxRuntimeTargetSchema,
    state: z.literal("SUCCEEDED"),
    replayed: z.boolean(),
    hydratedBytes: z.number().int().nonnegative(),
    selectedRefIndexes: z.array(z.number().int().nonnegative()),
    history: z
      .object({
        startedEventId: EventIdSchema.nullable(),
        outcomeEventId: EventIdSchema.nullable(),
      })
      .strict(),
    completion: EcxExecutionCompletionSchema,
  })
  .strict();
export type EcxExecuteResponse = z.infer<typeof EcxExecuteResponseSchema>;
