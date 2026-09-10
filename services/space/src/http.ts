/** Space HTTP: composition owner; linked data remains owned by Context/Artifact/Flow. */
import {
  FlowGraphVersionViewSchema,
  PERSONAL_SPACE_WORKSPACE_ID,
  ScopeSchema,
  SensitivitySchema,
  SpaceBlockIdSchema,
  SpaceBlockReferenceResolutionSchema,
  SpaceCreateBlockInputSchema,
  SpaceCreatePageInputSchema,
  SpacePageIdSchema,
  SpaceRenamePageInputSchema,
  SpaceReorderBlocksInputSchema,
  SpaceUpdateBlockInputSchema,
  SyncClassSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  createServer,
  httpJson,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import { SpaceReferenceError, type SpaceStore, SpaceVersionConflictError } from "./store.js";

const PageQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema.optional(),
  scope: ScopeSchema.optional(),
});
const WorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema.optional() });
const DeletePageQuerySchema = WorkspaceQuerySchema.extend({
  expectedVersion: z.coerce.number().int().min(1),
});
const DeleteBlockQuerySchema = WorkspaceQuerySchema.extend({
  expectedVersion: z.coerce.number().int().min(1),
  expectedPageVersion: z.coerce.number().int().min(1),
});
const ResolveQuerySchema = WorkspaceQuerySchema.extend({
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
});
const CoreQuerySchema = z.object({
  scope: ScopeSchema.optional(),
  maxSensitivity: SensitivitySchema.optional(),
  hostedEligible: z.enum(["0", "1"]).optional(),
});
const CorePutSchema = z.object({
  description: z.string().min(1).max(512),
  value: z.string(),
  readOnly: z.boolean().optional(),
  scope: ScopeSchema.optional(),
  sensitivity: SensitivitySchema.optional(),
  syncClass: SyncClassSchema.optional(),
});

export interface BuildSpaceServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly contextUrl: string;
  readonly flowUrl?: string | undefined;
  readonly internalToken?: string | undefined;
}

function workspace(
  value: ReturnType<typeof WorkspaceQuerySchema.parse>,
): typeof PERSONAL_SPACE_WORKSPACE_ID {
  return (value.workspaceId ??
    PERSONAL_SPACE_WORKSPACE_ID) as typeof PERSONAL_SPACE_WORKSPACE_ID;
}

function mapSpaceError(error: unknown): never {
  if (error instanceof SpaceVersionConflictError) throw new ConflictError(error.message);
  if (error instanceof SpaceReferenceError) throw new BadRequestError(error.message);
  throw error;
}

