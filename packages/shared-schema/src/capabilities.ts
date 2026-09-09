/** Unified capability / permission authority contracts (Batch 4). */
import { z } from "zod";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import { OperationIdSchema, WorkspaceIdSchema } from "./ids.js";
import { ActionClassSchema, AutonomyLevelSchema, type ActionClass } from "./policy.js";

export const CapabilityIdSchema = z
  .string()
  .min(2)
  .max(96)
  .regex(/^[a-z][a-z0-9._:-]*$/);
export type CapabilityId = z.infer<typeof CapabilityIdSchema>;

export const PermissionIdSchema = z
  .string()
  .min(2)
  .max(96)
  .regex(/^[a-z][a-z0-9._:-]*$/);
export type PermissionId = z.infer<typeof PermissionIdSchema>;

export const AUTHORITY_SUBJECT_KINDS = [
  "extension",
  "mcp-tool",
  "sandbox",
  "model",
  "tool",
  "node",
] as const;
export const AuthoritySubjectKindSchema = z.enum(AUTHORITY_SUBJECT_KINDS);
export type AuthoritySubjectKind = z.infer<typeof AuthoritySubjectKindSchema>;

export const AuthoritySubjectIdSchema = z
  .string()
  .min(1)
  .max(192)
  .regex(/^[a-z0-9][a-z0-9._:/-]*$/);
export const AuthoritySubjectSchema = z
  .object({
    kind: AuthoritySubjectKindSchema,
    id: AuthoritySubjectIdSchema,
  })
  .strict();
export type AuthoritySubject = z.infer<typeof AuthoritySubjectSchema>;

export const PERMISSION_RESOURCES = [
  "data",
  "artifact",
  "network",
  "filesystem",
  "credential",
  "execution",
  "external",
  "model",
  "mcp",
  "system",
] as const;
export const PermissionResourceSchema = z.enum(PERMISSION_RESOURCES);
export type PermissionResource = z.infer<typeof PermissionResourceSchema>;

export const PERMISSION_ACCESS = [
  "read",
  "write",
  "execute",
  "connect",
  "send",
  "spend",
  "use",
] as const;
export const PermissionAccessSchema = z.enum(PERMISSION_ACCESS);
export type PermissionAccess = z.infer<typeof PermissionAccessSchema>;

export const CapabilityPermissionSchema = z
  .object({
    id: PermissionIdSchema,
    actionClass: ActionClassSchema,
    resource: PermissionResourceSchema,
    access: PermissionAccessSchema,
    sideEffect: z.boolean(),
    description: z.string().min(1).max(256),
  })
  .strict();
export type CapabilityPermission = z.infer<typeof CapabilityPermissionSchema>;

const MCP_ACTION_PERMISSIONS: Readonly<Record<ActionClass, PermissionId>> = {
  READ: "mcp.tool.read" as PermissionId,
  REVERSIBLE_WRITE: "mcp.tool.write" as PermissionId,
  IRREVERSIBLE_WRITE: "mcp.tool.irreversible-write" as PermissionId,
  SPEND: "mcp.tool.spend" as PermissionId,
  EXTERNAL_SEND: "mcp.tool.external-send" as PermissionId,
  CREDENTIAL_ACCESS: "mcp.tool.credential-access" as PermissionId,
  EXECUTE: "mcp.tool.execute" as PermissionId,
  POLICY_ADMIN: "mcp.tool.policy-admin" as PermissionId,
};
export function mcpPermissionForActionClass(actionClass: ActionClass): PermissionId {
  return MCP_ACTION_PERMISSIONS[actionClass];
}

export const CapabilityDefinitionSchema = z
  .object({
    id: CapabilityIdSchema,
    description: z.string().min(1).max(512),
    permissions: z.array(CapabilityPermissionSchema).min(1).max(64),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, permission] of value.permissions.entries()) {
      if (seen.has(permission.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["permissions", index, "id"],
          message: `Permission capability duplikat: ${permission.id}.`,
        });
      }
      seen.add(permission.id);
    }
  });
export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;

function uniquePermissionIds(
  value: { permissionIds: readonly string[] },
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, id] of value.permissionIds.entries()) {
    if (seen.has(id)) {
      ctx.addIssue({
        code: "custom",
        path: ["permissionIds", index],
        message: `permissionId duplikat: ${id}.`,
      });
    }
    seen.add(id);
  }
}

const AuthorityMutationContext = {
  operationId: OperationIdSchema,
  workspaceId: WorkspaceIdSchema,
  subject: AuthoritySubjectSchema,
  capabilityId: CapabilityIdSchema,
  permissionIds: z.array(PermissionIdSchema).min(1).max(64),
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema,
  autonomy: AutonomyLevelSchema,
  reason: z.string().min(1).max(512),
  idempotencyKey: z.string().min(8).max(128),
} as const;

export const CapabilityGrantRequestSchema = z
  .object(AuthorityMutationContext)
  .strict()
  .superRefine(uniquePermissionIds);
export type CapabilityGrantRequest = z.infer<typeof CapabilityGrantRequestSchema>;

export const CapabilityRevokeRequestSchema = z
  .object(AuthorityMutationContext)
  .strict()
  .superRefine(uniquePermissionIds);
export type CapabilityRevokeRequest = z.infer<typeof CapabilityRevokeRequestSchema>;

export const CapabilityAuthorizationRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    subject: AuthoritySubjectSchema,
    capabilityId: CapabilityIdSchema,
    permissionIds: z.array(PermissionIdSchema).min(1).max(64),
    scope: ScopeSchema,
    sensitivity: SensitivitySchema,
    autonomy: AutonomyLevelSchema,
  })
  .strict()
  .superRefine(uniquePermissionIds);
export type CapabilityAuthorizationRequest = z.infer<
  typeof CapabilityAuthorizationRequestSchema
>;

export const CapabilityAuthorizationResultSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("ALLOW"),
    reason: z.string(),
    grantedPermissionIds: z.array(PermissionIdSchema),
  }),
  z.object({
    outcome: z.literal("DENY"),
    reason: z.string(),
    missingPermissionIds: z.array(PermissionIdSchema),
  }),
]);
export type CapabilityAuthorizationResult = z.infer<typeof CapabilityAuthorizationResultSchema>;

export const CapabilityGrantViewSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    subject: AuthoritySubjectSchema,
    capabilityId: CapabilityIdSchema,
    permissionId: PermissionIdSchema,
    scope: ScopeSchema,
    maxSensitivity: SensitivitySchema,
    grantedAt: z.string().datetime({ offset: false }),
    operationId: OperationIdSchema,
    reason: z.string(),
  })
  .strict();
export type CapabilityGrantView = z.infer<typeof CapabilityGrantViewSchema>;
