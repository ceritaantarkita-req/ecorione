import { ExternalUrlFetchRequestSchema } from "@ecorione/shared-schema";
import { z } from "zod";
import { HttpError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { toMcpHttpError } from "./mcp-client/http.js";
import type { McpManager } from "./mcp-client/manager.js";
import { McpResourceReadRequestSchema, McpServerIdSchema } from "./mcp-client/types.js";
import { snapshotMcpResource } from "./mcp-resource-source.js";
import {
  ExternalSourceFetchError,
  fetchExternalUrl,
  type ExternalSourceFetchDeps,
} from "./source-fetch.js";

export function registerExternalSourceFetchRoutes(
  app: FastifyInstance,
  deps: ExternalSourceFetchDeps = {},
): void {
  app.post("/v1/source-fetch/url", async (req) => {
    const body = parseOrBadRequest(ExternalUrlFetchRequestSchema, req.body);
    try {
      return await fetchExternalUrl(body.url, deps);
    } catch (error) {
      if (error instanceof ExternalSourceFetchError) {
        throw new HttpError(error.statusCode, error.code, error.message);
      }
      throw error;
    }
  });
}

const McpResourceParamsSchema = z.object({ id: McpServerIdSchema });

export function registerMcpResourceSourceFetchRoutes(
  app: FastifyInstance,
  manager: McpManager,
): void {
  app.post<{ Params: { id: string } }>("/v1/source-fetch/mcp-resource/:id", async (req) => {
    const { id } = parseOrBadRequest(McpResourceParamsSchema, req.params);
    const body = parseOrBadRequest(McpResourceReadRequestSchema, req.body);
    try {
      const result = await manager.readResource(id, body);
      return snapshotMcpResource(id, body.uri, result.result);
    } catch (error) {
      throw toMcpHttpError(error);
    }
  });
}
