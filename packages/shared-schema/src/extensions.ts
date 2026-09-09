/** Plugin / Extension Framework contracts (Batch 3), unified with Batch 4 authority plane. */
import { z } from "zod";
import {
  CapabilityIdSchema,
  PermissionAccessSchema,
  PermissionIdSchema,
  PermissionResourceSchema,
} from "./capabilities.js";
import { ArtifactIdSchema, OperationIdSchema, WorkspaceIdSchema } from "./ids.js";
import { ScopeSchema, SensitivitySchema } from "./classification.js";
import { ActionClassSchema, AutonomyLevelSchema } from "./policy.js";

export const ExtensionIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);
export type ExtensionId = z.infer<typeof ExtensionIdSchema>;

export const ExtensionRevisionIdSchema = z.string().regex(/^xrev_[a-z0-9][a-z0-9_-]{7,63}$/);
export type ExtensionRevisionId = z.infer<typeof ExtensionRevisionIdSchema>;

export const ExtensionVersionSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
export type ExtensionVersion = z.infer<typeof ExtensionVersionSchema>;

export const ExtensionSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export type ExtensionSha256 = z.infer<typeof ExtensionSha256Schema>;

const GithubRepositorySchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const GithubCommitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);

const HttpsUrlSchema = z
  .string()
  .url()
  .superRefine((value, ctx) => {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "Extension release URL wajib HTTPS." });
    }
    if (url.username !== "" || url.password !== "" || url.hash !== "") {
      ctx.addIssue({
        code: "custom",
        message: "Extension release URL tidak boleh memuat credential atau fragment.",
      });
    }
  });

export const ExtensionSourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("github"),
      repository: GithubRepositorySchema,
      commitSha: GithubCommitShaSchema,
      bundleSha256: ExtensionSha256Schema,
    })
    .strict(),
  z
    .object({
      type: z.literal("release"),
      url: HttpsUrlSchema,
      version: ExtensionVersionSchema,
      bundleSha256: ExtensionSha256Schema,
    })
    .strict(),
  z
    .object({
      type: z.literal("artifact"),
      artifactId: ArtifactIdSchema,
      bundleSha256: ExtensionSha256Schema,
    })
    .strict(),
]);
export type ExtensionSource = z.infer<typeof ExtensionSourceSchema>;

const RelativeEntrypointSchema = z
  .string()
  .min(1)
  .max(512)
  .superRefine((value, ctx) => {
    if (value.startsWith("/") || value.startsWith("\\") || value.includes("\\")) {
      ctx.addIssue({
        code: "custom",
        message: "Entrypoint extension harus path relatif POSIX.",
      });
    }
    if (value.split("/").includes("..")) {
      ctx.addIssue({
        code: "custom",
        message: "Entrypoint extension tidak boleh path traversal.",
      });
    }
    if (value.includes("\u0000")) {
      ctx.addIssue({ code: "custom", message: "Entrypoint extension mengandung NUL." });
    }
  });

export const ExtensionExecutionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      kind: z.literal("mcp"),
      serverId: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[a-z0-9][a-z0-9._-]*$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("sandbox"),
      artifactId: ArtifactIdSchema,
      runtime: z.enum(["node", "python", "wasm"]),
      entrypoint: RelativeEntrypointSchema,
    })
    .strict(),
]);
export type ExtensionExecution = z.infer<typeof ExtensionExecutionSchema>;

const SecretRequirementNameSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const ExtensionCapabilitySchema = z
  .object({
    id: CapabilityIdSchema,
    description: z.string().min(1).max(256),
  })
  .strict();
export type ExtensionCapability = z.infer<typeof ExtensionCapabilitySchema>;

export const ExtensionPermissionSchema = z
  .object({
    id: PermissionIdSchema,
    /**
     * Permission secara eksplisit terikat ke capability. Untuk manifest Batch 3 lama,
     * capabilityId boleh dihilangkan hanya bila permission id sama dengan capability id.
     */
    capabilityId: CapabilityIdSchema.optional(),
    actionClass: ActionClassSchema,
    resource: PermissionResourceSchema.default("system"),
    access: PermissionAccessSchema.default("use"),
    sideEffect: z.boolean().optional(),
    reason: z.string().min(1).max(256),
  })
  .strict();
export type ExtensionPermission = z.infer<typeof ExtensionPermissionSchema>;

