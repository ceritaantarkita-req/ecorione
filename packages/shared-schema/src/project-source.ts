import { z } from "zod";
import {
  ArtifactIdSchema,
  EpisodeIdSchema,
  OperationIdSchema,
  ProjectIdSchema,
  WorkspaceIdSchema,
} from "./ids.js";
import { GoogleDriveFileIdSchema } from "./google-drive.js";
import { DEFAULT_WORKSPACE_ID } from "./project.js";
import { ArtifactPointerSchema, TimestampSchema } from "./memory.js";
import { FlowGraphIdSchema } from "./nodes.js";
import { SpacePageIdSchema } from "./space.js";

export const MAX_EXTERNAL_URL_SOURCE_BYTES = 20 * 1024 * 1024;

export const PROJECT_SOURCE_RESOURCE_TYPES = [
  "artifact",
  "space-page",
  "flow-graph",
  "mcp-server",
  "url",
] as const;
export const ProjectSourceResourceTypeSchema = z.enum(PROJECT_SOURCE_RESOURCE_TYPES);
export type ProjectSourceResourceType = z.infer<typeof ProjectSourceResourceTypeSchema>;

export const PROJECT_SOURCE_OWNERS = ["Artifact", "Space", "Flow", "Connect"] as const;
export const ProjectSourceOwnerSchema = z.enum(PROJECT_SOURCE_OWNERS);
export type ProjectSourceOwner = z.infer<typeof ProjectSourceOwnerSchema>;

export const PROJECT_SOURCE_ROLES = ["source", "reference"] as const;
export const ProjectSourceRoleSchema = z.enum(PROJECT_SOURCE_ROLES);
export type ProjectSourceRole = z.infer<typeof ProjectSourceRoleSchema>;

export const PROJECT_EXTERNAL_SOURCE_TYPES = ["url", "mcp-resource", "google-drive"] as const;
export const ProjectExternalSourceTypeSchema = z.enum(PROJECT_EXTERNAL_SOURCE_TYPES);
export type ProjectExternalSourceType = z.infer<typeof ProjectExternalSourceTypeSchema>;

export const PROJECT_EXTERNAL_SOURCE_STATES = [
  "SNAPSHOT_READY",
  "INDEXED",
  "DETACHED",
] as const;
export const ProjectExternalSourceStateSchema = z.enum(PROJECT_EXTERNAL_SOURCE_STATES);
export type ProjectExternalSourceState = z.infer<typeof ProjectExternalSourceStateSchema>;

export const ProjectExternalSourceLifecycleSchema = z
  .object({
    projectId: ProjectIdSchema,
    workspaceId: WorkspaceIdSchema,
    sourceType: ProjectExternalSourceTypeSchema,
    sourceKey: z.string().min(1).max(8192),
    role: ProjectSourceRoleSchema,
    latestArtifactId: ArtifactIdSchema,
    latestContextEpisodeId: EpisodeIdSchema.nullable(),
    state: ProjectExternalSourceStateSchema,
    lastRefreshedAt: TimestampSchema,
    lastIndexedAt: TimestampSchema.nullable(),
    updatedAt: TimestampSchema,
  })
  .strict();
export type ProjectExternalSourceLifecycle = z.infer<
  typeof ProjectExternalSourceLifecycleSchema
>;

export const ProjectExternalSourceLifecycleListResponseSchema = z
  .object({ lifecycles: z.array(ProjectExternalSourceLifecycleSchema) })
  .strict();

export const McpServerRefSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

export const ProjectSourceHttpsUrlSchema = z
  .string()
  .url()
  .max(2048)
  .superRefine((value, ctx) => {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      ctx.addIssue({
        code: "custom",
        message: "URL source wajib HTTPS tanpa inline credential atau fragment.",
      });
    }
  });

function resourceIdSchema(type: ProjectSourceResourceType): z.ZodType<string> {
  switch (type) {
    case "artifact":
      return ArtifactIdSchema;
    case "space-page":
      return SpacePageIdSchema;
    case "flow-graph":
      return FlowGraphIdSchema;
    case "mcp-server":
      return McpServerRefSchema;
    case "url":
      return ProjectSourceHttpsUrlSchema;
  }
}

export function projectSourceOwner(type: ProjectSourceResourceType): ProjectSourceOwner {
  switch (type) {
    case "artifact":
      return "Artifact";
    case "space-page":
      return "Space";
    case "flow-graph":
      return "Flow";
    case "mcp-server":
    case "url":
      return "Connect";
  }
}

export const ProjectSourceBindingSchema = z
  .object({
    projectId: ProjectIdSchema,
    workspaceId: WorkspaceIdSchema,
    resourceType: ProjectSourceResourceTypeSchema,
    resourceId: z.string().min(1).max(2048),
    owner: ProjectSourceOwnerSchema,
    role: ProjectSourceRoleSchema,
    createdAt: TimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = resourceIdSchema(value.resourceType).safeParse(value.resourceId);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["resourceId"],
        message: parsed.error.issues[0]?.message ?? "resourceId tidak valid.",
      });
    }
    if (value.owner !== projectSourceOwner(value.resourceType)) {
      ctx.addIssue({
        code: "custom",
        path: ["owner"],
        message: "Owner tidak cocok dengan resourceType.",
      });
    }
  });
export type ProjectSourceBinding = z.infer<typeof ProjectSourceBindingSchema>;

