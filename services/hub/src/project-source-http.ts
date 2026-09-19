import {
  ProjectIdSchema,
  ProjectSourceAttachRequestSchema,
  ProjectSourceBindingSchema,
  ProjectSourceDetachRequestSchema,
  ProjectSourceListResponseSchema,
  ProjectSourceViewSchema,
  WorkspaceIdSchema,
  makeId,
  projectSourceOwner,
  type ProjectSourceBinding,
  type ProjectSourceView,
  type Timestamp,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  ConflictError,
  NotFoundError,
  RemoteServiceError,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import type { HubRepository } from "./repository.js";
import {
  ProjectArchivedError,
  ProjectNotFoundError,
  ProjectWorkspaceConflictError,
  type ProjectRegistry,
} from "./project-registry.js";
import type { ProjectSourceRegistry } from "./project-source-registry.js";

const ParamsSchema = z.object({ id: ProjectIdSchema });
const WorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema });

export interface ProjectSourceOwnerOptions {
  readonly contextUrl: string;
  readonly spaceUrl: string;
  readonly flowUrl: string;
  readonly connectUrl: string;
  readonly internalToken?: string | undefined;
}

function mapProjectError(error: unknown): unknown {
  if (error instanceof ProjectNotFoundError) return new NotFoundError(error.message);
  if (error instanceof ProjectWorkspaceConflictError || error instanceof ProjectArchivedError)
    return new ConflictError(error.message);
  return error;
}

function ownerUnavailable(owner: string, error: unknown): never {
  if (
    error instanceof RemoteServiceError &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    throw new NotFoundError(`${owner} source tidak tersedia atau tidak diizinkan.`);
  }
  throw new BadGatewayError(`${owner} source owner tidak dapat diverifikasi.`);
}

async function resolveOwner(
  binding: ProjectSourceBinding,
  options: ProjectSourceOwnerOptions,
): Promise<unknown> {
  const token = options.internalToken;
  try {
    switch (binding.resourceType) {
      case "artifact": {
        const params = new URLSearchParams({
          scope: "personal",
          maxSensitivity: "RESTRICTED",
          hostedEligible: "0",
        });
        return await httpJson(
          `${options.contextUrl}/v1/artifacts/${encodeURIComponent(binding.resourceId)}/authorize?${params.toString()}`,
          { token },
        );
      }
      case "space-page": {
        return await httpJson(
          `${options.spaceUrl}/v1/pages/${encodeURIComponent(binding.resourceId)}?workspaceId=${encodeURIComponent(binding.workspaceId)}`,
          { token },
        );
      }
      case "flow-graph": {
        const raw = await httpJson<{ graphs?: unknown[] }>(
          `${options.flowUrl}/v1/graphs?workspaceId=${encodeURIComponent(binding.workspaceId)}`,
          { token },
        );
        const graphs = Array.isArray(raw.graphs) ? raw.graphs : [];
        const match = graphs.find(
          (graph) =>
            typeof graph === "object" &&
            graph !== null &&
            "graphId" in graph &&
            (graph as { graphId?: unknown }).graphId === binding.resourceId,
        );
        if (match === undefined)
          throw new NotFoundError("Flow source tidak tersedia untuk Workspace Project.");
        const graph = match as {
          graphId?: unknown;
          name?: unknown;
          workspaceId?: unknown;
          projectId?: unknown;
          currentVersion?: unknown;
        };
        return {
          graphId: graph.graphId,
          name: graph.name,
          workspaceId: graph.workspaceId,
          projectId: graph.projectId,
          currentVersion: graph.currentVersion,
        };
      }
      case "mcp-server": {
        const raw = await httpJson<{ servers?: unknown[] }>(
          `${options.connectUrl}/v1/mcp-outbound/servers?workspaceId=${encodeURIComponent(binding.workspaceId)}`,
          { token },
        );
        const servers = Array.isArray(raw.servers) ? raw.servers : [];
        const match = servers.find(
          (server) =>
            typeof server === "object" &&
            server !== null &&
            "id" in server &&
            (server as { id?: unknown }).id === binding.resourceId,
        );
        if (match === undefined)
          throw new NotFoundError("MCP server tidak tersedia untuk Workspace Project.");
        const server = match as {
          id?: unknown;
          displayName?: unknown;
          enabled?: unknown;
          workspaceIds?: unknown;
        };
        return {
          id: server.id,
          displayName: server.displayName,
          enabled: server.enabled,
          workspaceIds: server.workspaceIds,
        };
      }
      case "url":
        return { url: binding.resourceId };
    }
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    return ownerUnavailable(binding.owner, error);
  }
}

