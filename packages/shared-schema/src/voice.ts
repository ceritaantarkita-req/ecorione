/** Realtime voice session contracts (Batch 6). Raw live audio is transient transport data. */
import { z } from "zod";
import { ScopeSchema, SensitivitySchema, SyncClassSchema } from "./classification.js";
import { OperationIdSchema, SessionIdSchema, WorkspaceIdSchema } from "./ids.js";
import { TimestampSchema } from "./memory.js";
import { MultimodalLanguageSchema, MultimodalRouteRequestSchema } from "./multimodal.js";

export const VOICE_SESSION_STATES = [
  "LISTENING",
  "THINKING",
  "SPEAKING",
  "INTERRUPTED",
  "CLOSED",
  "FAILED",
] as const;
export const VoiceSessionStateSchema = z.enum(VOICE_SESSION_STATES);
export type VoiceSessionState = z.infer<typeof VoiceSessionStateSchema>;

export const VoiceLanguageModeSchema = z.enum(["auto", "id", "en"]);
export type VoiceLanguageMode = z.infer<typeof VoiceLanguageModeSchema>;

export const VoiceVadConfigSchema = z
  .object({
    threshold: z.number().min(0.001).max(1).default(0.02),
    silenceMs: z.number().int().min(200).max(5_000).default(700),
    chunkMs: z.number().int().min(200).max(3_000).default(800),
  })
  .strict();
export type VoiceVadConfig = z.infer<typeof VoiceVadConfigSchema>;

export const VoiceSessionCreateRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    sessionId: SessionIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    scope: ScopeSchema.default("personal"),
    maxSensitivity: SensitivitySchema.default("INTERNAL"),
    syncClass: SyncClassSchema.default("CLOUD_ALLOWED"),
    route: MultimodalRouteRequestSchema.default({
      preferred: "local",
      allowHostedFallback: false,
    }),
    languageMode: VoiceLanguageModeSchema.default("auto"),
    voice: z.string().min(1).max(128).optional(),
    vad: VoiceVadConfigSchema.default({ threshold: 0.02, silenceMs: 700, chunkMs: 800 }),
  })
  .strict();
export type VoiceSessionCreateRequest = z.infer<typeof VoiceSessionCreateRequestSchema>;

export const VoiceAudioChunkRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    sessionId: SessionIdSchema,
    clientSequence: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(128).refine((value) => value.startsWith("audio/"), {
      message: "Realtime voice hanya menerima MIME audio/*.",
    }),
    contentBase64: z.string().min(1).max(8 * 1024 * 1024),
    speech: z.boolean(),
    endOfUtterance: z.boolean().default(false),
    rms: z.number().min(0).max(1).optional(),
  })
  .strict();
export type VoiceAudioChunkRequest = z.infer<typeof VoiceAudioChunkRequestSchema>;

export const VoiceInterruptRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    sessionId: SessionIdSchema,
    reason: z.string().min(1).max(256).default("user-barge-in"),
  })
  .strict();
export type VoiceInterruptRequest = z.infer<typeof VoiceInterruptRequestSchema>;

export const VoiceCloseRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    sessionId: SessionIdSchema,
    reason: z.string().min(1).max(256).default("user-close"),
  })
  .strict();
export type VoiceCloseRequest = z.infer<typeof VoiceCloseRequestSchema>;

export const VoiceSessionSnapshotSchema = z
  .object({
    sessionId: SessionIdSchema,
    workspaceId: WorkspaceIdSchema,
    state: VoiceSessionStateSchema,
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema,
    syncClass: SyncClassSchema,
    route: MultimodalRouteRequestSchema,
    languageMode: VoiceLanguageModeSchema,
    activeLanguage: z.enum(["id", "en"]),
    voice: z.string().min(1).max(128).nullable(),
    vad: VoiceVadConfigSchema,
    lastClientSequence: z.number().int().min(-1),
    nextEventSequence: z.number().int().nonnegative(),
    generation: z.number().int().nonnegative(),
    bargeInCount: z.number().int().nonnegative(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    error: z.string().nullable(),
  })
  .strict();
export type VoiceSessionSnapshot = z.infer<typeof VoiceSessionSnapshotSchema>;

export const VOICE_EVENT_TYPES = [
  "session.started",
  "session.state",
  "speech.started",
  "language.changed",
  "transcript.partial",
  "transcript.final",
  "assistant.delta",
  "assistant.audio",
  "assistant.done",
  "assistant.interrupted",
  "latency",
  "session.closed",
  "error",
] as const;
export const VoiceEventTypeSchema = z.enum(VOICE_EVENT_TYPES);
export type VoiceEventType = z.infer<typeof VoiceEventTypeSchema>;

export const VoiceEventSchema = z
  .object({
    sessionId: SessionIdSchema,
    sequence: z.number().int().nonnegative(),
    generation: z.number().int().nonnegative(),
    type: VoiceEventTypeSchema,
    at: TimestampSchema,
    data: z.record(z.string(), z.unknown()),
  })
  .strict();
export type VoiceEvent = z.infer<typeof VoiceEventSchema>;

export const VoiceChunkAckSchema = z
  .object({
    sessionId: SessionIdSchema,
    clientSequence: z.number().int().nonnegative(),
    state: VoiceSessionStateSchema,
    generation: z.number().int().nonnegative(),
    replayed: z.boolean(),
  })
  .strict();
export type VoiceChunkAck = z.infer<typeof VoiceChunkAckSchema>;

export const VoiceEventsQuerySchema = z.object({
  sessionId: SessionIdSchema,
  after: z.coerce.number().int().min(-1).default(-1),
});
export type VoiceEventsQuery = z.infer<typeof VoiceEventsQuerySchema>;

export const VoiceEventBatchSchema = z
  .object({
    session: VoiceSessionSnapshotSchema,
    events: z.array(VoiceEventSchema),
  })
  .strict();
export type VoiceEventBatch = z.infer<typeof VoiceEventBatchSchema>;

export const VoiceLatencySchema = z
  .object({
    sttMs: z.number().nonnegative(),
    modelMs: z.number().nonnegative(),
    ttsFirstChunkMs: z.number().nonnegative().nullable(),
    endToEndMs: z.number().nonnegative(),
    bargeInCount: z.number().int().nonnegative(),
  })
  .strict();
export type VoiceLatency = z.infer<typeof VoiceLatencySchema>;

export function voiceLanguageFromDetected(
  mode: VoiceLanguageMode,
  detected: z.infer<typeof MultimodalLanguageSchema>,
  current: "id" | "en",
): "id" | "en" {
  if (mode === "id" || mode === "en") return mode;
  return detected === "id" || detected === "en" ? detected : current;
}
