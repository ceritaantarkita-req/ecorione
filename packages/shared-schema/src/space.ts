import { z } from "zod";
import { ScopeSchema } from "./classification.js";
import { ArtifactIdSchema, MemoryFactIdSchema, WorkspaceIdSchema } from "./ids.js";
import { TimestampSchema } from "./memory.js";
import { FlowGraphIdSchema } from "./nodes.js";

export const PERSONAL_SPACE_WORKSPACE_ID = WorkspaceIdSchema.parse("ws_personal");

export const SpacePageIdSchema = z.string().regex(/^page_[a-z0-9_-]+$/);
export type SpacePageId = z.infer<typeof SpacePageIdSchema>;
export const SpaceBlockIdSchema = z.string().regex(/^block_[a-z0-9_-]+$/);
export type SpaceBlockId = z.infer<typeof SpaceBlockIdSchema>;

export const SpacePageSchema = z
  .object({
    id: SpacePageIdSchema,
    workspaceId: WorkspaceIdSchema,
    title: z.string().min(1).max(200),
    scope: ScopeSchema,
    version: z.number().int().min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();
export type SpacePage = z.infer<typeof SpacePageSchema>;

const TextSchema = z.string().max(100_000);
const LabelSchema = z.string().min(1).max(200);

export const SpaceParagraphBodySchema = z
  .object({ kind: z.literal("paragraph"), text: TextSchema })
  .strict();
export const SpaceHeadingBodySchema = z
  .object({
    kind: z.literal("heading"),
    text: z.string().max(10_000),
    level: z.number().int().min(1).max(3),
  })
  .strict();
export const SpaceListBodySchema = z
  .object({
    kind: z.literal("list"),
    style: z.enum(["bullet", "numbered"]),
    items: z.array(z.string().max(20_000)).max(500),
  })
  .strict();
export const SpaceChecklistBodySchema = z
  .object({
    kind: z.literal("checklist"),
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^item_[a-z0-9_-]+$/),
            text: z.string().max(20_000),
            checked: z.boolean(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export const SpaceTableBodySchema = z
  .object({
    kind: z.literal("table"),
    columns: z
      .array(
        z
          .object({
            id: z.string().regex(/^col_[a-z0-9_-]+$/),
            label: z.string().min(1).max(120),
          })
          .strict(),
      )
      .min(1)
      .max(64),
    rows: z
      .array(
        z
          .object({
            id: z.string().regex(/^row_[a-z0-9_-]+$/),
            cells: z.record(z.string(), z.string().max(50_000)),
          })
          .strict(),
      )
      .max(10_000),
  })
  .strict()
  .superRefine((value, ctx) => {
    const columnIds = new Set(value.columns.map((column) => column.id));
    if (columnIds.size !== value.columns.length) {
      ctx.addIssue({ code: "custom", path: ["columns"], message: "Column id harus unik." });
    }
    const rowIds = new Set<string>();
    for (const [index, row] of value.rows.entries()) {
      if (rowIds.has(row.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", index, "id"],
          message: "Row id harus unik.",
        });
      }
      rowIds.add(row.id);
      for (const key of Object.keys(row.cells)) {
        if (!columnIds.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", index, "cells", key],
            message: "Cell mengacu ke column id yang tidak ada.",
          });
        }
      }
    }
  });
export const SpaceDatabaseViewBodySchema = z
  .object({
    kind: z.literal("database-view"),
    sourceBlockId: SpaceBlockIdSchema,
    visibleColumnIds: z
      .array(z.string().regex(/^col_[a-z0-9_-]+$/))
      .max(64)
      .optional(),
    filter: z
      .object({
        columnId: z.string().regex(/^col_[a-z0-9_-]+$/),
        operator: z.enum(["eq", "neq", "contains", "empty", "not-empty"]),
        value: z.string().max(10_000).optional(),
      })
      .strict()
      .optional(),
    sort: z
      .object({
        columnId: z.string().regex(/^col_[a-z0-9_-]+$/),
        direction: z.enum(["asc", "desc"]),
      })
      .strict()
      .optional(),
  })
  .strict();
export const SpaceFileBodySchema = z
  .object({
    kind: z.literal("file"),
    artifactId: ArtifactIdSchema,
    label: LabelSchema.optional(),
  })
  .strict();
export const SpaceImageBodySchema = z
  .object({
    kind: z.literal("image"),
    artifactId: ArtifactIdSchema,
    alt: z.string().max(500).default(""),
    caption: z.string().max(2000).optional(),
  })
  .strict();
export const SpaceArtifactLinkBodySchema = z
  .object({
    kind: z.literal("artifact-link"),
    artifactId: ArtifactIdSchema,
    label: LabelSchema.optional(),
  })
  .strict();
export const SpaceContextLinkBodySchema = z
  .object({
    kind: z.literal("context-link"),
    factId: MemoryFactIdSchema,
    label: LabelSchema.optional(),
  })
  .strict();
export const SpaceFlowLinkBodySchema = z
  .object({
    kind: z.literal("flow-link"),
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1).optional(),
    label: LabelSchema.optional(),
  })
  .strict();
