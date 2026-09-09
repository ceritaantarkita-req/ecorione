import { createHash } from "node:crypto";
import {
  idempotencyPayload,
  type ActionClass,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { McpGovernance } from "./governance.js";
import {
  type FileMcpInvocationStore,
  type McpInvocationReservation,
} from "./invocation-store.js";
import { type FileMcpRegistry } from "./registry.js";
import type {
  McpClientFacade,
  McpClientFactory,
  McpDiscoverRequest,
  McpGovernanceRequest,
  McpRemoteResource,
  McpRemoteTool,
  McpServerConfig,
  McpServerId,
  McpToolCallRequest,
  McpToolCallResult,
} from "./types.js";

interface ConnectionState {
  readonly client: McpClientFacade;
  readonly configRevisionKey: string;
}

export class McpServerDisabledError extends Error {
  constructor(id: string) {
    super(`MCP server dinonaktifkan: ${id}.`);
    this.name = "McpServerDisabledError";
  }
}

export class McpToolDisabledError extends Error {
  constructor(serverId: string, toolName: string) {
    super(`MCP tool tidak diaktifkan secara eksplisit: ${serverId}/${toolName}.`);
    this.name = "McpToolDisabledError";
  }
}

export class McpToolNotAdvertisedError extends Error {
  constructor(serverId: string, toolName: string) {
    super(`MCP server ${serverId} tidak mengiklankan tool ${toolName}.`);
    this.name = "McpToolNotAdvertisedError";
  }
}

export class McpRemoteOutcomeUncertainError extends Error {
  constructor(serverId: string, toolName: string, cause: unknown) {
    super(
      `MCP tool ${serverId}/${toolName} gagal setelah dispatch; outcome remote dianggap tidak pasti dan tidak boleh di-retry otomatis: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "McpRemoteOutcomeUncertainError";
  }
}

function connectionKey(workspaceId: WorkspaceId, serverId: McpServerId): string {
  return `${workspaceId}\0${serverId}`;
}

function configRevisionKey(config: McpServerConfig): string {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

function toolActionClass(config: McpServerConfig, toolName: string): ActionClass {
  const policy = config.toolPolicies.find((candidate) => candidate.name === toolName);
  if (policy === undefined || !policy.enabled)
    throw new McpToolDisabledError(config.id, toolName);
  return policy.actionClass;
}

function invocationKey(
  config: McpServerConfig,
  toolName: string,
  args: Readonly<Record<string, unknown>>,
): string {
  const payload = idempotencyPayload({
    module: "Connect",
    tool: `mcp.${config.id}.${toolName}`,
    args: { serverId: config.id, toolName, arguments: args },
  });
  return createHash("sha256").update(payload).digest("hex");
}

function argsDigest(args: Readonly<Record<string, unknown>>): string {
  return createHash("sha256")
    .update(idempotencyPayload({ module: "Connect", tool: "mcp.args", args }))
    .digest("hex");
}

function storedResult(reservation: McpInvocationReservation): McpToolCallResult {
  const result = reservation.entry.result;
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error("Settled MCP invocation memiliki result yang tidak valid.");
  }
  return result as McpToolCallResult;
}

async function bestEffort(task: () => Promise<void>): Promise<"recorded" | "degraded"> {
  try {
    await task();
    return "recorded";
  } catch {
    return "degraded";
  }
}

export interface McpDiscoveryResult {
  readonly serverId: McpServerId;
  readonly protocolEra: string;
  readonly tools: readonly (McpRemoteTool & {
    readonly enabled: boolean;
    readonly actionClass: ActionClass | null;
  })[];
  readonly resources: readonly McpRemoteResource[];
  readonly errors: {
    readonly tools?: string | undefined;
    readonly resources?: string | undefined;
  };
}

export interface McpInvocationResult {
  readonly serverId: McpServerId;
  readonly toolName: string;
  readonly protocolEra: string;
  readonly result: McpToolCallResult;
  readonly deduplicated: boolean;
  readonly idempotencySettlement: "settled" | "reservation-retained" | "not-applicable";
  readonly audit: "recorded" | "degraded";
}

export class McpManager {
  private readonly connections = new Map<string, ConnectionState>();

  constructor(
    private readonly registry: FileMcpRegistry,
    private readonly clients: McpClientFactory,
    private readonly governance: McpGovernance,
    private readonly invocations: FileMcpInvocationStore,
  ) {}

  listServers(workspaceId: WorkspaceId): readonly {
    id: McpServerId;
    displayName: string;
    enabled: boolean;
    transport: "stdio" | "streamable-http";
    connected: boolean;
  }[] {
    return this.registry.list(workspaceId).map((server) => ({
      id: server.id,
      displayName: server.displayName,
      enabled: server.enabled,
      transport: server.transport.type,
      connected: this.connections.has(connectionKey(workspaceId, server.id)),
    }));
  }

  status(
    serverId: McpServerId,
    workspaceId: WorkspaceId,
  ): {
    readonly configured: true;
    readonly enabled: boolean;
    readonly connected: boolean;
    readonly transport: "stdio" | "streamable-http";
    readonly protocolEra: string | null;
  } {
    const config = this.registry.get(serverId, workspaceId);
    const state = this.connections.get(connectionKey(workspaceId, serverId));
    return {
      configured: true,
      enabled: config.enabled,
      connected: state !== undefined,
      transport: config.transport.type,
      protocolEra: state?.client.protocolEra ?? null,
    };
  }

  async disconnect(serverId: McpServerId, workspaceId: WorkspaceId): Promise<boolean> {
    const key = connectionKey(workspaceId, serverId);
    const state = this.connections.get(key);
    if (state === undefined) return false;
    this.connections.delete(key);
    await state.client.close();
    return true;
  }

  private async client(
    config: McpServerConfig,
    workspaceId: WorkspaceId,
  ): Promise<McpClientFacade> {
    if (!config.enabled) throw new McpServerDisabledError(config.id);
    const key = connectionKey(workspaceId, config.id);
    const revisionKey = configRevisionKey(config);
    const prior = this.connections.get(key);
    if (prior !== undefined && prior.configRevisionKey === revisionKey) return prior.client;
    if (prior !== undefined) {
      this.connections.delete(key);
      await prior.client.close();
    }
    const client = await this.clients.connect(config, workspaceId);
    this.connections.set(key, { client, configRevisionKey: revisionKey });
    return client;
  }

  async discover(
    serverId: McpServerId,
    request: McpDiscoverRequest,
  ): Promise<McpDiscoveryResult> {
    const config = this.registry.get(serverId, request.workspaceId);
    if (!config.enabled) throw new McpServerDisabledError(config.id);
    const governanceRequest: McpGovernanceRequest = {
      server: config,
      toolName: "server.discover",
      actionClass: "READ",
      arguments: {},
      context: request,
      idempotencyKey: null,
    };
    await this.governance.authorize(governanceRequest);
    const client = await this.client(config, request.workspaceId);
    const [toolsOutcome, resourcesOutcome] = await Promise.allSettled([
      client.listTools(config.requestTimeoutMs),
      client.listResources(config.requestTimeoutMs),
    ]);
    const tools =
      toolsOutcome.status === "fulfilled"
        ? toolsOutcome.value.map((tool) => {
            const policy = config.toolPolicies.find(
              (candidate) => candidate.name === tool.name,
            );
            return {
              ...tool,
              enabled: policy?.enabled === true,
              actionClass: policy?.actionClass ?? null,
            };
          })
        : [];
    const resources = resourcesOutcome.status === "fulfilled" ? resourcesOutcome.value : [];
    const errors: { tools?: string; resources?: string } = {};
    if (toolsOutcome.status === "rejected") {
      errors.tools =
        toolsOutcome.reason instanceof Error
          ? toolsOutcome.reason.message
          : String(toolsOutcome.reason);
    }
    if (resourcesOutcome.status === "rejected") {
      errors.resources =
        resourcesOutcome.reason instanceof Error
          ? resourcesOutcome.reason.message
          : String(resourcesOutcome.reason);
    }
    return { serverId, protocolEra: client.protocolEra, tools, resources, errors };
  }

  async callTool(
    serverId: McpServerId,
    toolName: string,
    request: McpToolCallRequest,
  ): Promise<McpInvocationResult> {
    const config = this.registry.get(serverId, request.workspaceId);
    if (!config.enabled) throw new McpServerDisabledError(config.id);
    const actionClass = toolActionClass(config, toolName);
    const idempotencyKey =
      actionClass === "READ" ? null : invocationKey(config, toolName, request.arguments);
    const governanceRequest: McpGovernanceRequest = {
      server: config,
      toolName,
      actionClass,
      arguments: request.arguments,
      context: request,
      idempotencyKey,
    };

    await this.governance.authorize(governanceRequest);
    const client = await this.client(config, request.workspaceId);
    const advertised = await client.listTools(config.requestTimeoutMs);
    if (!advertised.some((tool) => tool.name === toolName)) {
      throw new McpToolNotAdvertisedError(config.id, toolName);
    }

    let reservation: McpInvocationReservation | null = null;
    if (idempotencyKey !== null) {
      reservation = this.invocations.reserve({
        idempotencyKey,
        operationId: request.operationId,
        serverId,
        toolName,
        argsDigest: argsDigest(request.arguments),
        now: request.now,
      });
      if (reservation.kind === "settled") {
        const result = storedResult(reservation);
        const audit = await bestEffort(() =>
          this.governance.auditSuccess({
            request: governanceRequest,
            transport: config.transport.type,
            protocolEra: client.protocolEra,
            result,
            deduplicated: true,
            settlement: "settled",
          }),
        );
        return {
          serverId,
          toolName,
          protocolEra: client.protocolEra,
          result,
          deduplicated: true,
          idempotencySettlement: "settled",
          audit,
        };
      }
    }

    let result: McpToolCallResult;
    try {
      result = await client.callTool(toolName, request.arguments, config.requestTimeoutMs);
    } catch (error) {
      if (idempotencyKey !== null) {
        try {
          this.invocations.markUncertain(idempotencyKey);
        } catch {
          // Reservation itself remains conservative; never redispatch automatically.
        }
      }
      await bestEffort(() =>
        this.governance.auditFailure({
          request: governanceRequest,
          transport: config.transport.type,
          protocolEra: client.protocolEra,
          error,
          outcomeUncertain: idempotencyKey !== null,
        }),
      );
      await this.disconnect(serverId, request.workspaceId).catch(() => undefined);
      if (idempotencyKey !== null) {
        throw new McpRemoteOutcomeUncertainError(serverId, toolName, error);
      }
      throw error;
    }

    let settlement: "settled" | "reservation-retained" | "not-applicable" = "not-applicable";
    if (idempotencyKey !== null) {
      try {
        this.invocations.settle(idempotencyKey, result, request.now);
        settlement = "settled";
      } catch {
        settlement = "reservation-retained";
      }
    }
    const audit = await bestEffort(() =>
      this.governance.auditSuccess({
        request: governanceRequest,
        transport: config.transport.type,
        protocolEra: client.protocolEra,
        result,
        deduplicated: false,
        settlement,
      }),
    );
    return {
      serverId,
      toolName,
      protocolEra: client.protocolEra,
      result,
      deduplicated: false,
      idempotencySettlement: settlement,
      audit,
    };
  }
}
