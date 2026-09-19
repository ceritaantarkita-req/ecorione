import { z } from "zod";
import { FlowGraphIdSchema } from "./nodes.js";
import {
  OperationIdSchema,
  ProjectIdSchema,
  TriggerIdSchema,
  WorkflowIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { AutonomyLevelSchema } from "./policy.js";
import { TimestampSchema } from "./memory.js";

export const TRIGGER_KINDS = ["manual", "time", "event", "webhook", "condition"] as const;
export const TriggerKindSchema = z.enum(TRIGGER_KINDS);
export type TriggerKind = z.infer<typeof TriggerKindSchema>;

export const PE03_TRIGGER_KINDS = ["manual", "time"] as const;
export const Pe03TriggerKindSchema = z.enum(PE03_TRIGGER_KINDS);
export type Pe03TriggerKind = z.infer<typeof Pe03TriggerKindSchema>;

export const TriggerVersionPolicySchema = z.literal("PINNED");
export type TriggerVersionPolicy = z.infer<typeof TriggerVersionPolicySchema>;

export const TriggerOverlapPolicySchema = z.enum(["SKIP", "QUEUE_ONE"]);
export type TriggerOverlapPolicy = z.infer<typeof TriggerOverlapPolicySchema>;

const MAX_CATCHUP_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_TRIGGER_CATCHUP_MS = 60_000;
export const MAX_TRIGGER_CATCHUP_MS = MAX_CATCHUP_MS;

export const IanaTimezoneSchema = z
  .string()
  .min(1)
  .max(128)
  .superRefine((value, ctx) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "timezone harus nama IANA yang valid.",
      });
    }
  });

const CronExpressionSchema = z
  .string()
  .trim()
  .min(9)
  .max(256)
  .refine((value) => value.split(/\s+/).length >= 5, {
    message: "cronExpression harus memiliki minimal lima field.",
  });

export const TimeTriggerConfigurationSchema = z
  .object({
    cronExpression: CronExpressionSchema,
    timezone: IanaTimezoneSchema,
    catchupWindowMs: z
      .number()
      .int()
      .min(60_000)
      .max(MAX_CATCHUP_MS)
      .default(DEFAULT_TRIGGER_CATCHUP_MS),
    overlap: TriggerOverlapPolicySchema.default("SKIP"),
  })
  .strict();
export type TimeTriggerConfiguration = z.infer<typeof TimeTriggerConfigurationSchema>;

export const ManualTriggerConfigurationSchema = z.object({}).strict();

export const TriggerConfigurationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual"), configuration: ManualTriggerConfigurationSchema }),
  z.object({ kind: z.literal("time"), configuration: TimeTriggerConfigurationSchema }),
]);
export type TriggerConfiguration = z.infer<typeof TriggerConfigurationSchema>;

const TriggerBaseFields = {
  workspaceId: WorkspaceIdSchema,
  projectId: ProjectIdSchema,
  name: z.string().trim().min(1).max(160),
  graphId: FlowGraphIdSchema,
  graphVersion: z.number().int().min(1),
  versionPolicy: TriggerVersionPolicySchema.default("PINNED"),
  requestedAutonomy: AutonomyLevelSchema.refine((value) => value !== "L4", {
    message: "Trigger V1 tidak boleh meminta autonomy L4.",
  }),
  enabled: z.boolean().default(true),
} as const;

export const TriggerCreateRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("manual"),
      configuration: ManualTriggerConfigurationSchema.default({}),
    })
    .strict(),
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("time"),
      configuration: TimeTriggerConfigurationSchema,
    })
    .strict(),
]);
export type TriggerCreateRequest = z.infer<typeof TriggerCreateRequestSchema>;

export const TriggerDefinitionSchema = z
  .object({
    id: TriggerIdSchema,
    ...TriggerBaseFields,
    kind: Pe03TriggerKindSchema,
    configuration: z.union([ManualTriggerConfigurationSchema, TimeTriggerConfigurationSchema]),
    temporalScheduleId: z.string().min(1).max(256).nullable(),
    revision: z.number().int().min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "manual") {
      const parsed = ManualTriggerConfigurationSchema.safeParse(value.configuration);
      if (!parsed.success || value.temporalScheduleId !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["configuration"],
          message: "Manual Trigger tidak boleh memiliki Temporal schedule.",
        });
      }
    } else {
      const parsed = TimeTriggerConfigurationSchema.safeParse(value.configuration);
      if (!parsed.success || value.temporalScheduleId === null) {
        ctx.addIssue({
          code: "custom",
          path: ["configuration"],
          message: "Time Trigger wajib memiliki konfigurasi dan Temporal schedule ID.",
        });
      }
    }
  });
export type TriggerDefinition = z.infer<typeof TriggerDefinitionSchema>;

export const TriggerUpdateRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("manual"),
      configuration: ManualTriggerConfigurationSchema.default({}),
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("time"),
      configuration: TimeTriggerConfigurationSchema,
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
]);
export type TriggerUpdateRequest = z.infer<typeof TriggerUpdateRequestSchema>;

export const TriggerStateChangeRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    expectedRevision: z.number().int().min(1),
  })
  .strict();

export const TriggerFireRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    requestId: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
    input: z.unknown().default(null),
  })
  .strict();
export type TriggerFireRequest = z.infer<typeof TriggerFireRequestSchema>;

export const TriggerFireResponseSchema = z
  .object({
    triggerId: TriggerIdSchema,
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1),
    workflowId: WorkflowIdSchema,
    operationId: OperationIdSchema,
    deduplicated: z.boolean(),
  })
  .strict();
export type TriggerFireResponse = z.infer<typeof TriggerFireResponseSchema>;


export const TriggerScheduleRuntimeSchema = z
  .object({
    triggerId: TriggerIdSchema,
    scheduleId: z.string().min(1).max(256),
    paused: z.boolean(),
    nextActionTimes: z.array(TimestampSchema).max(20),
    recentActionCount: z.number().int().nonnegative(),
  })
  .strict();
export type TriggerScheduleRuntime = z.infer<typeof TriggerScheduleRuntimeSchema>;
