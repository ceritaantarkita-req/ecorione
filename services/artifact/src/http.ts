/** HTTP boundary for Artifact CAS. */
import {
  ArtifactIdSchema,
  ScopeSchema,
  SensitivitySchema,
  SyncClassSchema,
  type ArtifactPointer,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  createServer,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ArtifactMetadataClient } from "./context-client.js";
import { normalizedSyncClass } from "./context-client.js";
import { ArtifactIntegrityError } from "./store.js";
import type { ArtifactStore } from "./store.js";

export const DEFAULT_MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;

const UploadSchema = z.object({
  contentBase64: z.string().min(1),
  mimeType: z.string().min(1).max(128),
  description: z.string().min(1).max(200),
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  syncClass: SyncClassSchema.optional(),
});
const ContentQuerySchema = z.object({
  scope: ScopeSchema,
  maxSensitivity: SensitivitySchema.default("RESTRICTED"),
  hostedEligible: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => v === "1"),
});

export interface BuildArtifactServerOptions {
  readonly token?: string | undefined;
  readonly logger?: boolean | undefined;
  readonly maxBytes?: number | undefined;
}

function decodeBase64(value: string): Buffer {
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength === 0)
    throw new BadRequestError("Artifact kosong atau base64 tidak valid.");
  return bytes;
}

export function buildArtifactServer(
  store: ArtifactStore,
  metadata: ArtifactMetadataClient,
  options: BuildArtifactServerOptions = {},
): FastifyInstance {
  const app = createServer({ name: "artifact", token: options.token, logger: options.logger });
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;

  app.post("/v1/artifacts", async (req, reply) => {
    const body = parseOrBadRequest(UploadSchema, req.body);
    const content = decodeBase64(body.contentBase64);
    if (content.byteLength > maxBytes) {
      throw new BadRequestError(`Artifact melewati batas ${String(maxBytes)} byte.`);
    }
    const stored = store.put(content);
    const pointer: ArtifactPointer = {
      id: stored.id,
      path: stored.path,
      description: body.description,
      mimeType: body.mimeType,
      sizeBytes: stored.sizeBytes,
      scope: body.scope,
      sensitivity: body.sensitivity,
      syncClass: normalizedSyncClass(body.syncClass),
    };
    const registered = await metadata.register(pointer);
    return reply.code(stored.deduplicated ? 200 : 201).send({
      pointer: registered,
      deduplicated: stored.deduplicated,
    });
  });

  app.get<{ Params: { id: string } }>("/v1/artifacts/:id/content", async (req, reply) => {
    const id = parseOrBadRequest(ArtifactIdSchema, req.params.id);
    const query = parseOrBadRequest(ContentQuerySchema, req.query);
    const pointer = await metadata.authorize({
      id,
      scope: query.scope,
      maxSensitivity: query.maxSensitivity,
      hostedEligible: query.hostedEligible,
    });
    try {
      const content = store.read(id);
      if (content.byteLength !== pointer.sizeBytes) {
        throw new ArtifactIntegrityError(`Ukuran content ${id} berbeda dari metadata Context.`);
      }
      return reply.type(pointer.mimeType).send(content);
    } catch (err) {
      if (err instanceof ArtifactIntegrityError) throw err;
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        throw new NotFoundError(`Blob artifact tidak ditemukan: ${id}`);
      }
      throw err;
    }
  });

  return app;
}
