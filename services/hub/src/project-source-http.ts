import {
  ArtifactPointerSchema,
  EpisodeSchema,
  ExternalMcpResourceFetchResponseSchema,
  ExternalUrlFetchResponseSchema,
  MultimodalAdapterResultSchema,
  McpServerRefSchema,
  ProjectIdSchema,
  ProjectMcpResourceIngestRequestSchema,
  ProjectMcpResourceIngestResponseSchema,
  ProjectSourceExtractRequestSchema,
  ProjectSourceExtractResponseSchema,
  ProjectUrlIngestRequestSchema,
  ProjectUrlIngestResponseSchema,
  ProjectSourceAttachRequestSchema,
  ProjectSourceBindingSchema,
  ProjectSourceDetachRequestSchema,
  ProjectSourceListResponseSchema,
  ProjectSourceViewSchema,
  WorkspaceIdSchema,
  makeId,
  projectSourceOwner,
  type Episode,
  type MultimodalAdapterResult,
  type ProjectMcpResourceIngestResponse,
  type ProjectSourceBinding,
  type ProjectSourceExtractResponse,
  type ProjectSourceView,
  type ProjectUrlIngestResponse,
  type Timestamp,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  ConflictError,
  HttpError,
  NotFoundError,
  RemoteServiceError,
  httpJson,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CapabilityRegistry } from "./capability-registry.js";
