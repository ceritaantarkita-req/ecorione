import { z } from "zod";
import { ScopeSchema } from "./classification.js";

export const SpacePageSchema = z.object({
  id: z.string().regex(/^page_[a-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  scope: ScopeSchema,
  createdAt: z.string().datetime({ offset: false }),
  updatedAt: z.string().datetime({ offset: false }),
});
export type SpacePage = z.infer<typeof SpacePageSchema>;

export const SPACE_BLOCK_TYPES = ["text", "heading", "list"] as const;
export const SpaceBlockTypeSchema = z.enum(SPACE_BLOCK_TYPES);
export const SpaceBlockSchema = z.object({
  id: z.string().regex(/^block_[a-z0-9_-]+$/),
  pageId: SpacePageSchema.shape.id,
  type: SpaceBlockTypeSchema,
  content: z.string().max(100_000),
  position: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: false }),
  updatedAt: z.string().datetime({ offset: false }),
});
export type SpaceBlock = z.infer<typeof SpaceBlockSchema>;