async function viewBinding(
  binding: ProjectSourceBinding,
  options: ProjectSourceOwnerOptions,
): Promise<ProjectSourceView> {
  try {
    const metadata = await resolveOwner(binding, options);
    return ProjectSourceViewSchema.parse({
      binding,
      availability: "AVAILABLE",
      metadata,
      unavailableReason: null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Source owner tidak tersedia.";
    return ProjectSourceViewSchema.parse({
      binding,
      availability: "UNAVAILABLE",
      metadata: null,
      unavailableReason: reason,
    });
  }
}

export function registerProjectSourceRoutes(
  app: FastifyInstance,
  projects: ProjectRegistry,
  sources: ProjectSourceRegistry,
  repo: HubRepository,
  options: ProjectSourceOwnerOptions,
): void {
  app.get<{ Params: { id: string } }>("/v1/projects/:id/sources", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const { workspaceId } = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    try {
      projects.require(id, workspaceId, true);
    } catch (error) {
      throw mapProjectError(error);
    }
    const bindings = sources.list(id, workspaceId);
    const views = await Promise.all(bindings.map((binding) => viewBinding(binding, options)));
    return ProjectSourceListResponseSchema.parse({ sources: views });
  });

  app.post<{ Params: { id: string } }>("/v1/projects/:id/sources", async (req, reply) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const body = parseOrBadRequest(ProjectSourceAttachRequestSchema, req.body);
    try {
      projects.require(id, body.workspaceId);
    } catch (error) {
      throw mapProjectError(error);
    }

    const candidate = ProjectSourceBindingSchema.parse({
      projectId: id,
      workspaceId: body.workspaceId,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      owner: projectSourceOwner(body.resourceType),
      role: body.role,
      createdAt: nowIso(),
    });
    const metadata = await resolveOwner(candidate, options);

    const result = sources.attach({
      projectId: id,
      workspaceId: body.workspaceId,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      role: body.role,
      createdAt: candidate.createdAt as Timestamp,
    });
    if (result.created) {
      repo.recordAuditEvent({
        type: "PROJECT_SOURCE_ATTACHED",
        operationId: makeId("operation"),
        module: "Hub",
        detail: {
          projectId: id,
          workspaceId: body.workspaceId,
          resourceType: body.resourceType,
          resourceId: body.resourceId,
          owner: result.binding.owner,
          role: body.role,
        },
        now: candidate.createdAt as Timestamp,
      });
    }
    return reply.code(result.created ? 201 : 200).send(
      ProjectSourceViewSchema.parse({
        binding: result.binding,
        availability: "AVAILABLE",
        metadata,
        unavailableReason: null,
      }),
    );
  });

  app.delete<{ Params: { id: string } }>("/v1/projects/:id/sources", async (req, reply) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const body = parseOrBadRequest(ProjectSourceDetachRequestSchema, req.body);
    try {
      projects.require(id, body.workspaceId, true);
    } catch (error) {
      throw mapProjectError(error);
    }
    const removed = sources.detach({
      projectId: id,
      workspaceId: body.workspaceId,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      role: body.role,
    });
    if (removed === null) throw new NotFoundError("Project source binding tidak ditemukan.");
    const now = nowIso() as Timestamp;
    repo.recordAuditEvent({
      type: "PROJECT_SOURCE_DETACHED",
      operationId: makeId("operation"),
      module: "Hub",
      detail: {
        projectId: id,
        workspaceId: body.workspaceId,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        owner: removed.owner,
        role: body.role,
      },
      now,
    });
    return reply.code(200).send({ detached: true, binding: removed });
  });
}