import { nowIso } from "./clock.js";
import {
  analyzeTaskForMimeType,
  artifactContentBase64,
  authorizeInference,
  semanticMultimodalResult,
} from "./multimodal-analysis.js";
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
const McpResourcesQuerySchema = z.object({
  workspaceId: WorkspaceIdSchema,
  serverId: McpServerRefSchema,
});
const McpResourceViewSchema = z.object({
  uri: z.string().min(1).max(4096),
  name: z.string().optional(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});
const McpDiscoveryResponseSchema = z.object({
  resources: z.array(McpResourceViewSchema),
  errors: z.object({ resources: z.string().optional() }).optional(),
});
const ArtifactUploadResponseSchema = z.object({
  pointer: ArtifactPointerSchema,
  deduplicated: z.boolean(),
});

export interface ProjectSourceOwnerOptions {
  readonly contextUrl: string;
  readonly spaceUrl: string;
  readonly flowUrl: string;
  readonly connectUrl: string;
  readonly artifactUrl: string;
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
  authority: CapabilityRegistry,
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

  app.get<{ Params: { id: string } }>("/v1/projects/:id/sources/mcp-resources", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const { workspaceId, serverId } = parseOrBadRequest(McpResourcesQuerySchema, req.query);
    try {
      projects.require(id, workspaceId);
    } catch (error) {
      throw mapProjectError(error);
    }
    const serverBinding = sources
      .list(id, workspaceId)
      .find(
        (candidate) =>
          candidate.resourceType === "mcp-server" && candidate.resourceId === serverId,
      );
    if (serverBinding === undefined) {
      throw new NotFoundError("MCP server belum terikat sebagai Project Source.");
    }

    const operationId = makeId("operation");
    try {
      const discovered = McpDiscoveryResponseSchema.parse(
        await httpJson(
          `${options.connectUrl}/v1/mcp-outbound/servers/${encodeURIComponent(serverId)}/discover`,
          {
            method: "POST",
            token: options.internalToken,
            body: {
              workspaceId,
              operationId,
              scope: "personal",
              sensitivity: "RESTRICTED",
              autonomy: "L1",
              now: nowIso(),
            },
          },
        ),
      );
      return {
        serverId,
        resources: discovered.resources,
        warning: discovered.errors?.resources ?? null,
      };
    } catch (error) {
      if (error instanceof RemoteServiceError) {
        throw new BadGatewayError(`Connect MCP discovery gagal: ${error.message}`);
      }
      throw error;
    }
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

  app.post<{ Params: { id: string } }>(
    "/v1/projects/:id/sources/ingest-mcp-resource",
    async (req) => {
      const { id } = parseOrBadRequest(ParamsSchema, req.params);
      const body = parseOrBadRequest(ProjectMcpResourceIngestRequestSchema, req.body);
      try {
        projects.require(id, body.workspaceId);
      } catch (error) {
        throw mapProjectError(error);
      }

      const serverBinding = sources
        .list(id, body.workspaceId)
        .find(
          (candidate) =>
            candidate.resourceType === "mcp-server" &&
            candidate.resourceId === body.serverId &&
            candidate.role === body.role,
        );
      if (serverBinding === undefined) {
        throw new NotFoundError("MCP server belum terikat sebagai Project Source.");
      }

      const idempotencyKey = `project-mcp-resource-ingest:${body.operationId}`;
      const prior = repo.getIdempotentResult<ProjectMcpResourceIngestResponse>(idempotencyKey);
      if (prior !== null) {
        repo.recordAuditEvent({
          type: "ACTION_SKIPPED_IDEMPOTENT",
          operationId: body.operationId,
          module: "Hub",
          detail: {
            idempotencyKey,
            projectId: id,
            serverId: body.serverId,
            resourceUri: body.resourceUri,
          },
          now: nowIso(),
        });
        return ProjectMcpResourceIngestResponseSchema.parse(prior.result);
      }

      const now = nowIso();
      let fetched: ReturnType<typeof ExternalMcpResourceFetchResponseSchema.parse>;
      try {
        fetched = ExternalMcpResourceFetchResponseSchema.parse(
          await httpJson(
            `${options.connectUrl}/v1/source-fetch/mcp-resource/${encodeURIComponent(body.serverId)}`,
            {
              method: "POST",
              token: options.internalToken,
              body: {
                workspaceId: body.workspaceId,
                operationId: body.operationId,
                scope: "personal",
                sensitivity: "RESTRICTED",
                autonomy: "L1",
                now,
                uri: body.resourceUri,
              },
            },
          ),
        );
      } catch (error) {
        if (error instanceof RemoteServiceError) {
          if (error.statusCode >= 400 && error.statusCode < 500) {
            throw new HttpError(
              error.statusCode,
              "MCP_RESOURCE_REJECTED",
              `Connect MCP resource ingestion: ${error.message}`,
            );
          }
          if (error.statusCode === 504) {
            throw new HttpError(
              504,
              "MCP_RESOURCE_TIMEOUT",
              "Connect MCP resource ingestion timeout.",
            );
          }
        }
        throw new BadGatewayError("Connect MCP resource ingestion tidak tersedia.");
      }

      let uploaded: ReturnType<typeof ArtifactUploadResponseSchema.parse>;
      try {
        uploaded = ArtifactUploadResponseSchema.parse(
          await httpJson(`${options.artifactUrl}/v1/artifacts`, {
            method: "POST",
            token: options.internalToken,
            body: {
              contentBase64: fetched.contentBase64,
              mimeType: fetched.mimeType,
              description: `MCP ${body.serverId}: ${body.resourceUri}`.slice(0, 200),
              scope: "personal",
              sensitivity: "RESTRICTED",
              syncClass: "LOCAL_ONLY",
            },
          }),
        );
      } catch (error) {
        if (error instanceof RemoteServiceError) {
          throw new BadGatewayError(`Artifact MCP snapshot gagal: ${error.message}`);
        }
        throw error;
      }
      if (
        uploaded.pointer.scope !== "personal" ||
        uploaded.pointer.sensitivity !== "RESTRICTED" ||
        uploaded.pointer.syncClass !== "LOCAL_ONLY"
      ) {
        throw new BadGatewayError(
          "Artifact MCP snapshot mengembalikan privacy metadata yang tidak sesuai.",
        );
      }

      const candidate = ProjectSourceBindingSchema.parse({
        projectId: id,
        workspaceId: body.workspaceId,
        resourceType: "artifact",
        resourceId: uploaded.pointer.id,
        owner: projectSourceOwner("artifact"),
        role: body.role,
        createdAt: now,
      });
      const metadata = await resolveOwner(candidate, options);
      const attached = sources.attach({
        projectId: id,
        workspaceId: body.workspaceId,
        resourceType: "artifact",
        resourceId: uploaded.pointer.id,
        role: body.role,
        createdAt: candidate.createdAt as Timestamp,
      });
      if (attached.created) {
        repo.recordAuditEvent({
          type: "PROJECT_SOURCE_ATTACHED",
          operationId: body.operationId,
          module: "Hub",
          detail: {
            projectId: id,
            workspaceId: body.workspaceId,
            resourceType: "artifact",
            resourceId: uploaded.pointer.id,
            owner: attached.binding.owner,
            role: body.role,
            derivedFromMcp: {
              serverId: body.serverId,
              resourceUri: body.resourceUri,
            },
          },
          now,
        });
      }

      const source = ProjectSourceViewSchema.parse({
        binding: attached.binding,
        availability: "AVAILABLE",
        metadata,
        unavailableReason: null,
      });
      const response = ProjectMcpResourceIngestResponseSchema.parse({
        operationId: body.operationId,
        projectId: id,
        workspaceId: body.workspaceId,
        serverId: body.serverId,
        resourceUri: body.resourceUri,
        artifact: uploaded.pointer,
        source,
        state: "READY",
      });
      repo.saveIdempotentResult(
        idempotencyKey,
        body.operationId,
        "project-source.ingest-mcp-resource",
        response,
        now,
      );
      repo.recordAuditEvent({
        type: "PROJECT_SOURCE_INGESTED",
        operationId: body.operationId,
        module: "Hub",
        detail: {
          projectId: id,
          workspaceId: body.workspaceId,
          sourceType: "mcp-resource",
          serverId: body.serverId,
          resourceUri: body.resourceUri,
          artifactId: uploaded.pointer.id,
          deduplicated: uploaded.deduplicated,
          sizeBytes: fetched.sizeBytes,
          mimeType: fetched.mimeType,
        },
        now,
      });
      return response;
    },
  );

  app.post<{ Params: { id: string } }>("/v1/projects/:id/sources/ingest-url", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const body = parseOrBadRequest(ProjectUrlIngestRequestSchema, req.body);
    try {
      projects.require(id, body.workspaceId);
    } catch (error) {
      throw mapProjectError(error);
    }

    const urlBinding = sources
      .list(id, body.workspaceId)
      .find(
        (candidate) =>
          candidate.resourceType === "url" &&
          candidate.resourceId === body.url &&
          candidate.role === body.role,
      );
    if (urlBinding === undefined) {
      throw new NotFoundError("URL belum terikat sebagai Project Source.");
    }

    const idempotencyKey = `project-url-ingest:${body.operationId}`;
    const prior = repo.getIdempotentResult<ProjectUrlIngestResponse>(idempotencyKey);
    if (prior !== null) {
      repo.recordAuditEvent({
        type: "ACTION_SKIPPED_IDEMPOTENT",
        operationId: body.operationId,
        module: "Hub",
        detail: {
          idempotencyKey,
          projectId: id,
          url: body.url,
        },
        now: nowIso(),
      });
      return ProjectUrlIngestResponseSchema.parse(prior.result);
    }

    let fetched: ReturnType<typeof ExternalUrlFetchResponseSchema.parse>;
    try {
      fetched = ExternalUrlFetchResponseSchema.parse(
        await httpJson(`${options.connectUrl}/v1/source-fetch/url`, {
          method: "POST",
          token: options.internalToken,
          body: { url: body.url },
        }),
      );
    } catch (error) {
      if (error instanceof RemoteServiceError) {
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw new HttpError(
            error.statusCode,
            "URL_SOURCE_REJECTED",
            `Connect URL ingestion: ${error.message}`,
          );
        }
        if (error.statusCode === 504) {
          throw new HttpError(504, "URL_SOURCE_TIMEOUT", "Connect URL ingestion timeout.");
        }
      }
      throw new BadGatewayError("Connect URL ingestion tidak tersedia.");
    }

    let uploaded: ReturnType<typeof ArtifactUploadResponseSchema.parse>;
    try {
      uploaded = ArtifactUploadResponseSchema.parse(
        await httpJson(`${options.artifactUrl}/v1/artifacts`, {
          method: "POST",
          token: options.internalToken,
          body: {
            contentBase64: fetched.contentBase64,
            mimeType: fetched.mimeType,
            description: `URL snapshot: ${body.url}`.slice(0, 200),
            scope: "personal",
            sensitivity: "INTERNAL",
            syncClass: "LOCAL_ONLY",
          },
        }),
      );
    } catch (error) {
      if (error instanceof RemoteServiceError) {
        throw new BadGatewayError(`Artifact URL snapshot gagal: ${error.message}`);
      }
      throw error;
    }

    const candidate = ProjectSourceBindingSchema.parse({
      projectId: id,
      workspaceId: body.workspaceId,
      resourceType: "artifact",
      resourceId: uploaded.pointer.id,
      owner: projectSourceOwner("artifact"),
      role: body.role,
      createdAt: nowIso(),
    });
    const metadata = await resolveOwner(candidate, options);
    const attached = sources.attach({
      projectId: id,
      workspaceId: body.workspaceId,
      resourceType: "artifact",
      resourceId: uploaded.pointer.id,
      role: body.role,
      createdAt: candidate.createdAt as Timestamp,
    });
    if (attached.created) {
      repo.recordAuditEvent({
        type: "PROJECT_SOURCE_ATTACHED",
        operationId: body.operationId,
        module: "Hub",
        detail: {
          projectId: id,
          workspaceId: body.workspaceId,
          resourceType: "artifact",
          resourceId: uploaded.pointer.id,
          owner: attached.binding.owner,
          role: body.role,
          derivedFromUrl: body.url,
        },
        now: candidate.createdAt as Timestamp,
      });
    }

    const source = ProjectSourceViewSchema.parse({
      binding: attached.binding,
      availability: "AVAILABLE",
      metadata,
      unavailableReason: null,
    });
    const response = ProjectUrlIngestResponseSchema.parse({
      operationId: body.operationId,
      projectId: id,
      workspaceId: body.workspaceId,
      url: body.url,
      artifact: uploaded.pointer,
      source,
      state: "READY",
    });
    const now = nowIso();
    repo.saveIdempotentResult(
      idempotencyKey,
      body.operationId,
      "project-source.ingest-url",
      response,
      now,
    );
    repo.recordAuditEvent({
      type: "PROJECT_SOURCE_INGESTED",
      operationId: body.operationId,
      module: "Hub",
      detail: {
        projectId: id,
        workspaceId: body.workspaceId,
        sourceType: "url",
        sourceUrl: body.url,
        artifactId: uploaded.pointer.id,
        deduplicated: uploaded.deduplicated,
        sizeBytes: fetched.sizeBytes,
        mimeType: fetched.mimeType,
      },
      now,
    });
    return response;
  });

  app.post<{ Params: { id: string } }>("/v1/projects/:id/sources/extract", async (req) => {
    const { id } = parseOrBadRequest(ParamsSchema, req.params);
    const body = parseOrBadRequest(ProjectSourceExtractRequestSchema, req.body);
    try {
      projects.require(id, body.workspaceId);
    } catch (error) {
      throw mapProjectError(error);
    }

    const binding = sources
      .list(id, body.workspaceId)
      .find(
        (candidate) =>
          candidate.resourceType === "artifact" && candidate.resourceId === body.artifactId,
      );
    if (binding === undefined) {
      throw new NotFoundError("Artifact belum terikat sebagai Project Source.");
    }

    const idempotencyKey = `project-source-extract:${body.operationId}`;
    const prior = repo.getIdempotentResult<ProjectSourceExtractResponse>(idempotencyKey);
    if (prior !== null) {
      repo.recordAuditEvent({
        type: "ACTION_SKIPPED_IDEMPOTENT",
        operationId: body.operationId,
        module: "Hub",
        detail: {
          idempotencyKey,
          projectId: id,
          sourceArtifactId: body.artifactId,
        },
        now: nowIso(),
      });
      return ProjectSourceExtractResponseSchema.parse(prior.result);
    }

    const pointerResult = ArtifactPointerSchema.safeParse(await resolveOwner(binding, options));
    if (!pointerResult.success) {
      throw new BadGatewayError("Artifact owner mengembalikan metadata yang tidak valid.");
    }
    const pointer = pointerResult.data;
    const task = analyzeTaskForMimeType(pointer.mimeType);
    const now = nowIso();

    authorizeInference({
      authority,
      repo,
      workspaceId: body.workspaceId,
      operationId: body.operationId,
      routes: ["local"],
      scope: pointer.scope,
      sensitivity: pointer.sensitivity,
      syncClass: pointer.syncClass ?? "LOCAL_ONLY",
      now,
    });

    const contentBase64 = await artifactContentBase64(options, pointer);
    let inferred: MultimodalAdapterResult;
    try {
      inferred = MultimodalAdapterResultSchema.parse(
        await httpJson(`${options.connectUrl}/v1/multimodal/infer`, {
          method: "POST",
          token: options.internalToken,
          body: {
            operationId: body.operationId,
            task,
            route: { preferred: "local", allowHostedFallback: false },
            syncClass: pointer.syncClass ?? "LOCAL_ONLY",
            mimeType: pointer.mimeType,
            contentBase64,
          },
        }),
      );
    } catch (error) {
      if (error instanceof RemoteServiceError) {
        throw new BadGatewayError(`Connect extraction gagal: ${error.message}`);
      }
      throw error;
    }
    if (inferred.audioBase64 !== undefined || inferred.audioMimeType !== undefined) {
      throw new BadGatewayError(
        "Adapter Project extraction mengembalikan audio yang tidak diminta.",
      );
    }

    const semantic = semanticMultimodalResult(inferred);
    let episode: Episode;
    try {
      episode = EpisodeSchema.parse(
        await httpJson(`${options.contextUrl}/v1/episodes`, {
          method: "POST",
          token: options.internalToken,
          body: {
            ts: now,
            rawText: semantic.text,
            projectId: id,
            provenance: {
              sourceApp: "hub:project-source",
              toolCallId: body.operationId,
              sourceUri: `artifact:${body.artifactId}`,
            },
            scope: pointer.scope,
            sensitivity: pointer.sensitivity,
            syncClass: pointer.syncClass ?? "LOCAL_ONLY",
            trust: inferred.routeUsed === "hosted" ? "HOSTED_AGENT" : "LOCAL_AGENT",
          },
        }),
      );
      await httpJson(`${options.contextUrl}/v1/multimodal/derivations`, {
        method: "POST",
        token: options.internalToken,
        body: {
          operationId: body.operationId,
          projectId: id,
          sourceArtifactId: body.artifactId,
          episodeId: episode.id,
          task,
          result: semantic,
          scope: pointer.scope,
          sensitivity: pointer.sensitivity,
          syncClass: pointer.syncClass ?? "LOCAL_ONLY",
          trust: inferred.routeUsed === "hosted" ? "HOSTED_AGENT" : "LOCAL_AGENT",
          createdAt: now,
        },
      });
    } catch (error) {
      if (error instanceof RemoteServiceError) {
        throw new BadGatewayError(`Context extraction gagal: ${error.message}`);
      }
      throw error;
    }

    const response = ProjectSourceExtractResponseSchema.parse({
      operationId: body.operationId,
      projectId: id,
      workspaceId: body.workspaceId,
      sourceArtifactId: body.artifactId,
      task,
      state: "READY",
      result: semantic,
      contextEpisodeId: episode.id,
    });
    repo.saveIdempotentResult(
      idempotencyKey,
      body.operationId,
      "project-source.extract",
      response,
      now,
    );
    repo.recordAuditEvent({
      type: "PROJECT_SOURCE_EXTRACTED",
      operationId: body.operationId,
      module: "Hub",
      detail: {
        projectId: id,
        workspaceId: body.workspaceId,
        sourceArtifactId: body.artifactId,
        contextEpisodeId: episode.id,
        task,
        routeUsed: inferred.routeUsed,
      },
      now,
    });
    return response;
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
