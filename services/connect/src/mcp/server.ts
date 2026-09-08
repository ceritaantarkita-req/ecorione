/** MCP 2026-07-28 JSON-RPC dispatcher shared by stdio and Streamable HTTP. */
import { MCP_PROTOCOL_VERSION, SensitivitySchema, type McpDelivery, type Scope, type Sensitivity } from "@ecorione/shared-schema";
import { z } from "zod";
import { discoverResult, responseMeta } from "./discover.js";
import { MCP_TOOLS, callMcpTool, type ToolRuntime } from "./tools.js";

const JsonRpcIdSchema = z.union([z.string(), z.number()]);
const RequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: JsonRpcIdSchema,
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});
export type McpRequest = z.infer<typeof RequestSchema>;

const ClientInfoSchema = z.object({ name: z.string().min(1).max(128), version: z.string().min(1).max(64) });
const EnvelopeSchema = z.object({
  "io.modelcontextprotocol/protocolVersion": z.literal(MCP_PROTOCOL_VERSION),
  "io.modelcontextprotocol/clientInfo": ClientInfoSchema.optional(),
  "io.modelcontextprotocol/clientCapabilities": z.record(z.string(), z.unknown()).optional().default({}),
}).passthrough();

const CallParamsSchema = z.object({
  name: z.string().min(1).max(128),
  arguments: z.unknown().optional(),
  _meta: z.unknown().optional(),
}).passthrough();

export interface McpRuntimeBase {
  readonly hubUrl: string;
  readonly internalToken?: string | undefined;
  readonly handleKey: Buffer;
  readonly principalId: string;
  readonly allowedScopes: readonly Scope[];
  readonly maxSensitivity: Sensitivity;
  readonly delivery: McpDelivery;
  readonly sourceApp: string;
  readonly nowMs: number;
}

export class McpProtocolError extends Error {
  constructor(readonly code: number, message: string, readonly data?: unknown) {
    super(message);
    this.name = "McpProtocolError";
  }
}

export function parseMcpRequest(raw: unknown): McpRequest {
  try {
    return RequestSchema.parse(raw);
  } catch (error) {
    throw new McpProtocolError(-32600, "Invalid Request", error instanceof Error ? error.message : String(error));
  }
}

export function clientInfoName(request: McpRequest): string | undefined {
  const meta = request.params._meta;
  if (typeof meta !== "object" || meta === null) return undefined;
  const parsed = EnvelopeSchema.safeParse(meta);
  return parsed.success ? parsed.data["io.modelcontextprotocol/clientInfo"]?.name : undefined;
}

export function validateModernEnvelope(request: McpRequest): void {
  const meta = request.params._meta;
  if (typeof meta !== "object" || meta === null) {
    throw new McpProtocolError(-32602, `MCP ${MCP_PROTOCOL_VERSION} membutuhkan params._meta per request.`);
  }
  const parsed = EnvelopeSchema.safeParse(meta);
  if (!parsed.success) {
    throw new McpProtocolError(-32602, `Envelope MCP ${MCP_PROTOCOL_VERSION} tidak valid.`, parsed.error.issues);
  }
}

export function validateHttpRoutingHeaders(
  request: McpRequest,
  headers: { readonly protocolVersion?: string | undefined; readonly method?: string | undefined; readonly name?: string | undefined },
): void {
  if (headers.protocolVersion !== MCP_PROTOCOL_VERSION) {
    throw new McpProtocolError(-32020, `MCP-Protocol-Version wajib ${MCP_PROTOCOL_VERSION}.`);
  }
  if (headers.method !== request.method) {
    throw new McpProtocolError(-32020, "Mcp-Method header tidak cocok dengan JSON-RPC method.");
  }
  if (request.method === "tools/call") {
    const params = CallParamsSchema.parse(request.params);
    if (headers.name !== params.name) throw new McpProtocolError(-32020, "Mcp-Name header tidak cocok dengan tools/call params.name.");
  } else if (headers.name !== undefined) {
    throw new McpProtocolError(-32020, "Mcp-Name hanya dikirim untuk method yang memiliki subject/name.");
  }
}

function success(id: string | number, result: Record<string, unknown>): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result: { ...result, _meta: { ...(result._meta as Record<string, unknown> | undefined), ...responseMeta() } } };
}

export function errorResponse(id: string | number | null, error: unknown): Record<string, unknown> {
  const protocol = error instanceof McpProtocolError ? error : new McpProtocolError(-32603, error instanceof Error ? error.message : String(error));
  const body: Record<string, unknown> = { code: protocol.code, message: protocol.message };
  if (protocol.data !== undefined) body.data = protocol.data;
  return { jsonrpc: "2.0", id, error: body };
}

export async function dispatchMcpRequest(raw: unknown, runtime: McpRuntimeBase): Promise<Record<string, unknown>> {
  let request: McpRequest;
  try {
    request = parseMcpRequest(raw);
    validateModernEnvelope(request);
    if (request.method === "server/discover") return success(request.id, discoverResult());
    if (request.method === "tools/list") {
      return success(request.id, {
        resultType: "complete",
        tools: MCP_TOOLS,
        ttlMs: 300_000,
        cacheScope: "private",
      });
    }
    if (request.method === "tools/call") {
      const params = CallParamsSchema.parse(request.params);
      const toolRuntime: ToolRuntime = {
        ...runtime,
        sourceApp: clientInfoName(request) ?? runtime.sourceApp,
      };
      const result = await callMcpTool(params.name, params.arguments, String(request.id), toolRuntime);
      return success(request.id, result);
    }
    throw new McpProtocolError(-32601, `Method not found: ${request.method}`);
  } catch (error) {
    const id = raw !== null && typeof raw === "object" && "id" in raw && (typeof (raw as { id?: unknown }).id === "string" || typeof (raw as { id?: unknown }).id === "number")
      ? (raw as { id: string | number }).id
      : null;
    return errorResponse(id, error);
  }
}

export function parseSensitivity(raw: string | undefined, fallback: Sensitivity): Sensitivity {
  if (raw === undefined) return fallback;
  return SensitivitySchema.parse(raw);
}
