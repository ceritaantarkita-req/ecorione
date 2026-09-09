/** Ecorione Compact Exchange (ECX) contracts — pointer-first agent handoff (ADR-19). */
import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import {
  ArtifactIdSchema,
  EventIdSchema,
  MemoryFactIdSchema,
  OperationIdSchema,
  SessionIdSchema,
} from "./ids.js";

export const ECX_VERSION = 1 as const;
const TimestampSchema = z.string().datetime({ offset: false });
export const EcxAgentIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9:._-]*$/);
export type EcxAgentId = z.infer<typeof EcxAgentIdSchema>;

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
});
export type EcxPacket = z.infer<typeof EcxPacketSchema>;

export const EcxCandidateSchema = z.object({
  agentId: EcxAgentIdSchema,
  capabilities: z.array(z.string().min(1).max(64)).min(1).max(64),
  estimatedCost: z.number().nonnegative().finite(),
});
export type EcxCandidate = z.infer<typeof EcxCandidateSchema>;

export const EcxPlanRequestSchema = z.object({
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
});
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

export const EcxHydrateRequestSchema = z
  .object({
    packet: EcxPacketSchema,
    refIndexes: z.array(z.number().int().nonnegative()).min(1).max(32),
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema,
    hostedEligible: z.boolean().default(false),
  })
  .refine((value) => new Set(value.refIndexes).size === value.refIndexes.length, {
    message: "refIndexes tidak boleh duplikat.",
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
