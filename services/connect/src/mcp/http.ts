/** Streamable HTTP (stateless POST) entry for MCP 2026-07-28. */
import { MCP_PROTOCOL_VERSION, type Scope, type Sensitivity } from "@ecorione/shared-schema";
import { createServer } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import {
  JwksCache,
  McpAuthError,
  authenticateBearer,
  protectedResourceMetadata,
  requireOAuthScope,
  validateOrigin,
  type McpAuthConfig,
} from "./auth.js";
import { epochMs } from "./clock.js";
import { errorResponse, McpProtocolError, parseMcpRequest, dispatchMcpRequest, validateHttpRoutingHeaders } from "./server.js";
import { requiredOAuthScope } from "./tools.js";

export interface BuildMcpHttpServerOptions {
  readonly hubUrl: string;
  readonly internalToken?: string | undefined;
  readonly handleKey: Buffer;
  readonly auth: McpAuthConfig;
  readonly logger?: boolean | undefined;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestId(raw: unknown): string | number | null {
  if (raw !== null && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return null;
}

function toolName(request: ReturnType<typeof parseMcpRequest>): string | undefined {
  if (request.method !== "tools/call") return undefined;
  const value = request.params.name;
  return typeof value === "string" ? value : undefined;
}

export function buildMcpHttpServer(options: BuildMcpHttpServerOptions): FastifyInstance {
  const app = createServer({ name: "connect-mcp", logger: options.logger });
  const jwks = new JwksCache(options.auth);
  const metadata = protectedResourceMetadata(options.auth);

  app.get("/.well-known/oauth-protected-resource", async () => metadata);
  app.get("/.well-known/oauth-protected-resource/mcp", async () => metadata);

  app.post("/mcp", async (req, reply) => {
    const nowMs = epochMs();
    try {
      validateOrigin(one(req.headers.origin), options.auth.allowedOrigins);
      const parsed = parseMcpRequest(req.body);
      validateHttpRoutingHeaders(parsed, {
        protocolVersion: one(req.headers["mcp-protocol-version"]),
        method: one(req.headers["mcp-method"]),
        name: one(req.headers["mcp-name"]),
      });
      const principal = await authenticateBearer(one(req.headers.authorization), options.auth, jwks, nowMs);
      const name = toolName(parsed);
      if (name !== undefined) requireOAuthScope(principal, requiredOAuthScope(name));

      const response = await dispatchMcpRequest(req.body, {
        hubUrl: options.hubUrl,
        internalToken: options.internalToken,
        handleKey: options.handleKey,
        principalId: principal.id,
        allowedScopes: principal.memoryScopes,
        maxSensitivity: principal.maxSensitivity,
        delivery: "hosted",
        sourceApp: "mcp-http",
        nowMs,
      });
      return await reply.code(200).type("application/json").send(response);
    } catch (error) {
      if (error instanceof McpAuthError) {
        if (error.statusCode === 401) {
          reply.header("www-authenticate", `Bearer error="${error.code}"`);
        } else if (error.code === "insufficient_scope") {
          reply.header("www-authenticate", "Bearer error=\"insufficient_scope\"");
        }
        return await reply.code(error.statusCode).send(errorResponse(requestId(req.body), new McpProtocolError(-32001, error.message)));
      }
      const status = error instanceof McpProtocolError && error.code === -32020 ? 400 : 400;
      return await reply.code(status).send(errorResponse(requestId(req.body), error));
    }
  });

  app.get("/mcp", async (_req, reply) => {
    return await reply.code(405).send({
      error: {
        type: "METHOD_NOT_ALLOWED",
        message: `MCP ${MCP_PROTOCOL_VERSION} ecorione menggunakan request stateless POST; subscriptions/listen belum diumumkan sebagai capability.`,
      },
    });
  });

  return app;
}

export function mcpAuthConfig(input: {
  issuer: string;
  resource: string;
  jwksUrl: string;
  allowedOrigins: readonly string[];
  defaultMemoryScopes: readonly Scope[];
  defaultMaxSensitivity: Sensitivity;
}): McpAuthConfig {
  return input;
}
