/**
 * Kontrak HTTP `POST /v1/chat` — jalur inti Fase 1 (`prd.md` §23): Ai memanggil Hub, Hub
 * mengorkestrasi Context + Connect. Didefinisikan sekali di sini supaya `apps/ai` dan
 * `services/hub` tidak bisa diam-diam menyimpang bentuk request/respons-nya.
 */

import { z } from "zod";
import { MemoryFactIdSchema, OperationIdSchema, SessionIdSchema } from "./ids.js";
import { AutonomyLevelSchema } from "./policy.js";
import { ScopeSchema, SensitivitySchema } from "./classification.js";

export const ChatRequestSchema = z.object({
  sessionId: SessionIdSchema,
  message: z.string().min(1).max(16_000),
  scope: ScopeSchema.default("personal"),
  /** Plafon sensitivitas fakta yang boleh ikut ditarik ke konteks giliran ini. */
  maxSensitivity: SensitivitySchema.default("INTERNAL"),
  /** Chat adalah aksi `READ` — level ini disiapkan untuk giliran yang nanti memicu tool. */
  autonomy: AutonomyLevelSchema.default("L1"),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const MemoryUsedFactSchema = z.object({
  id: MemoryFactIdSchema,
  text: z.string(),
  score: z.number(),
});

export const MemoryUsedEpisodeSchema = z.object({
  id: z.string(),
  text: z.string(),
});

/**
 * Panel "memori apa yang dipakai" — `prd.md` §7 (Ai): bukan fitur tambahan, ini yang
 * membuat pengguna berani mempercayakan sesuatu yang layak diingat.
 */
export const MemoryUsedSchema = z.object({
  coreMemoryBlocks: z.array(z.string()),
  recalledFacts: z.array(MemoryUsedFactSchema),
  episodicSummaries: z.array(MemoryUsedEpisodeSchema),
});
export type MemoryUsed = z.infer<typeof MemoryUsedSchema>;

export const ChatCostSchema = z.object({
  model: z.string(),
  cacheHit: z.boolean(),
  actualUsd: z.number(),
  naiveUsd: z.number(),
  savedUsd: z.number(),
  savedPct: z.number(),
  routeReason: z.string(),
});
export type ChatCost = z.infer<typeof ChatCostSchema>;

export const ChatPolicySchema = z.object({
  outcome: z.literal("ALLOW"),
  reason: z.string(),
  ruleId: z.string(),
});

export const ChatResponseSchema = z.object({
  operationId: OperationIdSchema,
  sessionId: SessionIdSchema,
  reply: z.string(),
  memoryUsed: MemoryUsedSchema,
  cost: ChatCostSchema,
  policy: ChatPolicySchema,
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ForgetFactRequestSchema = z.object({
  factId: MemoryFactIdSchema,
  reason: z.string().min(1).max(256).default("Diminta pengguna lewat panel memori."),
});
export type ForgetFactRequest = z.infer<typeof ForgetFactRequestSchema>;
