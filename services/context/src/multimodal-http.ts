import {
  AttachmentIdSchema,
  ContextAttachmentStateRequestSchema,
  ContextCreateAttachmentRequestSchema,
  ContextDerivationRequestSchema,
  ContextMultimodalContextRequestSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  MultimodalAttachmentConflictError,
  MultimodalAttachmentNotFoundError,
  MultimodalDerivationConflictError,
  type MultimodalRepository,
} from "./multimodal-repository.js";

const AttachmentQuerySchema = z.object({ workspaceId: WorkspaceIdSchema });

function toHttpError(error: unknown): unknown {
  if (error instanceof MultimodalAttachmentNotFoundError) return new NotFoundError(error.message);
  if (
    error instanceof MultimodalAttachmentConflictError ||
    error instanceof MultimodalDerivationConflictError
  ) {
    return new ConflictError(error.message);
  }
  return error instanceof Error ? new BadRequestError(error.message) : error;
}

export function registerMultimodalRoutes(
  app: FastifyInstance,
  repo: MultimodalRepository,
): void {
  app.post("/v1/multimodal/attachments", async (req, reply) => {
    const body = parseOrBadRequest(ContextCreateAttachmentRequestSchema, req.body);
    try {
      const existing = repo.getAttachment(body.id, body.workspaceId);
      const attachment = repo.createAttachment(body);
      return reply.code(existing === null ? 201 : 200).send(attachment);
    } catch (error) {
      throw toHttpError(error);
    }
  });

  app.get<{ Params: { id: string } }>("/v1/multimodal/attachments/:id", async (req) => {
    const id = parseOrBadRequest(AttachmentIdSchema, req.params.id);
    const query = parseOrBadRequest(AttachmentQuerySchema, req.query);
    try {
      return repo.requireAttachment(id, query.workspaceId);
    } catch (error) {
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string } }>(
    "/v1/multimodal/attachments/:id/processing",
    async (req) => {
      const id = parseOrBadRequest(AttachmentIdSchema, req.params.id);
      const body = parseOrBadRequest(ContextAttachmentStateRequestSchema, req.body);
      try {
        return repo.markProcessing(id, body.workspaceId, body.now);
      } catch (error) {
        throw toHttpError(error);
      }
    },
  );

  app.post<{ Params: { id: string } }>("/v1/multimodal/attachments/:id/failed", async (req) => {
    const id = parseOrBadRequest(AttachmentIdSchema, req.params.id);
    const body = parseOrBadRequest(ContextAttachmentStateRequestSchema, req.body);
    if (body.error === undefined) throw new BadRequestError("error wajib untuk state FAILED.");
    try {
      return repo.markFailed(id, body.workspaceId, body.error, body.now);
    } catch (error) {
      throw toHttpError(error);
    }
  });

  app.post("/v1/multimodal/derivations", async (req, reply) => {
    const body = parseOrBadRequest(ContextDerivationRequestSchema, req.body);
    try {
      return reply.code(201).send(repo.appendDerivation(body));
    } catch (error) {
      throw toHttpError(error);
    }
  });

  app.post("/v1/multimodal/context", async (req) => {
    const body = parseOrBadRequest(ContextMultimodalContextRequestSchema, req.body);
    return repo.context(body);
  });
}
