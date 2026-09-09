/** Native multimodal contracts — Batch 5. Raw bytes remain Artifact-owned. */
import { z } from "zod";
import { ScopeSchema, SensitivitySchema, SyncClassSchema } from "./classification.js";
import {
  ArtifactIdSchema,
  AttachmentIdSchema,
  MultimodalDerivationIdSchema,
  OperationIdSchema,
  SessionIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { ArtifactPointerSchema, TimestampSchema } from "./memory.js";
import { AutonomyLevelSchema } from "./policy.js";

export const MEDIA_KINDS = ["image", "document", "audio", "video"] as const;
export const MediaKindSchema = z.enum(MEDIA_KINDS);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MULTIMODAL_TASKS = ["vision", "ocr", "transcribe", "tts"] as const;
export const MultimodalTaskSchema = z.enum(MULTIMODAL_TASKS);
export type MultimodalTask = z.infer<typeof MultimodalTaskSchema>;

export const MULTIMODAL_ROUTES = ["local-only", "local-first", "hosted-only"] as const;
export const MultimodalRouteSchema = z.enum(MULTIMODAL_ROUTES);
export type MultimodalRoute = z.infer<typeof MultimodalRouteSchema>;

export const MULTIMODAL_TARGETS = ["local", "hosted"] as const;
export const MultimodalTargetSchema = z.enum(MULTIMODAL_TARGETS);
export type MultimodalTarget = z.infer<typeof MultimodalTargetSchema>;

export const DETECTED_LANGUAGES = ["id", "en", "unknown"] as const;
export const DetectedLanguageSchema = z.enum(DETECTED_LANGUAGES);
export type DetectedLanguage = z.infer<typeof DetectedLanguageSchema>;

export const BoundingBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine((v) => v.x + v.width <= 1.000001 && v.y + v.height <= 1.000001, {
    message: "Bounding box harus berada di koordinat normalized 0..1.",
  });
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const OcrBlockSchema = z
  .object({
    page: z.number().int().positive(),
    text: z.string(),
    bbox: BoundingBoxSchema.nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  })
  .strict();
export type OcrBlock = z.infer<typeof OcrBlockSchema>;

export const TranscriptSegmentSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    text: z.string(),
    confidence: z.number().min(0).max(1).nullable().default(null),
  })
  .strict()
  .refine((v) => v.endMs >= v.startMs, { message: "endMs harus >= startMs." });
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const MultimodalSemanticResultSchema = z
  .object({
    text: z.string(),
    language: DetectedLanguageSchema,
    pageCount: z.number().int().positive().nullable().default(null),
    blocks: z.array(OcrBlockSchema).default([]),
    segments: z.array(TranscriptSegmentSchema).default([]),
  })
  .strict();
export type MultimodalSemanticResult = z.infer<typeof MultimodalSemanticResultSchema>;

export const ATTACHMENT_STATES = ["UPLOADED", "PROCESSING", "READY", "FAILED"] as const;
export const AttachmentLifecycleStateSchema = z.enum(ATTACHMENT_STATES);
export type AttachmentLifecycleState = z.infer<typeof AttachmentLifecycleStateSchema>;

