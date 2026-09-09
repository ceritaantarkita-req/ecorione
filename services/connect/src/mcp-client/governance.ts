import {
  CapabilityAuthorizationResultSchema,
  mcpPermissionForActionClass,
  type ActionRequest,
  type CapabilityId,
  type PermissionId,
  type OperationId,
  type PolicyVerdict,
  type Timestamp,
} from "@ecorione/shared-schema";
import { httpJson, RemoteServiceError } from "@ecorione/shared-server";
import type { McpGovernanceRequest, McpProtocolEra, McpToolCallResult } from "./types.js";

interface ApprovalSnapshot {
  readonly operationId: OperationId;
  readonly status: "PENDING" | "APPROVE" | "EDIT" | "REJECT" | "RESPOND";
  readonly prompt: string;
  readonly actionRequest: ActionRequest;
}

export class McpPolicyDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpPolicyDeniedError";
  }
}

export class McpApprovalRequiredError extends Error {
  constructor(
    readonly operationId: OperationId,
    readonly prompt: string,
  ) {
    super(`MCP tool membutuhkan approval: ${operationId}. ${prompt}`);
    this.name = "McpApprovalRequiredError";
  }
}

export interface McpGovernance {
  authorize(request: McpGovernanceRequest): Promise<void>;
  auditSuccess(input: {
    readonly request: McpGovernanceRequest;
    readonly transport: "stdio" | "streamable-http";
    readonly protocolEra: McpProtocolEra;
    readonly result: McpToolCallResult;
    readonly deduplicated: boolean;
    readonly settlement: "settled" | "reservation-retained" | "not-applicable";
  }): Promise<void>;
  auditFailure(input: {
    readonly request: McpGovernanceRequest;
    readonly transport: "stdio" | "streamable-http";
    readonly protocolEra: McpProtocolEra;
    readonly error: unknown;
    readonly outcomeUncertain: boolean;
  }): Promise<void>;
}

function actionRequest(request: McpGovernanceRequest): ActionRequest {
  return {
    operationId: request.context.operationId,
    module: "Connect",
    tool: `mcp.${request.server.id}.${request.toolName}`,
    actionClass: request.actionClass,
    args: {
      serverId: request.server.id,
      toolName: request.toolName,
      arguments: request.arguments,
    },
    scope: request.context.scope,
    sensitivity: request.context.sensitivity,
    autonomy: request.context.autonomy,
    idempotencyKey: request.idempotencyKey,
  };
}

export class HubMcpGovernance implements McpGovernance {
  constructor(
    private readonly hubUrl: string,
    private readonly token: string | undefined,
  ) {}

  private async existingApproval(idempotencyKey: string): Promise<ApprovalSnapshot | null> {
    try {
      return await httpJson<ApprovalSnapshot>(
        `${this.hubUrl}/v1/approvals/by-idempotency-key?idempotencyKey=${encodeURIComponent(idempotencyKey)}`,
        { method: "GET", token: this.token },
      );
    } catch (error) {
      if (error instanceof RemoteServiceError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async authorize(request: McpGovernanceRequest): Promise<void> {
    const discover = request.toolName === "server.discover";
    const authority = CapabilityAuthorizationResultSchema.parse(
      await httpJson<unknown>(`${this.hubUrl}/v1/authority/authorize`, {
        token: this.token,
        body: {
          operationId: request.context.operationId,
          workspaceId: request.context.workspaceId,
          subject: { kind: "mcp-tool", id: `${request.server.id}/${request.toolName}` },
          capabilityId: (discover ? "mcp.discover" : "mcp.tool.call") as CapabilityId,
          permissionIds: [
            discover
              ? ("mcp.read" as PermissionId)
              : mcpPermissionForActionClass(request.actionClass),
          ],
          scope: request.context.scope,
          sensitivity: request.context.sensitivity,
          autonomy: request.context.autonomy,
        },
      }),
    );
    if (authority.outcome === "DENY") throw new McpPolicyDeniedError(authority.reason);

    if (request.server.transport.credentialRef !== undefined) {
      const credentialAuthority = CapabilityAuthorizationResultSchema.parse(
        await httpJson<unknown>(`${this.hubUrl}/v1/authority/authorize`, {
          token: this.token,
          body: {
            operationId: request.context.operationId,
            workspaceId: request.context.workspaceId,
            subject: { kind: "mcp-tool", id: `${request.server.id}/${request.toolName}` },
            capabilityId: "secret.access" as CapabilityId,
            permissionIds: ["credential.use" as PermissionId],
            scope: request.context.scope,
            sensitivity: request.context.sensitivity,
            autonomy: request.context.autonomy,
          },
        }),
      );
      if (credentialAuthority.outcome === "DENY") {
        throw new McpPolicyDeniedError(credentialAuthority.reason);
      }
    }

    if (request.actionClass !== "READ" && request.idempotencyKey !== null) {
      const existing = await this.existingApproval(request.idempotencyKey);
      if (existing !== null) {
        if (existing.status === "APPROVE") return;
        if (existing.status === "PENDING") {
          throw new McpApprovalRequiredError(existing.operationId, existing.prompt);
        }
        throw new McpPolicyDeniedError(
          `Approval MCP sebelumnya berstatus ${existing.status}; remote tool tidak dipanggil.`,
        );
      }
    }

    const verdict = await httpJson<PolicyVerdict>(`${this.hubUrl}/v1/actions/evaluate`, {
      token: this.token,
      body: actionRequest(request),
    });
    if (verdict.outcome === "ALLOW") return;
    if (verdict.outcome === "REQUIRE_APPROVAL") {
      throw new McpApprovalRequiredError(request.context.operationId, verdict.prompt);
    }
    throw new McpPolicyDeniedError(verdict.reason);
  }

  async auditSuccess(input: {
    readonly request: McpGovernanceRequest;
    readonly transport: "stdio" | "streamable-http";
    readonly protocolEra: McpProtocolEra;
    readonly result: McpToolCallResult;
    readonly deduplicated: boolean;
    readonly settlement: "settled" | "reservation-retained" | "not-applicable";
  }): Promise<void> {
    await this.audit(
      "MCP_TOOL_CALLED",
      input.request.context.operationId,
      input.request.context.now,
      {
        serverId: input.request.server.id,
        toolName: input.request.toolName,
        actionClass: input.request.actionClass,
        transport: input.transport,
        protocolEra: input.protocolEra,
        remoteIsError: input.result.isError === true,
        deduplicated: input.deduplicated,
        idempotencySettlement: input.settlement,
      },
    );
  }

  async auditFailure(input: {
    readonly request: McpGovernanceRequest;
    readonly transport: "stdio" | "streamable-http";
    readonly protocolEra: McpProtocolEra;
    readonly error: unknown;
    readonly outcomeUncertain: boolean;
  }): Promise<void> {
    await this.audit(
      "ACTION_FAILED",
      input.request.context.operationId,
      input.request.context.now,
      {
        tool: `mcp.${input.request.server.id}.${input.request.toolName}`,
        serverId: input.request.server.id,
        transport: input.transport,
        protocolEra: input.protocolEra,
        outcomeUncertain: input.outcomeUncertain,
        error: input.error instanceof Error ? input.error.message : String(input.error),
      },
    );
  }

  private async audit(
    type: "MCP_TOOL_CALLED" | "ACTION_FAILED",
    operationId: OperationId,
    now: Timestamp,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await httpJson(`${this.hubUrl}/v1/audit/events`, {
      token: this.token,
      body: {
        type,
        operationId,
        module: "Connect",
        detail,
        now,
      },
    });
  }
}
