/** Shared MCP Fase 2 contracts. Defined once here; Hub and Connect import them. */
import { z } from "zod";
import { ArtifactPointerSchema } from "./memory.js";
import { EpisodeIdSchema, MemoryFactIdSchema } from "./ids.js";
import { ScopeSchema, SensitivitySchema } from "./classification.js";

export const MCP_PROTOCOL_VERSION = "2026-07-28" as const;
export const MCP_SERVER_NAME = "ecorione-connect" as const;

export const McpDeliverySchema = z.enum(["local", "hosted"]);
export type McpDelivery = z.infer<typeof McpDeliverySchema>;

/**
 * Context otorisasi yang sudah diputus Connect dari transport/principal terautentikasi.
 * Hub tetap memvalidasi requested scope/sensitivity terhadap allowlist ini; internal token
 * Connect→Hub mencegah caller publik membuat access context sendiri.
 */
export const McpAccessContextSchema = z.object({
  principalId: z.string().min(1).max(256),
  sourceApp: z.string().min(1).max(64),
  allowedScopes: z.array(ScopeSchema).min(1).max(64),
  maxSensitivity: SensitivitySchema,
  delivery: McpDeliverySchema,
  requestId: z.string().min(1).max(256),
});
export type McpAccessContext = z.infer<typeof McpAccessContextSchema>;

export const McpMemorySearchSchema = z.object({
  access: McpAccessContextSchema,
  query: z.string().min(1).max(8192),
  scopes: z.array(ScopeSchema).min(1).max(64),
  k: z.number().int().min(1).max(20).optional(),
  maxSensitivity: SensitivitySchema.optional(),
});
export type McpMemorySearch = z.infer<typeof McpMemorySearchSchema>;

export const McpMemoryGetSchema = z.object({
  access: McpAccessContextSchema,
  id: z.union([MemoryFactIdSchema, EpisodeIdSchema]),
});
export type McpMemoryGet = z.infer<typeof McpMemoryGetSchema>;

export const McpMemoryProposeSchema = z.object({
  access: McpAccessContextSchema,
  text: z.string().min(1).max(4096),
  scope: ScopeSchema,
});
export type McpMemoryPropose = z.infer<typeof McpMemoryProposeSchema>;

export const McpMemoryRecentSchema = z.object({
  access: McpAccessContextSchema,
  scopes: z.array(ScopeSchema).min(1).max(64),
  limit: z.number().int().min(1).max(100).default(20),
});
export type McpMemoryRecent = z.infer<typeof McpMemoryRecentSchema>;

export const McpMemoryOpenSchema = z.object({
  access: McpAccessContextSchema,
  artifactPointer: ArtifactPointerSchema,
});
export type McpMemoryOpen = z.infer<typeof McpMemoryOpenSchema>;

export const MCP_TOOL_NAMES = [
  "memory_search",
  "memory_get",
  "memory_propose",
  "memory_recent",
  "memory_open",
] as const;
export const McpToolNameSchema = z.enum(MCP_TOOL_NAMES);
export type McpToolName = z.infer<typeof McpToolNameSchema>;