export const ExtensionSecretRequirementSchema = z
  .object({
    name: SecretRequirementNameSchema,
    purpose: z.string().min(1).max(256),
    optional: z.boolean().default(false),
  })
  .strict();
export type ExtensionSecretRequirement = z.infer<typeof ExtensionSecretRequirementSchema>;

export function extensionPermissionCapabilityId(permission: ExtensionPermission): string {
  return permission.capabilityId ?? permission.id;
}

export const ExtensionManifestSchema = z
  .object({
    apiVersion: z.literal("ecorione.extension/v1"),
    id: ExtensionIdSchema,
    name: z.string().min(1).max(128),
    version: ExtensionVersionSchema,
    description: z.string().min(1).max(512),
    source: ExtensionSourceSchema,
    packageArtifactId: ArtifactIdSchema,
    execution: ExtensionExecutionSchema,
    capabilities: z.array(ExtensionCapabilitySchema).max(128).default([]),
    permissions: z.array(ExtensionPermissionSchema).max(128).default([]),
    secretRequirements: z.array(ExtensionSecretRequirementSchema).max(64).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const duplicate = (items: readonly string[]): string | null => {
      const seen = new Set<string>();
      for (const item of items) {
        if (seen.has(item)) return item;
        seen.add(item);
      }
      return null;
    };
    const capability = duplicate(value.capabilities.map((item) => item.id));
    if (capability !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["capabilities"],
        message: `Capability extension duplikat: ${capability}.`,
      });
    }
    const permission = duplicate(value.permissions.map((item) => item.id));
    if (permission !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["permissions"],
        message: `Permission extension duplikat: ${permission}.`,
      });
    }
    const secret = duplicate(value.secretRequirements.map((item) => item.name));
    if (secret !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["secretRequirements"],
        message: `Secret requirement extension duplikat: ${secret}.`,
      });
    }

    const capabilityIds = new Set(value.capabilities.map((item) => item.id));
    for (const [index, item] of value.permissions.entries()) {
      const capabilityId = item.capabilityId ?? item.id;
      if (!capabilityIds.has(capabilityId)) {
        ctx.addIssue({
          code: "custom",
          path: ["permissions", index, "capabilityId"],
          message: `Permission ${item.id} harus menunjuk capability yang dideklarasikan: ${capabilityId}.`,
        });
      }
    }
  });
export type ExtensionManifest = z.infer<typeof ExtensionManifestSchema>;

export const ExtensionLifecycleStateSchema = z.enum(["INSTALLED", "DISABLED", "REMOVED"]);
export type ExtensionLifecycleState = z.infer<typeof ExtensionLifecycleStateSchema>;
export const ExtensionHealthStatusSchema = z.enum([
  "UNKNOWN",
  "HEALTHY",
  "DEGRADED",
  "ERROR",
  "BLOCKED",
]);
export type ExtensionHealthStatus = z.infer<typeof ExtensionHealthStatusSchema>;

const MutationContext = {
  operationId: OperationIdSchema,
  workspaceId: WorkspaceIdSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  autonomy: AutonomyLevelSchema,
  idempotencyKey: z.string().min(8).max(128),
} as const;

export const ExtensionInstallRequestSchema = z
  .object({ ...MutationContext, manifest: ExtensionManifestSchema })
  .strict();
export type ExtensionInstallRequest = z.infer<typeof ExtensionInstallRequestSchema>;

export const ExtensionUpdateRequestSchema = ExtensionInstallRequestSchema;
export type ExtensionUpdateRequest = z.infer<typeof ExtensionUpdateRequestSchema>;

export const ExtensionRollbackRequestSchema = z
  .object({
    ...MutationContext,
    targetRevisionId: ExtensionRevisionIdSchema,
  })
  .strict();
export type ExtensionRollbackRequest = z.infer<typeof ExtensionRollbackRequestSchema>;

export const ExtensionRemoveRequestSchema = z
  .object({
    ...MutationContext,
    reason: z.string().min(1).max(512),
  })
  .strict();
export type ExtensionRemoveRequest = z.infer<typeof ExtensionRemoveRequestSchema>;

export const ExtensionHealthReportRequestSchema = z
  .object({
    ...MutationContext,
    status: ExtensionHealthStatusSchema.exclude(["UNKNOWN"]),
    detail: z.string().min(1).max(512),
  })
  .strict();
export type ExtensionHealthReportRequest = z.infer<typeof ExtensionHealthReportRequestSchema>;
