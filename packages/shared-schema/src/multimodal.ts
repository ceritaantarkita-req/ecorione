/** Native multimodal contracts (Batch 5). Raw media stays in Artifact; derived semantics belong to Context. */
import { z } from "zod";
import {
  ScopeSchema,
  SensitivitySchema,
  SyncClassSchema,
  TrustSchema,
} from "./classification.js";
import {
  ArtifactIdSchema,
  EpisodeIdSchema,
  EventIdSchema,
  OperationIdSchema,
  SessionIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { ArtifactPointerSchema } from "./memory.js";

export const MULTIMODAL_ANALYZE_TASKS = ["ocr", "vision", "transcribe"] as const;
export const MultimodalAnalyzeTaskSchema = z.enum(MULTIMODAL_ANALYZE_TASKS);
export type MultimodalAnalyzeTask = z.infer<typeof MultimodalAnalyzeTaskSchema>;

export const MULTIMODAL_LANGUAGES = ["id", "en", "mixed", "unknown"] as const;
export const MultimodalLanguageSchema = z.enum(MULTIMODAL_LANGUAGES);
export type MultimodalLanguage = z.infer<typeof MultimodalLanguageSchema>;

export const MultimodalRouteRequestSchema = z.object({
  preferred: z.enum(["local", "hosted"]).default("local"),
  /** Never inferred. Hosted fallback exists only when the caller explicitly opts in. */
  allowHostedFallback: z.boolean().default(false),
});
export type MultimodalRouteRequest = z.infer<typeof MultimodalRouteRequestSchema>;

export const NormalizedBoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
export type NormalizedBoundingBox = z.infer<typeof NormalizedBoundingBoxSchema>;

export const MultimodalSegmentSchema = z
  .object({
    text: z.string().min(1),
    page: z.number().int().min(1).optional(),
    boundingBox: NormalizedBoundingBoxSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    startMs: z.number().int().nonnegative().optional(),
    endMs: z.number().int().nonnegative().optional(),
    language: MultimodalLanguageSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.startMs !== undefined &&
      value.endMs !== undefined &&
      value.endMs < value.startMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endMs tidak boleh sebelum startMs.",
      });
    }
  });
export type MultimodalSegment = z.infer<typeof MultimodalSegmentSchema>;

const MultimodalRequestBaseSchema = z.object({
  operationId: OperationIdSchema,
  sessionId: SessionIdSchema,
  workspaceId: WorkspaceIdSchema.optional(),
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema,
  route: MultimodalRouteRequestSchema.default({
    preferred: "local",
    allowHostedFallback: false,
  }),
});

export const MultimodalAnalyzeRequestSchema = MultimodalRequestBaseSchema.extend({
  artifactId: ArtifactIdSchema,
  task: MultimodalAnalyzeTaskSchema,
});
export type MultimodalAnalyzeRequest = z.infer<typeof MultimodalAnalyzeRequestSchema>;

export const MultimodalSynthesizeRequestSchema = MultimodalRequestBaseSchema.omit({
  maxSensitivity: true,
}).extend({
  text: z.string().min(1).max(32_000),
  language: z.enum(["id", "en"]),
  voice: z.string().min(1).max(128).optional(),
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  description: z.string().min(1).max(200).default("Generated speech"),
});
export type MultimodalSynthesizeRequest = z.infer<typeof MultimodalSynthesizeRequestSchema>;

export const MultimodalAdapterResultSchema = z.object({
  routeUsed: z.enum(["local", "hosted"]),
  adapter: z.string().min(1).max(128),
  provider: z.string().min(1).max(128),
  model: z.string().min(1).max(256),
  language: MultimodalLanguageSchema,
  text: z.string(),
  segments: z.array(MultimodalSegmentSchema).default([]),
  audioBase64: z.string().min(1).optional(),
  audioMimeType: z.string().min(1).max(128).optional(),
  actualUsd: z.number().nonnegative().default(0),
  naiveUsd: z.number().nonnegative().default(0),
});
export type MultimodalAdapterResult = z.infer<typeof MultimodalAdapterResultSchema>;

export const MultimodalDerivationWriteSchema = z.object({
  operationId: OperationIdSchema,
  sourceArtifactId: ArtifactIdSchema,
  episodeId: EpisodeIdSchema,
  task: MultimodalAnalyzeTaskSchema,
  result: MultimodalAdapterResultSchema.omit({ audioBase64: true, audioMimeType: true }),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema,
  trust: TrustSchema,
  createdAt: z.string().datetime({ offset: false }),
});
export type MultimodalDerivationWrite = z.infer<typeof MultimodalDerivationWriteSchema>;
export const MultimodalDerivationSchema = MultimodalDerivationWriteSchema;
export type MultimodalDerivation = z.infer<typeof MultimodalDerivationSchema>;

export const MultimodalAnalyzeResponseSchema = z.object({
  operationId: OperationIdSchema,
  sessionId: SessionIdSchema,
  sourceArtifactId: ArtifactIdSchema,
  task: MultimodalAnalyzeTaskSchema,
  state: z.literal("READY"),
  result: MultimodalAdapterResultSchema.omit({ audioBase64: true, audioMimeType: true }),
  contextEpisodeId: EpisodeIdSchema,
  historyEventId: EventIdSchema,
});
export type MultimodalAnalyzeResponse = z.infer<typeof MultimodalAnalyzeResponseSchema>;

export const MultimodalSynthesizeResponseSchema = z.object({
  operationId: OperationIdSchema,
  sessionId: SessionIdSchema,
  state: z.literal("READY"),
  result: MultimodalAdapterResultSchema.omit({ audioBase64: true, audioMimeType: true }),
  outputArtifact: ArtifactPointerSchema,
  historyEventId: EventIdSchema,
});
export type MultimodalSynthesizeResponse = z.infer<typeof MultimodalSynthesizeResponseSchema>;

export const MultimodalLifecycleStateSchema = z.enum([
  "RECEIVED",
  "PROCESSING",
  "READY",
  "FAILED",
]);
export const MultimodalRunStatusSchema = z.object({
  operationId: OperationIdSchema,
  sessionId: SessionIdSchema,
  task: z.enum(["ocr", "vision", "transcribe", "synthesize"]),
  sourceArtifactId: ArtifactIdSchema.nullable(),
  outputArtifactId: ArtifactIdSchema.nullable(),
  state: MultimodalLifecycleStateSchema,
  routeUsed: z.enum(["local", "hosted"]).nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime({ offset: false }),
  updatedAt: z.string().datetime({ offset: false }),
});
export type MultimodalRunStatus = z.infer<typeof MultimodalRunStatusSchema>;

/** Connect-only normalized inference boundary. Hub obtains bytes from Artifact after policy gates. */
export const MultimodalInferRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    task: z.enum(["ocr", "vision", "transcribe", "synthesize"]),
    route: MultimodalRouteRequestSchema,
    syncClass: SyncClassSchema,
    mimeType: z.string().min(1).max(128).optional(),
    contentBase64: z.string().min(1).optional(),
    text: z.string().min(1).max(32_000).optional(),
    language: z.enum(["id", "en"]).optional(),
    voice: z.string().min(1).max(128).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.task === "synthesize") {
      if (value.text === undefined || value.language === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TTS membutuhkan text + language.",
        });
      }
      return;
    }
    if (value.contentBase64 === undefined || value.mimeType === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Analisis media membutuhkan contentBase64 + mimeType.",
      });
    }
  });
export type MultimodalInferRequest = z.infer<typeof MultimodalInferRequestSchema>;