export const ProjectSourceAttachRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    resourceType: ProjectSourceResourceTypeSchema,
    resourceId: z.string().min(1).max(2048),
    role: ProjectSourceRoleSchema.default("source"),
  })
  .strict()
  .superRefine((value, ctx) => {
    const parsed = resourceIdSchema(value.resourceType).safeParse(value.resourceId);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["resourceId"],
        message: parsed.error.issues[0]?.message ?? "resourceId tidak valid.",
      });
    }
  });
export type ProjectSourceAttachRequest = z.infer<typeof ProjectSourceAttachRequestSchema>;

export const ProjectSourceDetachRequestSchema = ProjectSourceAttachRequestSchema;
export type ProjectSourceDetachRequest = z.infer<typeof ProjectSourceDetachRequestSchema>;

export const ProjectSourceAvailabilitySchema = z.enum(["AVAILABLE", "UNAVAILABLE"]);
export const ProjectSourceViewSchema = z
  .object({
    binding: ProjectSourceBindingSchema,
    availability: ProjectSourceAvailabilitySchema,
    metadata: z.unknown().nullable(),
    unavailableReason: z.string().max(1024).nullable(),
  })
  .strict();
export type ProjectSourceView = z.infer<typeof ProjectSourceViewSchema>;

export const ExternalUrlFetchRequestSchema = z
  .object({
    url: ProjectSourceHttpsUrlSchema,
  })
  .strict();
export type ExternalUrlFetchRequest = z.infer<typeof ExternalUrlFetchRequestSchema>;

export const ExternalUrlFetchResponseSchema = z
  .object({
    url: ProjectSourceHttpsUrlSchema,
    mimeType: z.string().min(1).max(128),
    sizeBytes: z.number().int().positive().max(MAX_EXTERNAL_URL_SOURCE_BYTES),
    contentBase64: z.string().min(1),
  })
  .strict();
export type ExternalUrlFetchResponse = z.infer<typeof ExternalUrlFetchResponseSchema>;

export const ExternalMcpResourceFetchResponseSchema = z
  .object({
    serverId: McpServerRefSchema,
    resourceUri: z.string().min(1).max(4096),
    mimeType: z.string().min(1).max(128),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024),
    contentBase64: z.string().min(1),
  })
  .strict();
export type ExternalMcpResourceFetchResponse = z.infer<
  typeof ExternalMcpResourceFetchResponseSchema
>;

export const ProjectUrlIngestRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    url: ProjectSourceHttpsUrlSchema,
    role: ProjectSourceRoleSchema.default("source"),
  })
  .strict();
export type ProjectUrlIngestRequest = z.infer<typeof ProjectUrlIngestRequestSchema>;

export const ProjectUrlIngestResponseSchema = z
  .object({
    operationId: OperationIdSchema,
    projectId: ProjectIdSchema,
    workspaceId: WorkspaceIdSchema,
    url: ProjectSourceHttpsUrlSchema,
    artifact: ArtifactPointerSchema,
    source: ProjectSourceViewSchema,
    state: z.literal("READY"),
  })
  .strict();
export type ProjectUrlIngestResponse = z.infer<typeof ProjectUrlIngestResponseSchema>;

export const ProjectMcpResourceIngestRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: WorkspaceIdSchema,
    serverId: McpServerRefSchema,
    resourceUri: z.string().min(1).max(4096),
    role: ProjectSourceRoleSchema.default("source"),
  })
  .strict();
export type ProjectMcpResourceIngestRequest = z.infer<
  typeof ProjectMcpResourceIngestRequestSchema
>;

export const ProjectMcpResourceIngestResponseSchema = z
  .object({
    operationId: OperationIdSchema,
    projectId: ProjectIdSchema,
    workspaceId: WorkspaceIdSchema,
    serverId: McpServerRefSchema,
    resourceUri: z.string().min(1).max(4096),
    artifact: ArtifactPointerSchema,
    source: ProjectSourceViewSchema,
    state: z.literal("READY"),
  })
  .strict();
export type ProjectMcpResourceIngestResponse = z.infer<
  typeof ProjectMcpResourceIngestResponseSchema
>;

export const ProjectGoogleDriveIngestRequestSchema = z
  .object({
    operationId: OperationIdSchema,
    workspaceId: z.literal(DEFAULT_WORKSPACE_ID),
    fileId: GoogleDriveFileIdSchema,
    role: ProjectSourceRoleSchema.default("source"),
  })
  .strict();
export type ProjectGoogleDriveIngestRequest = z.infer<
  typeof ProjectGoogleDriveIngestRequestSchema
>;

export const ProjectGoogleDriveIngestResponseSchema = z
  .object({
    operationId: OperationIdSchema,
    projectId: ProjectIdSchema,
    workspaceId: WorkspaceIdSchema,
    fileId: GoogleDriveFileIdSchema,
    fileName: z.string().trim().min(1).max(1024),
    sourceMimeType: z.string().trim().min(1).max(255),
    snapshotMimeType: z.string().trim().min(1).max(255),
    artifact: ArtifactPointerSchema,
    source: ProjectSourceViewSchema,
    state: z.literal("READY"),
  })
  .strict();
export type ProjectGoogleDriveIngestResponse = z.infer<
  typeof ProjectGoogleDriveIngestResponseSchema
>;

export const ProjectSourceListResponseSchema = z
  .object({ sources: z.array(ProjectSourceViewSchema) })
  .strict();
