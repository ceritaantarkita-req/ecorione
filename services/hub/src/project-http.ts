import {
  ProjectArchiveRequestSchema,
  ProjectCreateRequestSchema,
  ProjectIdSchema,
  ProjectUpdateRequestSchema,
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
import { nowIso } from "./clock.js";
import {
  DefaultProjectArchiveError,
  ProjectArchivedError,
  ProjectNotFoundError,
  ProjectRequiredError,
  ProjectWorkspaceConflictError,
} from "./project-registry.js";
import type { ProjectRegistry } from "./project-registry.js";

const ListQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema,
  includeArchived: z
    .enum(["0", "1"])
    .optional()
    .transform((value) => value === "1"),
});
const ParamsSchema = z.object({ id: ProjectIdSchema });

function projectError(error: unknown): unknown {
  if (error instanceof ProjectNotFoundError) return new NotFoundError(error.message);
  if (
    error instanceof ProjectWorkspaceConflictError ||
    error instanceof ProjectArchivedError ||
    error instanceof DefaultProjectArchiveError
  )
    return new ConflictError(error.message);
  if (error instanceof ProjectRequiredError) return new BadRequestError(error.message);
  return error;
}

export function registerProjectRoutes(app: FastifyInstance, projects: ProjectRegistry): void {
  app.get("/v1/projects", async (req) => {
    const query = parseOrBadRequest(ListQuerySchema, req.query);
    return { projects: projects.list(query.workspaceId, query.includeArchived) };
  });

  app.post("/v1/projects", async (req, reply) => {
    const body = parseOrBadRequest(ProjectCreateRequestSchema, req.body);
    return reply.code(201).send(projects.create(body, nowIso()));
  });

  app.get<{ Params: { id: string } }>("/v1/projects/:id", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const workspaceId = parseOrBadRequest(
      z.object({ workspaceId: WorkspaceIdSchema }),
      req.query,
    ).workspaceId;
    try {
      return projects.require(id, workspaceId);
    } catch (error) {
      throw projectError(error);
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/projects/:id", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const body = parseOrBadRequest(ProjectUpdateRequestSchema, req.body);
    try {
      return projects.update(id, body, nowIso());
    } catch (error) {
      throw projectError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/projects/:id/archive", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const body = parseOrBadRequest(ProjectArchiveRequestSchema, req.body);
    try {
      return projects.archive(id, body.workspaceId, nowIso());
    } catch (error) {
      throw projectError(error);
    }
  });
}
