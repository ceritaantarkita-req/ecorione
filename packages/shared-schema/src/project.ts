import { z } from "zod";
import { ProjectIdSchema, WorkspaceIdSchema, type ProjectId, type WorkspaceId } from "./ids.js";
import { TimestampSchema } from "./memory.js";

export const DEFAULT_WORKSPACE_ID = "ws_personal" as WorkspaceId;
export const DEFAULT_PROJECT_ID = "prj_personal" as ProjectId;

export const ProjectMemoryPolicySchema = z.literal("GLOBAL_PLUS_PROJECT");
export type ProjectMemoryPolicy = z.infer<typeof ProjectMemoryPolicySchema>;

export const ProjectAutonomyCeilingSchema = z.enum(["L0", "L1", "L2", "L3"]);
export type ProjectAutonomyCeiling = z.infer<typeof ProjectAutonomyCeilingSchema>;

export const ProjectSchema = z
  .object({
    id: ProjectIdSchema,
    workspaceId: WorkspaceIdSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2048).default(""),
    instruction: z.string().max(8000).default(""),
    memoryPolicy: ProjectMemoryPolicySchema.default("GLOBAL_PLUS_PROJECT"),
    autonomyCeiling: ProjectAutonomyCeilingSchema.default("L3"),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    archivedAt: TimestampSchema.nullable().default(null),
  })
  .strict();
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectCreateRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema.default(DEFAULT_WORKSPACE_ID),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2048).default(""),
    instruction: z.string().max(8000).default(""),
    memoryPolicy: ProjectMemoryPolicySchema.default("GLOBAL_PLUS_PROJECT"),
    autonomyCeiling: ProjectAutonomyCeilingSchema.default("L3"),
  })
  .strict();
export type ProjectCreateRequest = z.infer<typeof ProjectCreateRequestSchema>;

export const ProjectUpdateRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(2048).optional(),
    instruction: z.string().max(8000).optional(),
    autonomyCeiling: ProjectAutonomyCeilingSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.instruction !== undefined ||
      value.autonomyCeiling !== undefined,
    { message: "Minimal satu field Project harus diubah." },
  );
export type ProjectUpdateRequest = z.infer<typeof ProjectUpdateRequestSchema>;

export const ProjectArchiveRequestSchema = z
  .object({ workspaceId: WorkspaceIdSchema })
  .strict();
export type ProjectArchiveRequest = z.infer<typeof ProjectArchiveRequestSchema>;

export const ProjectListResponseSchema = z
  .object({ projects: z.array(ProjectSchema) })
  .strict();
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
