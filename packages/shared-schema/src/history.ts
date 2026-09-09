/** Typed append-only Historical Ledger contracts (ADR-18). */
import { z } from "zod";
import { ScopeSchema, SensitivitySchema, SyncClassSchema } from "./classification.js";
import { EventIdSchema, OperationIdSchema, SessionIdSchema } from "./ids.js";

export const HISTORY_EVENT_TYPES = [
  "user.message",
  "agent.message",
  "agent.handoff",
  "model.called",
  "tool.call",
  "tool.result",
  "approval.requested",
  "approval.decided",
  "sandbox.executed",
  "memory.read",
  "artifact.created",
  "flow.started",
  "flow.completed",
  "system.error",
] as const;
export const HistoryEventTypeSchema = z.enum(HISTORY_EVENT_TYPES);
export type HistoryEventType = z.infer<typeof HistoryEventTypeSchema>;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const ActorSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9:._-]*$/);
const TimestampSchema = z.string().datetime({ offset: false });

export const HistorySessionSchema = z.object({
  id: SessionIdSchema,
  createdAt: TimestampSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  nextSeq: z.number().int().nonnegative(),
  headHash: HashSchema.nullable(),
});
export type HistorySession = z.infer<typeof HistorySessionSchema>;

export const HistoryEventDraftSchema = z.object({
  id: EventIdSchema,
  recordedAt: TimestampSchema,
  eventType: HistoryEventTypeSchema,
  actor: ActorSchema,
  operationId: OperationIdSchema.nullable().default(null),
  parentEventId: EventIdSchema.nullable().default(null),
  payload: z.record(z.string(), z.unknown()),
});
export type HistoryEventDraft = z.infer<typeof HistoryEventDraftSchema>;

export const HistoryEventSchema = HistoryEventDraftSchema.extend({
  sessionId: SessionIdSchema,
  seq: z.number().int().nonnegative(),
  prevHash: HashSchema.nullable(),
  hash: HashSchema,
});
export type HistoryEvent = z.infer<typeof HistoryEventSchema>;

export const HistoryCreateSessionRequestSchema = z.object({
  sessionId: SessionIdSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  createdAt: TimestampSchema.optional(),
});
export type HistoryCreateSessionRequest = z.infer<typeof HistoryCreateSessionRequestSchema>;

export const HistoryAppendRequestSchema = z.object({
  expectedSeq: z.number().int().nonnegative(),
  event: HistoryEventDraftSchema,
});
export type HistoryAppendRequest = z.infer<typeof HistoryAppendRequestSchema>;

export const HistoryGrantSchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema,
  hostedEligible: z.boolean().default(false),
});
export type HistoryGrant = z.infer<typeof HistoryGrantSchema>;

export const HistoryRangeSchema = z.object({
  sessionId: SessionIdSchema,
  afterSeq: z.number().int().min(-1),
  throughSeq: z.number().int().min(-1),
  nextSeq: z.number().int().nonnegative(),
  events: z.array(HistoryEventSchema),
});
export type HistoryRange = z.infer<typeof HistoryRangeSchema>;
