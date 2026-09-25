import { z } from "zod";
import { ProjectIdSchema, WorkspaceIdSchema } from "./ids.js";
import { FlowGraphIdSchema } from "./nodes.js";
import { TimeTriggerConfigurationSchema } from "./trigger.js";

export const ScheduleAssistAutonomySchema = z.enum(["L0", "L1", "L2", "L3"]);

export const ScheduleAssistCurrentDraftSchema = z
  .object({
    name: z.string().max(160),
    graphId: FlowGraphIdSchema.nullable(),
    graphVersion: z.number().int().min(1),
    requestedAutonomy: ScheduleAssistAutonomySchema,
    enabled: z.boolean(),
    configuration: TimeTriggerConfigurationSchema,
  })
  .strict();
export type ScheduleAssistCurrentDraft = z.infer<typeof ScheduleAssistCurrentDraftSchema>;

export const ScheduleAssistRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    intent: z.string().trim().min(3).max(2000),
    current: ScheduleAssistCurrentDraftSchema.nullable().default(null),
  })
  .strict();
export type ScheduleAssistRequest = z.infer<typeof ScheduleAssistRequestSchema>;

export const ScheduleAssistDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1),
    requestedAutonomy: ScheduleAssistAutonomySchema,
    enabled: z.boolean(),
    configuration: TimeTriggerConfigurationSchema,
  })
  .strict();
export type ScheduleAssistDraft = z.infer<typeof ScheduleAssistDraftSchema>;

export const ScheduleAssistResponseSchema = z
  .object({
    draft: ScheduleAssistDraftSchema,
    summary: z.string().trim().min(1).max(512),
    source: z.literal("local-model"),
  })
  .strict();
export type ScheduleAssistResponse = z.infer<typeof ScheduleAssistResponseSchema>;