export const SpaceAiBodySchema = z
  .object({
    kind: z.literal("ai"),
    graphId: FlowGraphIdSchema,
    graphVersion: z.number().int().min(1).optional(),
    prompt: z.string().min(1).max(16_000),
  })
  .strict();
export const SpaceEmbedBodySchema = z
  .object({
    kind: z.literal("embed"),
    url: z.string().url(),
    title: z.string().max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const url = new URL(value.url);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Embed wajib HTTPS tanpa inline credential atau fragment.",
      });
    }
  });

export const SpaceBlockBodySchema = z.discriminatedUnion("kind", [
  SpaceParagraphBodySchema,
  SpaceHeadingBodySchema,
  SpaceListBodySchema,
  SpaceChecklistBodySchema,
  SpaceTableBodySchema,
  SpaceDatabaseViewBodySchema,
  SpaceFileBodySchema,
  SpaceImageBodySchema,
  SpaceEmbedBodySchema,
  SpaceAiBodySchema,
  SpaceContextLinkBodySchema,
  SpaceArtifactLinkBodySchema,
  SpaceFlowLinkBodySchema,
]);
export type SpaceBlockBody = z.infer<typeof SpaceBlockBodySchema>;
export const SPACE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "list",
  "checklist",
  "table",
  "database-view",
  "file",
  "image",
  "embed",
  "ai",
  "context-link",
  "artifact-link",
  "flow-link",
] as const;
export const SpaceBlockTypeSchema = z.enum(SPACE_BLOCK_TYPES);
export type SpaceBlockType = z.infer<typeof SpaceBlockTypeSchema>;

export const SpaceBlockSchema = z
  .object({
    id: SpaceBlockIdSchema,
    pageId: SpacePageIdSchema,
    workspaceId: WorkspaceIdSchema,
    type: SpaceBlockTypeSchema,
    body: SpaceBlockBodySchema,
    position: z.number().int().nonnegative(),
    version: z.number().int().min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type !== value.body.kind) {
      ctx.addIssue({
        code: "custom",
        path: ["body", "kind"],
        message: "Block type harus sama dengan body.kind.",
      });
    }
  });
export type SpaceBlock = z.infer<typeof SpaceBlockSchema>;

export const SpaceDocumentSchema = z
  .object({ page: SpacePageSchema, blocks: z.array(SpaceBlockSchema) })
  .strict();
export type SpaceDocument = z.infer<typeof SpaceDocumentSchema>;

export const SpaceCreatePageInputSchema = z
  .object({
    workspaceId: WorkspaceIdSchema.optional(),
    title: z.string().min(1).max(200),
    scope: ScopeSchema,
  })
  .strict();
export const SpaceRenamePageInputSchema = z
  .object({ title: z.string().min(1).max(200), expectedVersion: z.number().int().min(1) })
  .strict();
export const SpaceCreateBlockInputSchema = z
  .object({
    body: SpaceBlockBodySchema,
    position: z.number().int().nonnegative(),
    expectedPageVersion: z.number().int().min(1),
  })
  .strict();
export const SpaceUpdateBlockInputSchema = z
  .object({
    body: SpaceBlockBodySchema.optional(),
    position: z.number().int().nonnegative().optional(),
    expectedVersion: z.number().int().min(1),
    expectedPageVersion: z.number().int().min(1),
  })
  .strict()
  .refine((value) => value.body !== undefined || value.position !== undefined, {
    message: "Minimal body atau position harus diubah.",
  });
export const SpaceReorderBlocksInputSchema = z
  .object({
    blockIds: z.array(SpaceBlockIdSchema).max(10_000),
    expectedPageVersion: z.number().int().min(1),
  })
  .strict();

export const SpaceBlockReferenceResolutionSchema = z
  .object({
    blockId: SpaceBlockIdSchema,
    source: z.enum(["space", "context", "artifact", "flow"]),
    value: z.unknown(),
  })
  .strict();
export type SpaceBlockReferenceResolution = z.infer<typeof SpaceBlockReferenceResolutionSchema>;
