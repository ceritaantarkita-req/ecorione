/**
 * Route HTTP Connect — `docs/api-fase1.md` §Connect. Satu endpoint inti: `POST /v1/complete`.
 */

import { ToolDefinitionSchema } from "@ecorione/context-assembly";
import {
  CoreMemorySchema,
  OperationIdSchema,
  SensitivitySchema,
} from "@ecorione/shared-schema";
import { BadGatewayError, createServer, parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ExactMatchCache } from "./cache.js";
import { complete, type CompleteDeps } from "./complete.js";
import { MissingCredentialError, ProviderError } from "./providers/errors.js";

/** Memetakan kegagalan provider/kredensial ke 502 — bukan 500 (`docs/api-fase1.md`). */
function toHttpError(err: unknown): unknown {
  if (err instanceof MissingCredentialError) return new BadGatewayError(err.message);
  if (err instanceof ProviderError) return new BadGatewayError(err.message);
  return err;
}

const StablePrefixBodySchema = z.object({
  systemPrompt: z.string(),
  toolDefinitions: z.array(ToolDefinitionSchema),
  coreMemory: CoreMemorySchema,
});

const CompleteBodySchema = z.object({
  target: z.enum(["hosted", "local"]),
  prefix: StablePrefixBodySchema,
  dynamicText: z.string(),
  userMessage: z.string().min(1),
  sensitivity: SensitivitySchema,
  operationId: OperationIdSchema,
  now: z.string().datetime({ offset: false }),
});

export interface BuildConnectServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  /** `undefined` kalau `.env` belum diisi — gerbang di `complete.ts`, bukan diam-diam gagal. */
  readonly anthropicApiKey?: string | undefined;
  readonly localBaseUrl: string;
  readonly localModelTag: string;
  /** Diinjeksikan supaya test bisa memeriksa isi cache secara langsung kalau perlu. */
  readonly cache?: ExactMatchCache | undefined;
}

export function buildConnectServer(options: BuildConnectServerOptions): FastifyInstance {
  const app = createServer({ name: "connect", token: options.token, logger: options.logger });
  const deps: CompleteDeps = {
    anthropicApiKey: options.anthropicApiKey,
    localBaseUrl: options.localBaseUrl,
    localModelTag: options.localModelTag,
    cache: options.cache ?? new ExactMatchCache(),
  };

  app.post("/v1/complete", async (req) => {
    const body = parseOrBadRequest(CompleteBodySchema, req.body);
    try {
      return await complete(deps, body);
    } catch (err) {
      throw toHttpError(err);
    }
  });

  return app;
}
