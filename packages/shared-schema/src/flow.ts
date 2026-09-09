import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import {
  OperationIdSchema,
  WorkflowIdSchema,
  WorkspaceIdSchema,
  type WorkflowId,
} from "./ids.js";
import { SandboxTierSchema } from "./sandbox.js";

export const FlowIdSchema = WorkflowIdSchema;
export type FlowId = WorkflowId;

export const FlowExecutionNodeSchema = z.object({
  tier: SandboxTierSchema,
  workspace: z.string().min(1).max(2048),
  command: z.string().min(1).max(8192).nullable(),
  wasmBase64: z.string().min(1).nullable().default(null),
  wasmExport: z.string().min(1).max(128).default("run"),
  wasmArgs: z.array(z.number()).max(32).default([]),
});
export type FlowExecutionNode = z.infer<typeof FlowExecutionNodeSchema>;

export const FlowStartRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema.optional(),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  inputText: z.string().min(1).max(32_000),
  delayMs: z
    .number()
    .int()
    .min(0)
    .max(30 * 24 * 60 * 60 * 1000)
    .default(0),
  approvalPrompt: z.string().min(1).max(1024),
  aiTarget: z.enum(["hosted", "local"]),
  aiMessage: z.string().min(1).max(16_000),
  execution: FlowExecutionNodeSchema,
});
export type FlowStartRequest = z.infer<typeof FlowStartRequestSchema>;

export const FlowWorkflowInputSchema = FlowStartRequestSchema.extend({
  flowId: FlowIdSchema,
  operationId: OperationIdSchema,
});
export type FlowWorkflowInput = z.infer<typeof FlowWorkflowInputSchema>;

export const FlowApprovalSignalSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(1024).nullable().default(null),
});
export type FlowApprovalSignal = z.infer<typeof FlowApprovalSignalSchema>;
export const FlowDecisionRequestSchema = FlowApprovalSignalSchema;
export type FlowDecisionRequest = z.infer<typeof FlowDecisionRequestSchema>;

export const FlowStartResponseSchema = z.object({
  flowId: FlowIdSchema,
  operationId: OperationIdSchema,
  temporalWorkflowId: z.string().min(1),
});
export type FlowStartResponse = z.infer<typeof FlowStartResponseSchema>;

export const FlowWorkflowResultSchema = z.object({
  flowId: FlowIdSchema,
  operationId: OperationIdSchema,
  transformed: z.string(),
  aiReply: z.string(),
  sandboxReceiptId: z.string().min(1),
  verified: z.literal(true),
});
export type FlowWorkflowResult = z.infer<typeof FlowWorkflowResultSchema>;
