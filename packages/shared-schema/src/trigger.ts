import { z } from "zod";
import { FlowGraphIdSchema } from "./nodes.js";
import {
  EventIdSchema,
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

export const PE05_TRIGGER_KINDS = ["manual", "time", "event", "webhook"] as const;
export const Pe05TriggerKindSchema = z.enum(PE05_TRIGGER_KINDS);
export type Pe05TriggerKind = z.infer<typeof Pe05TriggerKindSchema>;

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

const EventSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
const EventKindSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const EventTriggerConfigurationSchema = z
  .object({
    source: EventSourceSchema,
    eventKind: EventKindSchema,
  })
  .strict();
export type EventTriggerConfiguration = z.infer<typeof EventTriggerConfigurationSchema>;

export const WebhookTriggerConfigurationSchema = z
  .object({
    adapter: z.literal("generic"),
    hookId: z
      .string()
      .trim()
      .min(16)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    source: EventSourceSchema,
    eventKind: EventKindSchema,
  })
  .strict();
export type WebhookTriggerConfiguration = z.infer<typeof WebhookTriggerConfigurationSchema>;

export const TriggerConfigurationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual"), configuration: ManualTriggerConfigurationSchema }),
  z.object({ kind: z.literal("time"), configuration: TimeTriggerConfigurationSchema }),
  z.object({ kind: z.literal("event"), configuration: EventTriggerConfigurationSchema }),
  z.object({ kind: z.literal("webhook"), configuration: WebhookTriggerConfigurationSchema }),
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
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("event"),
      configuration: EventTriggerConfigurationSchema,
    })
    .strict(),
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("webhook"),
      configuration: WebhookTriggerConfigurationSchema,
    })
    .strict(),
]);
export type TriggerCreateRequest = z.infer<typeof TriggerCreateRequestSchema>;

export const TriggerDefinitionSchema = z
  .object({
    id: TriggerIdSchema,
    ...TriggerBaseFields,
    kind: Pe05TriggerKindSchema,
    configuration: z.union([
      ManualTriggerConfigurationSchema,
      TimeTriggerConfigurationSchema,
      EventTriggerConfigurationSchema,
      WebhookTriggerConfigurationSchema,
    ]),
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
    } else if (value.kind === "time") {
      const parsed = TimeTriggerConfigurationSchema.safeParse(value.configuration);
      if (!parsed.success || value.temporalScheduleId === null) {
        ctx.addIssue({
          code: "custom",
          path: ["configuration"],
          message: "Time Trigger wajib memiliki konfigurasi dan Temporal schedule ID.",
        });
      }
    } else {
      const parsed =
        value.kind === "event"
          ? EventTriggerConfigurationSchema.safeParse(value.configuration)
          : WebhookTriggerConfigurationSchema.safeParse(value.configuration);
      if (!parsed.success || value.temporalScheduleId !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["configuration"],
          message: "Event/Webhook Trigger tidak boleh memiliki Temporal schedule.",
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
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("event"),
      configuration: EventTriggerConfigurationSchema,
      expectedRevision: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      ...TriggerBaseFields,
      kind: z.literal("webhook"),
      configuration: WebhookTriggerConfigurationSchema,
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


const MAX_TRIGGER_EVENT_PAYLOAD_BYTES = 64 * 1024;
const MAX_TRIGGER_EVENT_METADATA_BYTES = 16 * 1024;

function jsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

const TriggerEventMetadataValueSchema = z.union([
  z.string().max(4096),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const NormalizedTriggerEventSchema = z
  .object({
    eventId: EventIdSchema,
    source: EventSourceSchema,
    kind: EventKindSchema,
    occurredAt: TimestampSchema,
    receivedAt: TimestampSchema,
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    dedupeKey: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9._:@/-]+$/),
    payload: z.unknown(),
    metadata: z.record(z.string().min(1).max(128), TriggerEventMetadataValueSchema).default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (jsonBytes(value.payload) > MAX_TRIGGER_EVENT_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["payload"],
        message: "payload event melebihi batas 64 KiB.",
      });
    }
    if (jsonBytes(value.metadata) > MAX_TRIGGER_EVENT_METADATA_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["metadata"],
        message: "metadata event melebihi batas 16 KiB.",
      });
    }
  });
export type NormalizedTriggerEvent = z.infer<typeof NormalizedTriggerEventSchema>;

export const TriggerEventDispatchRequestSchema = z
  .object({
    event: NormalizedTriggerEventSchema,
  })
  .strict();
export type TriggerEventDispatchRequest = z.infer<typeof TriggerEventDispatchRequestSchema>;


export const WebhookIngressDeliverySchema = z
  .object({
    deliveryId: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9._:@/-]+$/),
    occurredAt: TimestampSchema.optional(),
    payload: z.unknown(),
    metadata: z.record(z.string().min(1).max(128), TriggerEventMetadataValueSchema).default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (jsonBytes(value.payload) > MAX_TRIGGER_EVENT_PAYLOAD_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["payload"],
        message: "payload webhook melebihi batas 64 KiB.",
      });
    }
    if (jsonBytes(value.metadata) > MAX_TRIGGER_EVENT_METADATA_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["metadata"],
        message: "metadata webhook melebihi batas 16 KiB.",
      });
    }
  });
export type WebhookIngressDelivery = z.infer<typeof WebhookIngressDeliverySchema>;
