import { WorkspaceIdSchema } from "@ecorione/shared-schema";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  HttpError,
  NotFoundError,
  observabilityFor,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { McpApprovalRequiredError, McpPolicyDeniedError } from "./governance.js";
import {
  McpInvocationConflictError,
  McpInvocationOutcomeUncertainError,
  McpInvocationStoreError,
} from "./invocation-store.js";
import {
  McpRemoteOutcomeUncertainError,
  McpServerDisabledError,
  McpToolDisabledError,
  McpToolNotAdvertisedError,
  type McpManager,
} from "./manager.js";
import { McpRegistryError, McpServerNotFoundError } from "./registry.js";
import {
  McpClientTimeoutError,
  McpCredentialMissingError,
  McpTransportDeniedError,
} from "./sdk-client.js";
import {
  McpDiscoverRequestSchema,
  McpServerConfigSchema,
  McpServerIdSchema,
  McpToolCallRequestSchema,
  McpToolPolicySchema,
} from "./types.js";

const WorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema });
const OptionalWorkspaceQuerySchema = z.object({ workspaceId: WorkspaceIdSchema.optional() });
const ServerParamsSchema = z.object({ id: McpServerIdSchema });
const ToolParamsSchema = z.object({
  id: McpServerIdSchema,
  tool: z.string().min(1).max(128),
});

function toHttpError(error: unknown): unknown {
  if (error instanceof McpServerNotFoundError) return new NotFoundError(error.message);
  if (error instanceof McpServerDisabledError) return new ConflictError(error.message);
  if (error instanceof McpToolDisabledError || error instanceof McpTransportDeniedError) {
    return new HttpError(403, "MCP_PERMISSION_DENIED", error.message);
  }
  if (error instanceof McpPolicyDeniedError) {
    return new HttpError(403, "MCP_POLICY_DENIED", error.message);
  }
  if (error instanceof McpApprovalRequiredError) {
    return new HttpError(409, "MCP_APPROVAL_REQUIRED", error.message, {
      operationId: error.operationId,
      prompt: error.prompt,
    });
  }
  if (
    error instanceof McpInvocationOutcomeUncertainError ||
    error instanceof McpRemoteOutcomeUncertainError
  ) {
    return new HttpError(409, "MCP_OUTCOME_UNCERTAIN", error.message);
  }
  if (error instanceof McpInvocationConflictError) {
    return new ConflictError(error.message);
  }
  if (error instanceof McpToolNotAdvertisedError) return new BadRequestError(error.message);
  if (error instanceof McpCredentialMissingError) {
    return new HttpError(503, "MCP_CREDENTIAL_UNAVAILABLE", error.message);
  }
  if (error instanceof McpClientTimeoutError) {
    return new HttpError(504, "MCP_TIMEOUT", error.message);
  }
  if (error instanceof McpRegistryError || error instanceof McpInvocationStoreError) {
    return new HttpError(503, "MCP_STATE_UNAVAILABLE", error.message);
  }
  if (error instanceof Error) return new BadGatewayError(error.message);
  return error;
}

export function registerOutboundMcpRoutes(app: FastifyInstance, manager: McpManager): void {
  const metrics = observabilityFor(app);
  app.get("/v1/mcp-outbound/servers", async (req) => {
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    return { servers: manager.listServers(query.workspaceId) };
  });

  app.get<{ Params: { id: string } }>("/v1/mcp-outbound/servers/:id/status", async (req) => {
    const params = parseOrBadRequest(ServerParamsSchema, req.params);
    const query = parseOrBadRequest(WorkspaceQuerySchema, req.query);
    try {
      return manager.status(params.id, query.workspaceId);
    } catch (error) {
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string } }>("/v1/mcp-outbound/servers/:id/discover", async (req) => {
    const params = parseOrBadRequest(ServerParamsSchema, req.params);
    const body = parseOrBadRequest(McpDiscoverRequestSchema, req.body);
    const started = performance.now();
    try {
      const result = await manager.discover(params.id, body);
      metrics.addCounter("ecorione_mcp_discovery_total", 1, {
        server: params.id,
        outcome: "success",
      });
      metrics.observe("ecorione_mcp_discovery_duration_ms", performance.now() - started, {
        server: params.id,
      });
      return result;
    } catch (error) {
      metrics.addCounter("ecorione_mcp_discovery_total", 1, {
        server: params.id,
        outcome: "error",
      });
      metrics.observe("ecorione_mcp_discovery_duration_ms", performance.now() - started, {
        server: params.id,
      });
      throw toHttpError(error);
    }
  });

  app.post<{ Params: { id: string; tool: string } }>(
    "/v1/mcp-outbound/servers/:id/tools/:tool/call",
    async (req) => {
      const params = parseOrBadRequest(ToolParamsSchema, req.params);
      const body = parseOrBadRequest(McpToolCallRequestSchema, req.body);
      const started = performance.now();
      try {
        const result = await manager.callTool(params.id, params.tool, body);
        metrics.addCounter("ecorione_mcp_tool_calls_total", 1, {
          server: params.id,
          tool: params.tool,
          outcome: "success",
        });
        metrics.observe("ecorione_mcp_tool_duration_ms", performance.now() - started, {
          server: params.id,
          tool: params.tool,
        });
        return result;
      } catch (error) {
        metrics.addCounter("ecorione_mcp_tool_calls_total", 1, {
          server: params.id,
          tool: params.tool,
          outcome: "error",
        });
        metrics.observe("ecorione_mcp_tool_duration_ms", performance.now() - started, {
          server: params.id,
          tool: params.tool,
        });
        throw toHttpError(error);
      }
    },
  );

  app.get("/v1/settings/mcp/servers", async (req) => {
    const query = parseOrBadRequest(OptionalWorkspaceQuerySchema, req.query);
    return { servers: manager.configuredServers(query.workspaceId) };
  });

  app.put<{ Params: { id: string } }>("/v1/settings/mcp/servers/:id", async (req) => {
    const params = parseOrBadRequest(ServerParamsSchema, req.params);
    const body = parseOrBadRequest(McpServerConfigSchema, req.body);
    if (body.id !== params.id) throw new BadRequestError("MCP server id body/path harus sama.");
    return manager.upsertServer(body);
  });

  app.delete<{ Params: { id: string } }>("/v1/settings/mcp/servers/:id", async (req) => {
    const params = parseOrBadRequest(ServerParamsSchema, req.params);
    return { removed: await manager.removeServer(params.id) };
  });

  app.put<{ Params: { id: string; tool: string } }>(
    "/v1/settings/mcp/servers/:id/tools/:tool",
    async (req) => {
      const params = parseOrBadRequest(ToolParamsSchema, req.params);
      const body = parseOrBadRequest(McpToolPolicySchema, req.body);
      if (body.name !== params.tool)
        throw new BadRequestError("Nama tool body/path harus sama.");
      return manager.setServerToolPolicy(params.id, body);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/mcp-outbound/servers/:id/disconnect",
    async (req) => {
      const params = parseOrBadRequest(ServerParamsSchema, req.params);
      const body = parseOrBadRequest(WorkspaceQuerySchema, req.body);
      try {
        return { disconnected: await manager.disconnect(params.id, body.workspaceId) };
      } catch (error) {
        throw toHttpError(error);
      }
    },
  );
}
