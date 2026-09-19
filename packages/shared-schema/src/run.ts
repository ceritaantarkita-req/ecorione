import { z } from "zod";
import {
  OperationIdSchema,
  ProjectIdSchema,
  TriggerIdSchema,
  WorkflowIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { TimestampSchema } from "./memory.js";
import { AuditEventSchema } from "./policy.js";
import { FlowGraphIdSchema } from "./nodes.js";

export const RUN_STATUSES = [
  "RUNNING",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TERMINATED",
  "TIMED_OUT",
  "UNKNOWN",
] as const;
export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunOwnerAvailabilitySchema = z
  .object({
    temporal: z.boolean(),
    rnd: z.boolean(),
    hubAudit: z.boolean(),
    trigger: z.boolean(),
  })
  .strict();
export type RunOwnerAvailability = z.infer<typeof RunOwnerAvailabilitySchema>;

export const RunCostSchema = z
  .object({
    callCount: z.number().int().nonnegative(),
    totalActualUsd: z.number().finite(),
    totalNaiveUsd: z.number().finite(),
    totalSavedUsd: z.number().finite(),
  })
  .strict();
export type RunCost = z.infer<typeof RunCostSchema>;

export const RunApprovalViewSchema = z
  .object({
    operationId: OperationIdSchema,
    status: z.enum(["PENDING", "APPROVE", "EDIT", "REJECT", "RESPOND", "UNKNOWN"]),
    prompt: z.string().nullable(),
    note: z.string().nullable(),
    requestedAt: TimestampSchema.nullable(),
    decidedAt: TimestampSchema.nullable(),
  })
  .strict();
export type RunApprovalView = z.infer<typeof RunApprovalViewSchema>;

export const RunProjectionSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    triggerId: TriggerIdSchema.nullable(),
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1),
    temporalWorkflowId: WorkflowIdSchema,
    startedAt: TimestampSchema,
    finishedAt: TimestampSchema.nullable(),
    status: RunStatusSchema,
    cost: RunCostSchema.nullable(),
    approvals: z.array(RunApprovalViewSchema),
    actions: z.array(AuditEventSchema),
    output: z.unknown().nullable(),
    errors: z.array(z.string().max(2000)),
    availability: RunOwnerAvailabilitySchema,
  })
  .strict();
export type RunProjection = z.infer<typeof RunProjectionSchema>;

export const RunListItemSchema = RunProjectionSchema.pick({
  operationId: true,
  workspaceId: true,
  projectId: true,
  triggerId: true,
  graphId: true,
  graphVersion: true,
  temporalWorkflowId: true,
  startedAt: true,
  finishedAt: true,
  status: true,
  cost: true,
  availability: true,
});
export type RunListItem = z.infer<typeof RunListItemSchema>;

export const RunListResponseSchema = z
  .object({
    runs: z.array(RunListItemSchema),
  })
  .strict();
export type RunListResponse = z.infer<typeof RunListResponseSchema>;