export function buildSpaceServer(
  store: SpaceStore,
  options: BuildSpaceServerOptions,
): FastifyInstance {
  const app = createServer({ name: "space", token: options.token, logger: options.logger });
  const flowUrl = options.flowUrl ?? "http://127.0.0.1:17029";

  app.post("/v1/pages", async (req, reply) => {
    const body = parseOrBadRequest(SpaceCreatePageInputSchema, req.body);
    return reply.code(201).send(
      store.createPage({
        ...body,
        workspaceId: body.workspaceId ?? PERSONAL_SPACE_WORKSPACE_ID,
        now: nowIso(),
      }),
    );
  });
  app.get("/v1/pages", async (req) => {
    const query = parseOrBadRequest(PageQuerySchema, req.query);
    return {
      pages: store.listPages({
        workspaceId: query.workspaceId ?? PERSONAL_SPACE_WORKSPACE_ID,
        scope: query.scope,
      }),
    };
  });
  app.get<{ Params: { id: string } }>("/v1/pages/:id", async (req) => {
    const id = parseOrBadRequest(SpacePageIdSchema, req.params.id);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const result = store.getPage(id, workspace(query));
    if (result === null) throw new NotFoundError(`Page tidak ditemukan: ${id}`);
    return result;
  });
  app.patch<{ Params: { id: string } }>("/v1/pages/:id", async (req) => {
    const id = parseOrBadRequest(SpacePageIdSchema, req.params.id);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const body = parseOrBadRequest(SpaceRenamePageInputSchema, req.body);
    try {
      const page = store.renamePage({
        id,
        workspaceId: workspace(query),
        title: body.title,
        expectedVersion: body.expectedVersion,
        now: nowIso(),
      });
      if (page === null) throw new NotFoundError(`Page tidak ditemukan: ${id}`);
      return page;
    } catch (error) {
      return mapSpaceError(error);
    }
  });
  app.delete<{ Params: { id: string } }>("/v1/pages/:id", async (req, reply) => {
    const id = parseOrBadRequest(SpacePageIdSchema, req.params.id);
    const query = parseOrBadRequest(DeletePageQuerySchema, req.query);
    try {
      if (
        !store.deletePage({
          id,
          workspaceId: workspace(query),
          expectedVersion: query.expectedVersion,
        })
      ) {
        throw new NotFoundError(`Page tidak ditemukan: ${id}`);
      }
      return reply.code(204).send();
    } catch (error) {
      return mapSpaceError(error);
    }
  });
  app.post<{ Params: { id: string } }>("/v1/pages/:id/blocks", async (req, reply) => {
    const id = parseOrBadRequest(SpacePageIdSchema, req.params.id);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const body = parseOrBadRequest(SpaceCreateBlockInputSchema, req.body);
    try {
      const result = store.addBlock({
        pageId: id,
        workspaceId: workspace(query),
        ...body,
        now: nowIso(),
      });
      if (result === null) throw new NotFoundError(`Page tidak ditemukan: ${id}`);
      return reply.code(201).send(result);
    } catch (error) {
      return mapSpaceError(error);
    }
  });
  app.patch<{ Params: { id: string } }>("/v1/blocks/:id", async (req) => {
    const id = parseOrBadRequest(SpaceBlockIdSchema, req.params.id);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const body = parseOrBadRequest(SpaceUpdateBlockInputSchema, req.body);
    try {
      const result = store.updateBlock({
        id,
        workspaceId: workspace(query),
        ...body,
        now: nowIso(),
      });
      if (result === null) throw new NotFoundError(`Block tidak ditemukan: ${id}`);
      return result;
    } catch (error) {
      return mapSpaceError(error);
    }
  });
  app.delete<{ Params: { id: string } }>("/v1/blocks/:id", async (req, reply) => {
    const id = parseOrBadRequest(SpaceBlockIdSchema, req.params.id);
    const query = parseOrBadRequest(DeleteBlockQuerySchema, req.query);
    try {
      const result = store.deleteBlock({
        id,
        workspaceId: workspace(query),
        expectedVersion: query.expectedVersion,
        expectedPageVersion: query.expectedPageVersion,
        now: nowIso(),
      });
      if (result === null) throw new NotFoundError(`Block tidak ditemukan: ${id}`);
      return reply.code(200).send(result);
    } catch (error) {
      return mapSpaceError(error);
    }
  });
  app.post<{ Params: { id: string } }>("/v1/pages/:id/reorder", async (req) => {
    const id = parseOrBadRequest(SpacePageIdSchema, req.params.id);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    const body = parseOrBadRequest(SpaceReorderBlocksInputSchema, req.body);
    try {
      const result = store.reorderBlocks({
        pageId: id,
        workspaceId: workspace(query),
        ...body,
        now: nowIso(),
      });
      if (result === null) throw new NotFoundError(`Page tidak ditemukan: ${id}`);
      return result;
    } catch (error) {
      return mapSpaceError(error);
    }
  });

  app.get<{ Params: { id: string } }>("/v1/blocks/:id/resolve", async (req) => {
    const id = parseOrBadRequest(SpaceBlockIdSchema, req.params.id);
    const query = parseOrBadRequest(ResolveQuerySchema, req.query);
    const found = store.getBlock(id, workspace(query));
    if (found === null) throw new NotFoundError(`Block tidak ditemukan: ${id}`);
    const { block, page } = found;
    let source: "space" | "context" | "artifact" | "flow" = "space";
    let value: unknown = block.body;
    if (block.body.kind === "context-link") {
      source = "context";
      const params = new URLSearchParams({
        scope: page.scope,
        maxSensitivity: query.maxSensitivity,
      });
      value = await httpJson(
        `${options.contextUrl}/v1/access/facts/${encodeURIComponent(block.body.factId)}?${params.toString()}`,
        { token: options.internalToken },
      );
    } else if (
      block.body.kind === "file" ||
      block.body.kind === "image" ||
      block.body.kind === "artifact-link"
    ) {
      source = "artifact";
      const params = new URLSearchParams({
        scope: page.scope,
        maxSensitivity: query.maxSensitivity,
      });
      value = await httpJson(
        `${options.contextUrl}/v1/artifacts/${encodeURIComponent(block.body.artifactId)}/authorize?${params.toString()}`,
        { token: options.internalToken },
      );
    } else if (block.body.kind === "flow-link" || block.body.kind === "ai") {
      source = "flow";
      const params = new URLSearchParams();
      if (block.body.graphVersion !== undefined)
        params.set("version", String(block.body.graphVersion));
      const suffix = params.size === 0 ? "" : `?${params.toString()}`;
      const raw = await httpJson(
        `${flowUrl}/v1/graphs/${encodeURIComponent(block.body.graphId)}${suffix}`,
        { token: options.internalToken },
      );
      const graph = FlowGraphVersionViewSchema.parse(raw);
      if (graph.graph.workspaceId !== page.workspaceId) {
        throw new NotFoundError("Flow tidak tersedia untuk workspace page ini.");
      }
      value = graph;
    }
    return SpaceBlockReferenceResolutionSchema.parse({ blockId: block.id, source, value });
  });

  app.get("/v1/core-memory", async (req) => {
    const q = parseOrBadRequest(CoreQuerySchema, req.query);
    const params = new URLSearchParams();
    if (q.scope !== undefined) params.set("scope", q.scope);
    if (q.maxSensitivity !== undefined) params.set("maxSensitivity", q.maxSensitivity);
    if (q.hostedEligible !== undefined) params.set("hostedEligible", q.hostedEligible);
    return httpJson(`${options.contextUrl}/v1/core-memory?${params.toString()}`, {
      token: options.internalToken,
    });
  });
  app.put<{ Params: { label: string } }>("/v1/core-memory/:label", async (req) => {
    const body = parseOrBadRequest(CorePutSchema, req.body);
    return httpJson(
      `${options.contextUrl}/v1/core-memory/${encodeURIComponent(req.params.label)}`,
      {
        method: "PUT",
        token: options.internalToken,
        body: { ...body, now: nowIso() },
      },
    );
  });
  return app;
}
