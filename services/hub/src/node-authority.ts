import {
  FlowNodeDefinitionSchema,
  WorkspaceIdSchema,
  type FlowNodeDefinition,
  type Timestamp,
} from "@ecorione/shared-schema";
import { parseOrBadRequest } from "@ecorione/shared-server";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nowIso } from "./clock.js";
import type { HubDatabase } from "./db.js";

const NodeDeclarationSyncSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    definitions: z.array(FlowNodeDefinitionSchema).min(1).max(100),
  })
  .strict();

interface PermissionRow {
  id: string;
  actionClass: string;
  resource: string;
  access: string;
  sideEffect: boolean;
  description: string;
}

function nodeExecutePermission(db: HubDatabase): PermissionRow {
  const row = db.raw
    .prepare("SELECT permissions_json FROM capability_definitions WHERE id='node.execute'")
    .get() as { permissions_json: string } | undefined;
  if (row === undefined) throw new Error("Builtin capability node.execute belum tersedia.");
  const permissions = JSON.parse(row.permissions_json) as PermissionRow[];
  const permission = permissions.find((item) => item.id === "node.execute");
  if (permission === undefined)
    throw new Error("Builtin permission node.execute belum tersedia.");
  return permission;
}

export function syncCoreNodeDeclarations(
  db: HubDatabase,
  workspaceId: string,
  definitions: readonly FlowNodeDefinition[],
  now: Timestamp,
): void {
  const permission = nodeExecutePermission(db);
  const tx = db.raw.transaction(() => {
    db.raw
      .prepare(
        "DELETE FROM authority_declarations WHERE workspace_id=? AND subject_kind='node' AND subject_id LIKE 'core/%'",
      )
      .run(workspaceId);
    for (const definition of definitions) {
      db.raw
        .prepare(
          `INSERT INTO authority_declarations(
        workspace_id,subject_kind,subject_id,capability_id,permission_id,action_class,
        resource,access,side_effect,description,source_ref,updated_at
      ) VALUES(?,'node',?,'node.execute','node.execute',?,?,?,?,?,?,?)`,
        )
        .run(
          workspaceId,
          definition.id,
          permission.actionClass,
          permission.resource,
          permission.access,
          permission.sideEffect ? 1 : 0,
          `Core Flow node ${definition.label}: ${definition.description}`,
          `node-registry:${definition.id}`,
          now,
        );
    }
    db.raw
      .prepare(
        `DELETE FROM authority_grants
      WHERE workspace_id=? AND subject_kind='node' AND subject_id LIKE 'core/%'
        AND NOT EXISTS (
          SELECT 1 FROM authority_declarations d
          WHERE d.workspace_id=authority_grants.workspace_id
            AND d.subject_kind=authority_grants.subject_kind
            AND d.subject_id=authority_grants.subject_id
            AND d.capability_id=authority_grants.capability_id
            AND d.permission_id=authority_grants.permission_id
        )`,
      )
      .run(workspaceId);
  });
  tx();
}

export function registerNodeAuthorityRoutes(app: FastifyInstance, db: HubDatabase): void {
  app.post("/v1/authority/nodes/sync", async (req) => {
    const body = parseOrBadRequest(NodeDeclarationSyncSchema, req.body);
    syncCoreNodeDeclarations(db, body.workspaceId, body.definitions, nowIso());
    return { workspaceId: body.workspaceId, declared: body.definitions.length };
  });
}