export const MultimodalAttachmentSchema = z
  .object({
    id: AttachmentIdSchema,
    workspaceId: WorkspaceIdSchema,
    artifact: ArtifactPointerSchema,
    mediaKind: MediaKindSchema,
    state: AttachmentLifecycleStateSchema,
    latestDerivationId: MultimodalDerivationIdSchema.nullable(),
    error: z.string().max(2048).nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();
export type MultimodalAttachment = z.infer<typeof MultimodalAttachmentSchema>;

export const MultimodalDerivationSchema = z
  .object({
    id: MultimodalDerivationIdSchema,
    attachmentId: AttachmentIdSchema,
    artifactId: ArtifactIdSchema,
    operationId: OperationIdSchema,
    sessionId: SessionIdSchema.nullable(),
    task: MultimodalTaskSchema,
    result: MultimodalSemanticResultSchema,
    target: MultimodalTargetSchema,
    provider: z.string().min(1).max(64),
    model: z.string().min(1).max(128),
    scope: ScopeSchema,
    sensitivity: SensitivitySchema,
    syncClass: SyncClassSchema,
    createdAt: TimestampSchema,
  })
  .strict();
export type MultimodalDerivation = z.infer<typeof MultimodalDerivationSchema>;

export const MultimodalIngestRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema.default("ws_personal"),
    sessionId: SessionIdSchema.optional(),
    contentBase64: z.string().min(1),
    mimeType: z.string().min(1).max(128),
    description: z.string().min(1).max(200),
    scope: ScopeSchema.default("personal"),
    sensitivity: SensitivitySchema.default("INTERNAL"),
    syncClass: SyncClassSchema.default("LOCAL_ONLY"),
    task: MultimodalTaskSchema.exclude(["tts"]).optional(),
    route: MultimodalRouteSchema.default("local-only"),
    autonomy: AutonomyLevelSchema.default("L1"),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();
export type MultimodalIngestRequest = z.infer<typeof MultimodalIngestRequestSchema>;

export const MultimodalProcessExistingRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema.default("ws_personal"),
    sessionId: SessionIdSchema.optional(),
    task: MultimodalTaskSchema.exclude(["tts"]),
    route: MultimodalRouteSchema.default("local-only"),
    scope: ScopeSchema.default("personal"),
    sensitivity: SensitivitySchema.default("INTERNAL"),
    autonomy: AutonomyLevelSchema.default("L1"),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();
export type MultimodalProcessExistingRequest = z.infer<
  typeof MultimodalProcessExistingRequestSchema
>;

export const SpeechSynthesisRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema.default("ws_personal"),
    sessionId: SessionIdSchema.optional(),
    text: z.string().min(1).max(4096),
    language: DetectedLanguageSchema.default("unknown"),
    route: MultimodalRouteSchema.default("local-only"),
    voice: z.string().min(1).max(64).default("alloy"),
    format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm"]).default("mp3"),
    scope: ScopeSchema.default("personal"),
    sensitivity: SensitivitySchema.default("INTERNAL"),
    syncClass: SyncClassSchema.default("LOCAL_ONLY"),
    autonomy: AutonomyLevelSchema.default("L1"),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();
export type SpeechSynthesisRequest = z.infer<typeof SpeechSynthesisRequestSchema>;

export const ConnectMultimodalProcessRequestSchema = z
  .object({
    artifact: ArtifactPointerSchema,
    task: MultimodalTaskSchema.exclude(["tts"]),
    target: MultimodalTargetSchema,
    scope: ScopeSchema,
    sensitivity: SensitivitySchema,
    operationId: OperationIdSchema,
    now: TimestampSchema,
  })
  .strict();
export type ConnectMultimodalProcessRequest = z.infer<typeof ConnectMultimodalProcessRequestSchema>;

export const ConnectMultimodalProcessResponseSchema = z
  .object({
    result: MultimodalSemanticResultSchema,
    target: MultimodalTargetSchema,
    provider: z.string().min(1),
    model: z.string().min(1),
    spendReservationId: z.string().nullable().default(null),
    reservedUsd: z.number().nonnegative().nullable().default(null),
    spendStatus: z.enum(["none", "uncertain"]).default("none"),
  })
  .strict();
export type ConnectMultimodalProcessResponse = z.infer<
  typeof ConnectMultimodalProcessResponseSchema
>;

export const ConnectSpeechRequestSchema = SpeechSynthesisRequestSchema.pick({
  text: true,
  language: true,
  voice: true,
  format: true,
  scope: true,
  sensitivity: true,
  syncClass: true,
}).extend({
  target: MultimodalTargetSchema,
  operationId: OperationIdSchema,
  now: TimestampSchema,
});
export type ConnectSpeechRequest = z.infer<typeof ConnectSpeechRequestSchema>;

export const ConnectSpeechResponseSchema = z
  .object({
    artifact: ArtifactPointerSchema,
    target: MultimodalTargetSchema,
    provider: z.string().min(1),
    model: z.string().min(1),
    spendReservationId: z.string().nullable().default(null),
    reservedUsd: z.number().nonnegative().nullable().default(null),
    spendStatus: z.enum(["none", "uncertain"]).default("none"),
  })
  .strict();
export type ConnectSpeechResponse = z.infer<typeof ConnectSpeechResponseSchema>;

export const MultimodalIngestResponseSchema = z
  .object({
    operationId: OperationIdSchema,
    attachment: MultimodalAttachmentSchema,
    derivation: MultimodalDerivationSchema,
    deduplicated: z.boolean(),
  })
  .strict();
export type MultimodalIngestResponse = z.infer<typeof MultimodalIngestResponseSchema>;

export const SpeechSynthesisResponseSchema = z
  .object({
    operationId: OperationIdSchema,
    artifact: ArtifactPointerSchema,
    target: MultimodalTargetSchema,
    provider: z.string(),
    model: z.string(),
    deduplicated: z.boolean(),
  })
  .strict();
export type SpeechSynthesisResponse = z.infer<typeof SpeechSynthesisResponseSchema>;

export function mediaKindFromMimeType(mimeType: string): MediaKind | null {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized === "application/pdf" || normalized.startsWith("text/")) return "document";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  return null;
}

export function defaultTaskForMediaKind(kind: MediaKind): Exclude<MultimodalTask, "tts"> {
  if (kind === "image") return "vision";
  if (kind === "document") return "ocr";
  return "transcribe";
}
