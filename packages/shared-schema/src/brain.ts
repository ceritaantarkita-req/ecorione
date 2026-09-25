import { z } from "zod";
import { ProjectIdSchema, WorkspaceIdSchema } from "./ids.js";

export const BRAIN_NODE_TYPES = [
  "Project",
  "Source",
  "Artifact",
  "Page",
  "Flow",
  "Trigger",
  "Run",
  "Fact",
] as const;
export const BrainNodeTypeSchema = z.enum(BRAIN_NODE_TYPES);
export type BrainNodeType = z.infer<typeof BrainNodeTypeSchema>;

export const BRAIN_EDGE_TYPES = [
  "BELONGS_TO",
  "REFERENCES",
  "GENERATED_FROM",
  "USES",
  "TRIGGERED",
  "EXECUTED",
] as const;
export const BrainEdgeTypeSchema = z.enum(BRAIN_EDGE_TYPES);
export type BrainEdgeType = z.infer<typeof BrainEdgeTypeSchema>;

export const BrainOwnerSchema = z.enum([
  "Hub",
  "Flow",
  "Artifact",
  "Space",
  "Connect",
  "Context",
]);
export type BrainOwner = z.infer<typeof BrainOwnerSchema>;

export const BrainAvailabilitySchema = z.enum(["AVAILABLE", "UNAVAILABLE"]);
export type BrainAvailability = z.infer<typeof BrainAvailabilitySchema>;

const BrainMetadataValueSchema = z.union([
  z.string().max(2048),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const BrainNodeSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: BrainNodeTypeSchema,
    canonicalId: z.string().min(1).max(4096),
    owner: BrainOwnerSchema,
    label: z.string().min(1).max(512),
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    availability: BrainAvailabilitySchema,
    href: z.string().max(4096).nullable(),
    metadata: z.record(z.string().min(1).max(64), BrainMetadataValueSchema).default({}),
  })
  .strict();
export type BrainNode = z.infer<typeof BrainNodeSchema>;

export const BrainEdgeSchema = z
  .object({
    id: z.string().min(1).max(512),
    type: BrainEdgeTypeSchema,
    sourceNodeId: z.string().min(1).max(128),
    targetNodeId: z.string().min(1).max(128),
  })
  .strict();
export type BrainEdge = z.infer<typeof BrainEdgeSchema>;

export const BrainGraphResponseSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    nodes: z.array(BrainNodeSchema).max(200),
    edges: z.array(BrainEdgeSchema).max(500),
    totalNodes: z.number().int().nonnegative(),
    totalEdges: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .strict();
export type BrainGraphResponse = z.infer<typeof BrainGraphResponseSchema>;

export const BrainQuerySchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    limit: z.coerce.number().int().min(10).max(200).default(120),
    runLimit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type BrainQuery = z.infer<typeof BrainQuerySchema>;

export const BrainContextConstraintSchema = z
  .object({
    sourceUris: z.array(z.string().url().max(2048)).max(32),
  })
  .strict();
export type BrainContextConstraint = z.infer<typeof BrainContextConstraintSchema>;

export const BrainNeighborhoodQuerySchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    seedNodeIds: z.array(z.string().min(1).max(128)).min(1).max(8),
    maxHops: z.coerce.number().int().min(0).max(2).default(1),
    maxNodes: z.coerce.number().int().min(1).max(64).default(32),
    nodeTypes: z.array(BrainNodeTypeSchema).max(BRAIN_NODE_TYPES.length).optional(),
    edgeTypes: z.array(BrainEdgeTypeSchema).max(BRAIN_EDGE_TYPES.length).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.seedNodeIds).size !== value.seedNodeIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seedNodeIds"],
        message: "seedNodeIds tidak boleh duplikat.",
      });
    }
    if (value.maxNodes < value.seedNodeIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxNodes"],
        message: "maxNodes tidak boleh lebih kecil dari jumlah seed.",
      });
    }
  });
export type BrainNeighborhoodQuery = z.infer<typeof BrainNeighborhoodQuerySchema>;

export const BrainNeighborhoodResponseSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    projectId: ProjectIdSchema,
    seedNodeIds: z.array(z.string().min(1).max(128)).min(1).max(8),
    nodes: z.array(BrainNodeSchema).max(64),
    edges: z.array(BrainEdgeSchema).max(256),
    contextConstraint: BrainContextConstraintSchema,
    truncated: z.boolean(),
  })
  .strict();
export type BrainNeighborhoodResponse = z.infer<typeof BrainNeighborhoodResponseSchema>;
