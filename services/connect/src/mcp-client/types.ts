import {
  ActionClassSchema,
  AutonomyLevelSchema,
  OperationIdSchema,
  ScopeSchema,
  SensitivitySchema,
  TimestampSchema,
  WorkspaceIdSchema,
  type ActionClass,
  type AutonomyLevel,
  type OperationId,
  type Scope,
  type Sensitivity,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import { z } from "zod";

export const McpServerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
export type McpServerId = z.infer<typeof McpServerIdSchema>;

export const McpCredentialRefSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._:/-]*$/);
export type McpCredentialRef = z.infer<typeof McpCredentialRefSchema>;

const TimeoutMsSchema = z.number().int().min(100).max(120_000);
const StdioEnvironmentSchema = z.record(z.string().min(1).max(128), z.string().max(8192));
const SECRET_ENV_NAME = /(token|key|secret|password|credential)/i;

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.")
  );
}

const HttpTransportSchema = z
  .object({
    type: z.literal("streamable-http"),
    url: z.string().url(),
    credentialRef: McpCredentialRefSchema.optional(),
    allowInsecureLoopback: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const url = new URL(value.url);
    if (url.username !== "" || url.password !== "" || url.hash !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "MCP HTTP URL tidak boleh memuat username, password, atau fragment.",
      });
    }
    if (url.protocol === "https:") return;
    if (
      url.protocol === "http:" &&
      value.allowInsecureLoopback &&
      isLoopbackHostname(url.hostname)
    ) {
      return;
    }
    ctx.addIssue({
      code: "custom",
      path: ["url"],
      message:
        "MCP HTTP wajib HTTPS; HTTP hanya boleh untuk loopback yang diizinkan eksplisit.",
    });
  });

const StdioTransportSchema = z
  .object({
    type: z.literal("stdio"),
    command: z.string().min(1).max(1024),
    args: z.array(z.string().max(4096)).max(128).default([]),
    cwd: z.string().min(1).max(4096).optional(),
    env: StdioEnvironmentSchema.default({}),
    credentialRef: McpCredentialRefSchema.optional(),
    credentialEnv: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Z_][A-Z0-9_]*$/)
      .optional(),
  })
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value.env)) {
      if (SECRET_ENV_NAME.test(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["env", key],
          message:
            "Env yang tampak seperti secret harus memakai credentialRef + credentialEnv.",
        });
      }
    }
    if ((value.credentialRef === undefined) !== (value.credentialEnv === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["credentialRef"],
        message: "credentialRef dan credentialEnv harus dikonfigurasi bersama untuk stdio.",
      });
    }
  });

export const McpTransportSchema = z.discriminatedUnion("type", [
  HttpTransportSchema,
  StdioTransportSchema,
]);
export type McpTransport = z.infer<typeof McpTransportSchema>;

export const McpToolPolicySchema = z.object({
  name: z.string().min(1).max(128),
  enabled: z.boolean(),
  actionClass: ActionClassSchema,
});
export type McpToolPolicy = z.infer<typeof McpToolPolicySchema>;

export const McpServerConfigSchema = z
  .object({
    id: McpServerIdSchema,
    displayName: z.string().min(1).max(128),
    enabled: z.boolean().default(true),
    workspaceIds: z.array(WorkspaceIdSchema).min(1).max(128),
    transport: McpTransportSchema,
    toolPolicies: z.array(McpToolPolicySchema).max(512).default([]),
    connectTimeoutMs: TimeoutMsSchema.default(10_000),
    requestTimeoutMs: TimeoutMsSchema.default(30_000),
  })
  .superRefine((value, ctx) => {
    const workspaces = new Set<string>();
    for (const [index, workspaceId] of value.workspaceIds.entries()) {
      if (workspaces.has(workspaceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["workspaceIds", index],
          message: `workspaceId duplikat: ${workspaceId}.`,
        });
      }
      workspaces.add(workspaceId);
    }
    const tools = new Set<string>();
    for (const [index, policy] of value.toolPolicies.entries()) {
      if (tools.has(policy.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["toolPolicies", index, "name"],
          message: `Policy tool duplikat: ${policy.name}.`,
        });
      }
      tools.add(policy.name);
    }
  });
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const McpRequestContextSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  operationId: OperationIdSchema,
  scope: ScopeSchema,
  sensitivity: SensitivitySchema,
  autonomy: AutonomyLevelSchema,
  now: TimestampSchema,
});
export interface McpRequestContext {
  readonly workspaceId: WorkspaceId;
  readonly operationId: OperationId;
  readonly scope: Scope;
  readonly sensitivity: Sensitivity;
  readonly autonomy: AutonomyLevel;
  readonly now: Timestamp;
}

export const McpDiscoverRequestSchema = McpRequestContextSchema;
export type McpDiscoverRequest = z.infer<typeof McpDiscoverRequestSchema>;
export const McpToolCallRequestSchema = McpRequestContextSchema.extend({
  arguments: z.record(z.string(), z.unknown()).default({}),
});
export type McpToolCallRequest = z.infer<typeof McpToolCallRequestSchema>;

export interface McpRemoteTool {
  readonly name: string;
  readonly description?: string | undefined;
  readonly inputSchema?: unknown;
  readonly outputSchema?: unknown;
}

export interface McpRemoteResource {
  readonly uri: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly mimeType?: string | undefined;
}

export interface McpToolCallResult {
  readonly content?: readonly unknown[] | undefined;
  readonly structuredContent?: unknown;
  readonly isError?: boolean | undefined;
  readonly [key: string]: unknown;
}

export type McpProtocolEra = "modern" | "legacy" | "unknown";

export interface McpClientFacade {
  readonly protocolEra: McpProtocolEra;
  listTools(timeoutMs: number): Promise<readonly McpRemoteTool[]>;
  listResources(timeoutMs: number): Promise<readonly McpRemoteResource[]>;
  callTool(
    name: string,
    args: Readonly<Record<string, unknown>>,
    timeoutMs: number,
  ): Promise<McpToolCallResult>;
  close(): Promise<void>;
}

export interface McpClientFactory {
  connect(config: McpServerConfig, workspaceId: WorkspaceId): Promise<McpClientFacade>;
}

export interface McpCredentialReader {
  get(ref: McpCredentialRef): string | undefined;
}

export interface McpGovernanceRequest {
  readonly server: McpServerConfig;
  readonly toolName: string;
  readonly actionClass: ActionClass;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly context: McpRequestContext;
  readonly idempotencyKey: string | null;
}
