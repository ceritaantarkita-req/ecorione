/** Policy, approval and audit contracts. */
import { z } from "zod";
import { ModuleNameSchema } from "./modules.js";
import { EventIdSchema, OperationIdSchema } from "./ids.js";
import { ScopeSchema, SensitivitySchema } from "./classification.js";

export const AUTONOMY_LEVELS = ["L0", "L1", "L2", "L3", "L4"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];
export const AutonomyLevelSchema = z.enum(AUTONOMY_LEVELS);
export const MAX_AUTONOMY_V1: AutonomyLevel = "L3";
const AUTONOMY_RANK: Record<AutonomyLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
export function autonomyExceeds(level: AutonomyLevel, ceiling: AutonomyLevel): boolean {
  return AUTONOMY_RANK[level] > AUTONOMY_RANK[ceiling];
}

export const ACTION_CLASS = [
  "READ",
  "REVERSIBLE_WRITE",
  "IRREVERSIBLE_WRITE",
  "SPEND",
  "EXTERNAL_SEND",
  "CREDENTIAL_ACCESS",
  "EXECUTE",
] as const;
export type ActionClass = (typeof ACTION_CLASS)[number];
export const ActionClassSchema = z.enum(ACTION_CLASS);
const ALWAYS_GATED: ReadonlySet<ActionClass> = new Set([
  "IRREVERSIBLE_WRITE",
  "SPEND",
  "EXTERNAL_SEND",
  "CREDENTIAL_ACCESS",
]);
export function alwaysRequiresApproval(cls: ActionClass): boolean {
  return ALWAYS_GATED.has(cls);
}

export const ActionRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    module: ModuleNameSchema,
    tool: z.string().min(1).max(128),
    actionClass: ActionClassSchema,
    args: z.record(z.string(), z.unknown()),
    scope: ScopeSchema,
    sensitivity: SensitivitySchema,
    autonomy: AutonomyLevelSchema,
    idempotencyKey: z.string().min(8).max(128).nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.actionClass !== "READ" && value.idempotencyKey === null) {
      ctx.addIssue({
        code: "custom",
        path: ["idempotencyKey"],
        message: "Side effect wajib punya idempotencyKey (ADR-12).",
      });
    }
  });
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const APPROVAL_DECISIONS = ["APPROVE", "EDIT", "REJECT", "RESPOND"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export const ApprovalDecisionSchema = z.enum(APPROVAL_DECISIONS);
export const PolicyVerdictSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("ALLOW"), reason: z.string() }),
  z.object({ outcome: z.literal("REQUIRE_APPROVAL"), reason: z.string(), prompt: z.string() }),
  z.object({ outcome: z.literal("DENY"), reason: z.string() }),
]);
export type PolicyVerdict = z.infer<typeof PolicyVerdictSchema>;
export const PolicyRuleSchema = z.object({
  id: z.string().min(1).max(64),
  description: z.string().min(1).max(256),
  version: z.string().min(1).max(32),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const AUDIT_EVENT_TYPES = [
  "ACTION_REQUESTED",
  "POLICY_EVALUATED",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
  "ACTION_EXECUTED",
  "ACTION_FAILED",
  "ACTION_SKIPPED_IDEMPOTENT",
  "MEMORY_PROPOSED",
  "MEMORY_PROMOTED",
  "MEMORY_INVALIDATED",
  "MODEL_CALLED",
  "HISTORY_WRITE_FAILED",
  "TRACE_WRITE_FAILED",
  "MCP_TOOL_CALLED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export const AuditEventTypeSchema = z.enum(AUDIT_EVENT_TYPES);
export const AuditEventSchema = z.object({
  id: EventIdSchema,
  ts: z.string().datetime({ offset: false }),
  type: AuditEventTypeSchema,
  operationId: OperationIdSchema.nullable(),
  module: ModuleNameSchema,
  detail: z.record(z.string(), z.unknown()),
  ruleId: z.string().max(64).nullable().default(null),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export function idempotencyPayload(
  req: Pick<ActionRequest, "module" | "tool" | "args">,
): string {
  return JSON.stringify({ m: req.module, t: req.tool, a: sortDeep(req.args) });
}
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}
