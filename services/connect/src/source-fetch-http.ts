import { ExternalUrlFetchRequestSchema } from "@ecorione/shared-schema";
import { HttpError, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
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
