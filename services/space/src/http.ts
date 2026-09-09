/** Space HTTP: structured notes + direct UI proxy over Context L2. */
import {
  ScopeSchema,
  SensitivitySchema,
  SpaceBlockTypeSchema,
  SyncClassSchema,
} from "@ecorione/shared-schema";
import {
  createServer,
  httpJson,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import type { SpaceStore } from "./store.js";

const CreatePageSchema = z.object({ title: z.string().min(1).max(200), scope: ScopeSchema });
const RenamePageSchema = z.object({ title: z.string().min(1).max(200) });
const AddBlockSchema = z.object({
  type: SpaceBlockTypeSchema,
  content: z.string().max(100_000),
  position: z.number().int().nonnegative(),
});
const UpdateBlockSchema = AddBlockSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "Minimal satu field block harus diubah.",
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
  readonly internalToken?: string | undefined;
}

export function buildSpaceServer(
  store: SpaceStore,
  options: BuildSpaceServerOptions,
): FastifyInstance {
  const app = createServer({ name: "space", token: options.token, logger: options.logger });

  app.post("/v1/pages", async (req, reply) => {
    const body = parseOrBadRequest(CreatePageSchema, req.body);
    return reply.code(201).send(store.createPage({ ...body, now: nowIso() }));
  });
  app.get("/v1/pages", async (req) => {
    const q = parseOrBadRequest(z.object({ scope: ScopeSchema.optional() }), req.query);
    return { pages: store.listPages(q.scope) };
  });
  app.get<{ Params: { id: string } }>("/v1/pages/:id", async (req) => {
    const result = store.getPage(req.params.id);
    if (result === null) throw new NotFoundError(`Page tidak ditemukan: ${req.params.id}`);
    return result;
  });
  app.patch<{ Params: { id: string } }>("/v1/pages/:id", async (req) => {
    const body = parseOrBadRequest(RenamePageSchema, req.body);
    const page = store.renamePage(req.params.id, body.title, nowIso());
    if (page === null) throw new NotFoundError(`Page tidak ditemukan: ${req.params.id}`);
    return page;
  });
  app.delete<{ Params: { id: string } }>("/v1/pages/:id", async (req, reply) => {
    if (!store.deletePage(req.params.id))
      throw new NotFoundError(`Page tidak ditemukan: ${req.params.id}`);
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>("/v1/pages/:id/blocks", async (req, reply) => {
    const body = parseOrBadRequest(AddBlockSchema, req.body);
    const block = store.addBlock({ pageId: req.params.id, ...body, now: nowIso() });
    if (block === null) throw new NotFoundError(`Page tidak ditemukan: ${req.params.id}`);
    return reply.code(201).send(block);
  });
  app.patch<{ Params: { id: string } }>("/v1/blocks/:id", async (req) => {
    const body = parseOrBadRequest(UpdateBlockSchema, req.body);
    const block = store.updateBlock(req.params.id, body, nowIso());
    if (block === null) throw new NotFoundError(`Block tidak ditemukan: ${req.params.id}`);
    return block;
  });
  app.delete<{ Params: { id: string } }>("/v1/blocks/:id", async (req, reply) => {
    if (!store.deleteBlock(req.params.id))
      throw new NotFoundError(`Block tidak ditemukan: ${req.params.id}`);
    return reply.code(204).send();
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
