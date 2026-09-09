import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import { OperationIdSchema, WorkspaceIdSchema } from "./ids.js";

export const SANDBOX_TIERS = ["tier0", "tier1.5", "tier1"] as const;
export const SandboxTierSchema = z.enum(SANDBOX_TIERS);
export type SandboxTier = z.infer<typeof SandboxTierSchema>;

export const SandboxExecutionRequestSchema = z.object({
  operationId: OperationIdSchema,
  /**
   * Legacy callers sebelum Batch 4 tidak membawa workspaceId. Mereka dipetakan ke
   * ws_personal oleh executor agar migrasi tidak mengubah arti flow personal yang sudah ada.
   * Caller baru sebaiknya selalu mengirim workspaceId eksplisit.
   */
  workspaceId: WorkspaceIdSchema.optional(),
  tier: SandboxTierSchema,
  workspace: z.string().min(1).max(2048),
  command: z.string().max(8192).nullable().default(null),
  wasmBase64: z.string().nullable().default(null),
  wasmExport: z.string().min(1).max(128).default("run"),
  wasmArgs: z.array(z.number().int()).max(16).default([]),
  irreversible: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(128),
  scope: ScopeSchema.default("personal"),
  sensitivity: SensitivitySchema.default("INTERNAL"),
});
export type SandboxExecutionRequest = z.infer<typeof SandboxExecutionRequestSchema>;

export const SandboxExecutionReceiptSchema = z.object({
  id: z.string().min(1).max(128),
  tier: SandboxTierSchema,
  command: z.string().nullable(),
  exitCode: z.number().int(),
  durationMs: z.number().int().nonnegative(),
  operationId: OperationIdSchema,
  recordedAt: z.string().datetime({ offset: false }),
  stdout: z.string(),
  stderr: z.string(),
});
export type SandboxExecutionReceipt = z.infer<typeof SandboxExecutionReceiptSchema>;
