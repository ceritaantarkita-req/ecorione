import {
  EcxAgentBindingSchema,
  type EcxAgentBinding,
  type EcxAgentBindingUpsertRequest,
  type EcxAgentId,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface BindingRow {
  readonly workspace_id: string;
  readonly agent_id: string;
  readonly target: "local" | "hosted";
  readonly capabilities_json: string;
  readonly system_prompt: string;
  readonly enabled: number;
  readonly operation_id: string;
  readonly updated_at: string;
}

function rowToBinding(row: BindingRow): EcxAgentBinding {
  return EcxAgentBindingSchema.parse({
    operationId: row.operation_id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    target: row.target,
    capabilities: JSON.parse(row.capabilities_json) as unknown,
    systemPrompt: row.system_prompt,
    enabled: row.enabled === 1,
    updatedAt: row.updated_at,
  });
}

export class EcxAgentRegistry {
  constructor(private readonly db: HubDatabase) {}

  upsert(
    agentId: EcxAgentId,
    input: EcxAgentBindingUpsertRequest,
    now: Timestamp,
  ): EcxAgentBinding {
    const capabilities = [
      ...new Set(input.capabilities.map((value) => value.trim().toLowerCase())),
    ].sort();
    this.db.raw
      .prepare(
        `INSERT INTO ecx_agent_bindings(
          workspace_id,agent_id,target,capabilities_json,system_prompt,enabled,operation_id,updated_at
        ) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(workspace_id,agent_id) DO UPDATE SET
          target=excluded.target,
          capabilities_json=excluded.capabilities_json,
          system_prompt=excluded.system_prompt,
          enabled=excluded.enabled,
          operation_id=excluded.operation_id,
          updated_at=excluded.updated_at`,
      )
      .run(
        input.workspaceId,
        agentId,
        input.target,
        JSON.stringify(capabilities),
        input.systemPrompt,
        input.enabled ? 1 : 0,
        input.operationId,
        now,
      );
    return this.get(input.workspaceId, agentId)!;
  }

  get(workspaceId: WorkspaceId, agentId: EcxAgentId): EcxAgentBinding | null {
    const row = this.db.raw
      .prepare(
        `SELECT workspace_id,agent_id,target,capabilities_json,system_prompt,enabled,operation_id,updated_at
         FROM ecx_agent_bindings
         WHERE workspace_id=? AND agent_id=?`,
      )
      .get(workspaceId, agentId) as BindingRow | undefined;
    return row === undefined ? null : rowToBinding(row);
  }

  list(workspaceId: WorkspaceId): EcxAgentBinding[] {
    const rows = this.db.raw
      .prepare(
        `SELECT workspace_id,agent_id,target,capabilities_json,system_prompt,enabled,operation_id,updated_at
         FROM ecx_agent_bindings
         WHERE workspace_id=?
         ORDER BY agent_id ASC`,
      )
      .all(workspaceId) as BindingRow[];
    return rows.map(rowToBinding);
  }
}
