import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import { AttachmentIdSchema, WorkspaceIdSchema } from "./ids.js";
import { TimestampSchema } from "./memory.js";
import {
  MediaKindSchema,
  MultimodalDerivationSchema,
  MultimodalTargetSchema,
  MultimodalTaskSchema,
  DetectedLanguageSchema,
} from "./multimodal.js";
import { ArtifactPointerSchema } from "./memory.js";

export const ContextCreateAttachmentRequestSchema = z
  .object({
    id: AttachmentIdSchema,
    workspaceId: WorkspaceIdSchema,
    artifact: ArtifactPointerSchema,
    mediaKind: MediaKindSchema,
    now: TimestampSchema,
  })
  .strict();
export type ContextCreateAttachmentRequest = z.infer<typeof ContextCreateAttachmentRequestSchema>;

export const ContextAttachmentStateRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    now: TimestampSchema,
    error: z.string().max(2048).optional(),
  })
  .strict();
export type ContextAttachmentStateRequest = z.infer<typeof ContextAttachmentStateRequestSchema>;

export const ContextMultimodalContextRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    attachmentIds: z.array(AttachmentIdSchema).max(8),
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema,
    hostedEligible: z.boolean().default(false),
  })
  .strict();
export type ContextMultimodalContextRequest = z.infer<
  typeof ContextMultimodalContextRequestSchema
>;

export const MultimodalContextItemSchema = z
  .object({
    attachmentId: AttachmentIdSchema,
    derivationId: MultimodalDerivationSchema.shape.id,
    task: MultimodalTaskSchema,
    text: z.string(),
    language: DetectedLanguageSchema,
    target: MultimodalTargetSchema,
    provider: z.string().min(1),
    model: z.string().min(1),
  })
  .strict();
export type MultimodalContextItem = z.infer<typeof MultimodalContextItemSchema>;

export const ContextMultimodalContextResponseSchema = z
  .object({ items: z.array(MultimodalContextItemSchema) })
  .strict();
export type ContextMultimodalContextResponse = z.infer<
  typeof ContextMultimodalContextResponseSchema
>;

export const ContextDerivationRequestSchema = MultimodalDerivationSchema;
