import { createHash } from "node:crypto";
import {
  CapabilityDefinitionSchema,
  extensionPermissionCapabilityId,
  SensitivitySchema,
  sensitivityRank,
  type ActionClass,
  type AuthoritySubject,
  type CapabilityAuthorizationRequest,
  type CapabilityAuthorizationResult,
  type CapabilityDefinition,
  type CapabilityGrantRequest,
  type CapabilityGrantView,
  type CapabilityId,
  type CapabilityRevokeRequest,
  type ExtensionManifest,
  type OperationId,
  type PermissionAccess,
  type PermissionId,
  type PermissionResource,
  type Scope,
  type Sensitivity,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

const BASELINE_OPERATION = "op_authoritybaseline" as OperationId;
const PERSONAL_WORKSPACE = "ws_personal" as WorkspaceId;
const BASELINE_KEY = "batch4-baseline-v1";
const BASELINE_AT = "2026-09-09T00:00:00.000Z" as Timestamp;

function actionPermission(
  id: string,
  actionClass: ActionClass,
  access: PermissionAccess,
  description: string,
): CapabilityDefinition["permissions"][number] {
  return {
    id: id as PermissionId,
    actionClass,
    resource: "mcp",
    access,
    sideEffect: actionClass !== "READ",
    description,
  };
}

export const BUILTIN_CAPABILITIES: readonly CapabilityDefinition[] = [
  CapabilityDefinitionSchema.parse({
    id: "mcp.discover",
    description: "Discover tool/resource surface dari MCP server yang sudah dikonfigurasi.",
    permissions: [
      {
        id: "mcp.read",
        actionClass: "READ",
        resource: "mcp",
        access: "read",
        sideEffect: false,
        description: "Membaca metadata/discovery MCP.",
      },
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "mcp.tool.call",
    description: "Memanggil remote MCP tool sesuai ActionClass lokal yang dipin operator.",
    permissions: [
      actionPermission("mcp.tool.read", "READ", "read", "Remote tool read-only."),
      actionPermission(
        "mcp.tool.write",
        "REVERSIBLE_WRITE",
        "write",
        "Remote reversible write.",
      ),
      actionPermission(
        "mcp.tool.irreversible-write",
        "IRREVERSIBLE_WRITE",
        "write",
        "Remote irreversible write.",
      ),
      actionPermission(
        "mcp.tool.spend",
        "SPEND",
        "spend",
        "Remote tool dapat membelanjakan dana.",
      ),
      actionPermission(
        "mcp.tool.external-send",
        "EXTERNAL_SEND",
        "send",
        "Remote tool mengirim data keluar boundary.",
      ),
      actionPermission(
        "mcp.tool.credential-access",
        "CREDENTIAL_ACCESS",
        "use",
        "Remote tool membutuhkan credential-scoped action.",
      ),
      actionPermission(
        "mcp.tool.execute",
        "EXECUTE",
        "execute",
        "Remote tool mengeksekusi aksi.",
      ),
      actionPermission(
        "mcp.tool.policy-admin",
        "POLICY_ADMIN",
        "write",
        "Remote tool mengubah policy/authority state.",
      ),
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "sandbox.execute",
    description: "Menjalankan workload melalui Sandbox boundary.",
    permissions: [
      {
        id: "sandbox.execute",
        actionClass: "EXECUTE",
        resource: "execution",
        access: "execute",
        sideEffect: true,
        description: "Menjalankan workload sandbox.",
      },
      {
        id: "filesystem.read",
        actionClass: "READ",
        resource: "filesystem",
        access: "read",
        sideEffect: false,
        description: "Membaca workspace filesystem yang dibatasi Sandbox.",
      },
      {
        id: "filesystem.write",
        actionClass: "REVERSIBLE_WRITE",
        resource: "filesystem",
        access: "write",
        sideEffect: true,
        description: "Menulis workspace filesystem yang dibatasi Sandbox.",
      },
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "model.invoke.hosted",
    description: "Memanggil hosted model melalui Connect provider boundary.",
    permissions: [
      {
        id: "model.invoke",
        actionClass: "READ",
        resource: "model",
        access: "use",
        sideEffect: false,
        description: "Menggunakan model untuk inference.",
      },
      {
        id: "network.connect",
        actionClass: "EXTERNAL_SEND",
        resource: "network",
        access: "connect",
        sideEffect: true,
        description: "Membuka outbound network path ke provider yang sudah dipin.",
      },
      {
        id: "provider.spend",
        actionClass: "SPEND",
        resource: "external",
        access: "spend",
        sideEffect: true,
        description: "Mengizinkan hosted inference yang dapat menimbulkan biaya.",
      },
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "model.invoke.local",
    description: "Memanggil local model runtime melalui Connect.",
    permissions: [
      {
        id: "model.invoke",
        actionClass: "READ",
        resource: "model",
        access: "use",
        sideEffect: false,
        description: "Menggunakan local model untuk inference.",
      },
      {
        id: "execution.local",
        actionClass: "EXECUTE",
        resource: "execution",
        access: "execute",
        sideEffect: true,
        description: "Menggunakan local inference runtime.",
      },
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "tool.invoke",
    description: "Generic governed tool invocation contract untuk tool/node pack berikutnya.",
    permissions: [
      {
        id: "tool.read",
        actionClass: "READ",
        resource: "system",
        access: "read",
        sideEffect: false,
        description: "Generic read-only tool.",
      },
      {
        id: "tool.write",
        actionClass: "REVERSIBLE_WRITE",
        resource: "system",
        access: "write",
        sideEffect: true,
        description: "Generic reversible-write tool.",
      },
      {
        id: "tool.execute",
        actionClass: "EXECUTE",
        resource: "execution",
        access: "execute",
        sideEffect: true,
        description: "Generic executable tool.",
      },
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "node.execute",
    description: "Execution authority contract untuk Node Registry / Visual Flow berikutnya.",
    permissions: [
      {
        id: "node.execute",
        actionClass: "EXECUTE",
        resource: "execution",
        access: "execute",
        sideEffect: true,
        description: "Menjalankan node yang sudah diregistrasi.",
      },
    ],
  }),
  CapabilityDefinitionSchema.parse({
    id: "secret.access",
    description:
      "Menggunakan secret melalui owner boundary tanpa mengekspos plaintext ke registry.",
    permissions: [
      {
        id: "credential.use",
        actionClass: "CREDENTIAL_ACCESS",
        resource: "credential",
        access: "use",
        sideEffect: false,
        description: "Menggunakan named credential reference melalui owner service.",
      },
    ],
  }),
] as const;

interface DefinitionRow {
  id: string;
  description: string;
  permissions_json: string;
}
interface RequirementRow {
  permission_id: string;
  action_class: string;
  resource: string;
  access: string;
  side_effect: number;
  description: string;
}
interface GrantRow {
  workspace_id: string;
  subject_kind: string;
  subject_id: string;
  capability_id: string;
  permission_id: string;
  scope: string;
  max_sensitivity: string;
  granted_at: string;
  operation_id: string;
  reason: string;
}
interface OperationRow {
  fingerprint: string;
  result_json: string;
}

export class CapabilityUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityUnknownError";
  }
}
export class CapabilityIdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency key authority sudah dipakai untuk request berbeda: ${key}.`);
    this.name = "CapabilityIdempotencyConflictError";
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}
function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
function eventId(parts: readonly string[]): string {
  return `auth_evt_${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24)}`;
}
function rowToGrant(row: GrantRow): CapabilityGrantView {
  return {
    workspaceId: row.workspace_id as WorkspaceId,
    subject: { kind: row.subject_kind as AuthoritySubject["kind"], id: row.subject_id },
    capabilityId: row.capability_id as CapabilityId,
    permissionId: row.permission_id as PermissionId,
    scope: row.scope as Scope,
    maxSensitivity: SensitivitySchema.parse(row.max_sensitivity),
    grantedAt: row.granted_at as Timestamp,
    operationId: row.operation_id as OperationId,
    reason: row.reason,
  };
}

export class CapabilityRegistry {
  constructor(private readonly db: HubDatabase) {
    this.bootstrapDefinitions();
    this.bootstrapCompatibilityBaseline();
  }

  listDefinitions(): CapabilityDefinition[] {
    const rows = this.db.raw
      .prepare(
        "SELECT id, description, permissions_json FROM capability_definitions ORDER BY id ASC",
      )
      .all() as DefinitionRow[];
    return rows.map((row) =>
      CapabilityDefinitionSchema.parse({
        id: row.id,
        description: row.description,
        permissions: JSON.parse(row.permissions_json) as unknown,
      }),
    );
  }

  listGrants(input: {
    workspaceId: WorkspaceId;
    subject?: AuthoritySubject | undefined;
  }): CapabilityGrantView[] {
    const rows = input.subject
      ? (this.db.raw
          .prepare(
            `SELECT * FROM authority_grants
             WHERE workspace_id=? AND subject_kind=? AND subject_id=?
             ORDER BY capability_id, permission_id, scope`,
          )
          .all(input.workspaceId, input.subject.kind, input.subject.id) as GrantRow[])
      : (this.db.raw
          .prepare(
            `SELECT * FROM authority_grants
             WHERE workspace_id=?
             ORDER BY subject_kind, subject_id, capability_id, permission_id, scope`,
          )
          .all(input.workspaceId) as GrantRow[]);
    return rows.map(rowToGrant);
  }

  authorize(input: CapabilityAuthorizationRequest): CapabilityAuthorizationResult {
    const requirements = this.requirementsFor(
      input.workspaceId,
      input.subject,
      input.capabilityId,
    );
    if (requirements.size === 0) {
      return {
        outcome: "DENY",
        reason: `Capability tidak dikenal/dideklarasikan untuk subject ${input.subject.kind}:${input.subject.id}: ${input.capabilityId}.`,
        missingPermissionIds: [...input.permissionIds],
      };
    }
    const missing: PermissionId[] = [];
    const granted: PermissionId[] = [];
    for (const permissionId of input.permissionIds) {
      if (!requirements.has(permissionId)) {
        missing.push(permissionId);
        continue;
      }
      const rows = this.db.raw
        .prepare(
          `SELECT * FROM authority_grants
           WHERE workspace_id=? AND subject_kind=? AND subject_id=?
             AND capability_id=? AND permission_id=? AND scope=?`,
        )
        .all(
          input.workspaceId,
          input.subject.kind,
          input.subject.id,
          input.capabilityId,
          permissionId,
          input.scope,
        ) as GrantRow[];
      const allowed = rows.some(
        (row) =>
          sensitivityRank(input.sensitivity) <=
          sensitivityRank(SensitivitySchema.parse(row.max_sensitivity)),
      );
      if (allowed) granted.push(permissionId);
      else missing.push(permissionId);
    }
    if (missing.length > 0) {
      return {
        outcome: "DENY",
        reason: `Grant authority tidak lengkap untuk ${input.subject.kind}:${input.subject.id}/${input.capabilityId}.`,
        missingPermissionIds: missing,
      };
    }
    return {
      outcome: "ALLOW",
      reason: `Semua permission capability di-grant untuk workspace/scope yang diminta.`,
      grantedPermissionIds: granted,
    };
  }

  grant(
    input: CapabilityGrantRequest,
    now: Timestamp,
  ): { grants: CapabilityGrantView[]; deduplicated: boolean } {
    const requestFingerprint = fingerprint({
      action: "GRANT",
      ...input,
      permissionIds: [...input.permissionIds].sort(),
    });
    return this.mutate(input.idempotencyKey, requestFingerprint, now, () => {
      this.assertPermissionsAvailable(
        input.workspaceId,
        input.subject,
        input.capabilityId,
        input.permissionIds,
      );
      const tx = this.db.raw.transaction(() => {
        for (const permissionId of input.permissionIds) {
          this.db.raw
            .prepare(
              `INSERT INTO authority_grants(
                workspace_id,subject_kind,subject_id,capability_id,permission_id,scope,max_sensitivity,
                granted_at,operation_id,reason
              ) VALUES(?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(workspace_id,subject_kind,subject_id,capability_id,permission_id,scope)
              DO UPDATE SET max_sensitivity=excluded.max_sensitivity, granted_at=excluded.granted_at,
                operation_id=excluded.operation_id, reason=excluded.reason`,
            )
            .run(
              input.workspaceId,
              input.subject.kind,
              input.subject.id,
              input.capabilityId,
              permissionId,
              input.scope,
              input.maxSensitivity,
              now,
              input.operationId,
              input.reason,
            );
        }
        this.appendAuthorityEvent("GRANT", input, now);
        return {
          grants: this.listGrants({
            workspaceId: input.workspaceId,
            subject: input.subject,
          }).filter(
            (grant) => grant.capabilityId === input.capabilityId && grant.scope === input.scope,
          ),
          deduplicated: false,
        };
      });
      return tx();
    });
  }

  revoke(
    input: CapabilityRevokeRequest,
    now: Timestamp,
  ): { revoked: number; deduplicated: boolean } {
    const requestFingerprint = fingerprint({
      action: "REVOKE",
      ...input,
      permissionIds: [...input.permissionIds].sort(),
    });
    return this.mutate(input.idempotencyKey, requestFingerprint, now, () => {
      const tx = this.db.raw.transaction(() => {
        let revoked = 0;
        for (const permissionId of input.permissionIds) {
          const result = this.db.raw
            .prepare(
              `DELETE FROM authority_grants
               WHERE workspace_id=? AND subject_kind=? AND subject_id=?
                 AND capability_id=? AND permission_id=? AND scope=?`,
            )
            .run(
              input.workspaceId,
              input.subject.kind,
              input.subject.id,
              input.capabilityId,
              permissionId,
              input.scope,
            );
          revoked += Number(result.changes);
        }
        this.appendAuthorityEvent("REVOKE", input, now);
        return { revoked, deduplicated: false };
      });
      return tx();
    });
  }

  syncExtensionManifest(
    workspaceId: WorkspaceId,
    extensionId: string,
    manifest: ExtensionManifest,
    now: Timestamp,
  ): void {
    const subject: AuthoritySubject = { kind: "extension", id: extensionId };
    const tx = this.db.raw.transaction(() => {
      this.db.raw
        .prepare(
          "DELETE FROM authority_declarations WHERE workspace_id=? AND subject_kind=? AND subject_id=?",
        )
        .run(workspaceId, subject.kind, subject.id);
      for (const permission of manifest.permissions) {
        const capabilityId = extensionPermissionCapabilityId(permission);
        this.db.raw
          .prepare(
            `INSERT INTO authority_declarations(
              workspace_id,subject_kind,subject_id,capability_id,permission_id,action_class,
              resource,access,side_effect,description,source_ref,updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            workspaceId,
            subject.kind,
            subject.id,
            capabilityId,
            permission.id,
            permission.actionClass,
            permission.resource,
            permission.access,
            (permission.sideEffect ?? permission.actionClass !== "READ") ? 1 : 0,
            permission.reason,
            `extension:${manifest.id}@${manifest.version}`,
            now,
          );
      }
      this.db.raw
        .prepare(
          `DELETE FROM authority_grants
           WHERE workspace_id=? AND subject_kind='extension' AND subject_id=?
             AND NOT EXISTS (
               SELECT 1 FROM authority_declarations d
               WHERE d.workspace_id=authority_grants.workspace_id
                 AND d.subject_kind=authority_grants.subject_kind
                 AND d.subject_id=authority_grants.subject_id
                 AND d.capability_id=authority_grants.capability_id
                 AND d.permission_id=authority_grants.permission_id
             )`,
        )
        .run(workspaceId, extensionId);
      this.appendSimpleEvent({
        eventType: "DECLARATIONS_SYNCED",
        workspaceId,
        subject,
        capabilityId: null,
        permissionIds: manifest.permissions.map((permission) => permission.id),
        operationId: BASELINE_OPERATION,
        reason: `Manifest declaration sync ${manifest.id}@${manifest.version}.`,
        now,
      });
    });
    tx();
  }

  clearExtension(workspaceId: WorkspaceId, extensionId: string, now: Timestamp): void {
    this.clearSubject(workspaceId, { kind: "extension", id: extensionId }, now);
  }

  clearSubject(workspaceId: WorkspaceId, subject: AuthoritySubject, now: Timestamp): void {
    const tx = this.db.raw.transaction(() => {
      this.db.raw
        .prepare(
          "DELETE FROM authority_declarations WHERE workspace_id=? AND subject_kind=? AND subject_id=?",
        )
        .run(workspaceId, subject.kind, subject.id);
      this.db.raw
        .prepare(
          "DELETE FROM authority_grants WHERE workspace_id=? AND subject_kind=? AND subject_id=?",
        )
        .run(workspaceId, subject.kind, subject.id);
      this.appendSimpleEvent({
        eventType: "SUBJECT_CLEARED",
        workspaceId,
        subject,
        capabilityId: null,
        permissionIds: [],
        operationId: BASELINE_OPERATION,
        reason: "Subject authority declarations/grants cleared.",
        now,
      });
    });
    tx();
  }

  private requirementsFor(
    workspaceId: WorkspaceId,
    subject: AuthoritySubject,
    capabilityId: CapabilityId,
  ): Map<PermissionId, RequirementRow> {
    if (subject.kind === "extension" || subject.kind === "node") {
      const rows = this.db.raw
        .prepare(
          `SELECT permission_id,action_class,resource,access,side_effect,description
           FROM authority_declarations
           WHERE workspace_id=? AND subject_kind=? AND subject_id=? AND capability_id=?`,
        )
        .all(workspaceId, subject.kind, subject.id, capabilityId) as RequirementRow[];
      return new Map(rows.map((row) => [row.permission_id as PermissionId, row]));
    }
    const row = this.db.raw
      .prepare("SELECT permissions_json FROM capability_definitions WHERE id=?")
      .get(capabilityId) as { permissions_json: string } | undefined;
    if (row === undefined) return new Map();
    const definition = CapabilityDefinitionSchema.parse({
      id: capabilityId,
      description: "loaded",
      permissions: JSON.parse(row.permissions_json) as unknown,
    });
    return new Map(
      definition.permissions.map((permission) => [
        permission.id,
        {
          permission_id: permission.id,
          action_class: permission.actionClass,
          resource: permission.resource,
          access: permission.access,
          side_effect: permission.sideEffect ? 1 : 0,
          description: permission.description,
        },
      ]),
    );
  }

  private assertPermissionsAvailable(
    workspaceId: WorkspaceId,
    subject: AuthoritySubject,
    capabilityId: CapabilityId,
    permissionIds: readonly PermissionId[],
  ): void {
    const requirements = this.requirementsFor(workspaceId, subject, capabilityId);
    if (requirements.size === 0) {
      throw new CapabilityUnknownError(
        `Capability tidak dikenal/dideklarasikan untuk ${subject.kind}:${subject.id}: ${capabilityId}.`,
      );
    }
    const missing = permissionIds.filter((permissionId) => !requirements.has(permissionId));
    if (missing.length > 0) {
      throw new CapabilityUnknownError(
        `Permission tidak didefinisikan/dideklarasikan untuk ${capabilityId}: ${missing.join(", ")}.`,
      );
    }
  }

  private mutate<T extends { deduplicated: boolean }>(
    idempotencyKey: string,
    requestFingerprint: string,
    now: Timestamp,
    execute: () => T,
  ): T {
    const prior = this.db.raw
      .prepare(
        "SELECT fingerprint,result_json FROM authority_operations WHERE idempotency_key=?",
      )
      .get(idempotencyKey) as OperationRow | undefined;
    if (prior !== undefined) {
      if (prior.fingerprint !== requestFingerprint) {
        throw new CapabilityIdempotencyConflictError(idempotencyKey);
      }
      const parsed = JSON.parse(prior.result_json) as T;
      return { ...parsed, deduplicated: true };
    }
    const result = execute();
    this.db.raw
      .prepare(
        `INSERT INTO authority_operations(idempotency_key,fingerprint,result_json,completed_at)
         VALUES(?,?,?,?)`,
      )
      .run(idempotencyKey, requestFingerprint, JSON.stringify(result), now);
    return result;
  }

  private appendAuthorityEvent(
    eventType: "GRANT" | "REVOKE",
    input: CapabilityGrantRequest | CapabilityRevokeRequest,
    now: Timestamp,
  ): void {
    this.appendSimpleEvent({
      eventType,
      workspaceId: input.workspaceId,
      subject: input.subject,
      capabilityId: input.capabilityId,
      permissionIds: [...input.permissionIds],
      operationId: input.operationId,
      reason: input.reason,
      now,
    });
  }

  private appendSimpleEvent(input: {
    eventType: string;
    workspaceId: WorkspaceId;
    subject: AuthoritySubject;
    capabilityId: CapabilityId | null;
    permissionIds: readonly string[];
    operationId: OperationId;
    reason: string;
    now: Timestamp;
  }): void {
    this.db.raw
      .prepare(
        `INSERT INTO authority_events(
          event_id,event_type,workspace_id,subject_kind,subject_id,capability_id,
          permission_ids_json,operation_id,reason,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        eventId([
          input.eventType,
          input.workspaceId,
          input.subject.kind,
          input.subject.id,
          input.capabilityId ?? "",
          input.permissionIds.join(","),
          input.operationId,
          input.now,
        ]),
        input.eventType,
        input.workspaceId,
        input.subject.kind,
        input.subject.id,
        input.capabilityId,
        JSON.stringify(input.permissionIds),
        input.operationId,
        input.reason,
        input.now,
      );
  }

  private bootstrapDefinitions(): void {
    const upsert = this.db.raw.prepare(
      `INSERT INTO capability_definitions(id,description,permissions_json,updated_at)
       VALUES(?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET description=excluded.description,
         permissions_json=excluded.permissions_json, updated_at=excluded.updated_at`,
    );
    const tx = this.db.raw.transaction(() => {
      for (const definition of BUILTIN_CAPABILITIES) {
        upsert.run(
          definition.id,
          definition.description,
          JSON.stringify(definition.permissions),
          BASELINE_AT,
        );
      }
    });
    tx();
  }

  private bootstrapCompatibilityBaseline(): void {
    const existing = this.db.raw
      .prepare("SELECT value FROM authority_meta WHERE key=?")
      .get(BASELINE_KEY) as { value: string } | undefined;
    if (existing !== undefined) return;
    const tx = this.db.raw.transaction(() => {
      const baseline: readonly {
        subject: AuthoritySubject;
        capabilityId: CapabilityId;
        permissionIds: readonly PermissionId[];
      }[] = [
        {
          subject: { kind: "model", id: "hosted" },
          capabilityId: "model.invoke.hosted" as CapabilityId,
          permissionIds: [
            "model.invoke" as PermissionId,
            "network.connect" as PermissionId,
            "provider.spend" as PermissionId,
          ],
        },
        {
          subject: { kind: "model", id: "local" },
          capabilityId: "model.invoke.local" as CapabilityId,
          permissionIds: ["model.invoke" as PermissionId, "execution.local" as PermissionId],
        },
        {
          subject: { kind: "sandbox", id: "tier0" },
          capabilityId: "sandbox.execute" as CapabilityId,
          permissionIds: ["sandbox.execute" as PermissionId, "filesystem.read" as PermissionId],
        },
        {
          subject: { kind: "sandbox", id: "tier1.5" },
          capabilityId: "sandbox.execute" as CapabilityId,
          permissionIds: ["sandbox.execute" as PermissionId],
        },
        {
          subject: { kind: "sandbox", id: "tier1" },
          capabilityId: "sandbox.execute" as CapabilityId,
          permissionIds: [
            "sandbox.execute" as PermissionId,
            "filesystem.read" as PermissionId,
            "filesystem.write" as PermissionId,
          ],
        },
      ];
      for (const item of baseline) {
        for (const permissionId of item.permissionIds) {
          this.db.raw
            .prepare(
              `INSERT OR IGNORE INTO authority_grants(
                workspace_id,subject_kind,subject_id,capability_id,permission_id,scope,max_sensitivity,
                granted_at,operation_id,reason
              ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
            )
            .run(
              PERSONAL_WORKSPACE,
              item.subject.kind,
              item.subject.id,
              item.capabilityId,
              permissionId,
              "personal",
              "RESTRICTED",
              BASELINE_AT,
              BASELINE_OPERATION,
              "Batch 4 one-time migration of pre-existing core behavior; grant remains revocable.",
            );
        }
      }
      this.appendSimpleEvent({
        eventType: "BASELINE_MIGRATION",
        workspaceId: PERSONAL_WORKSPACE,
        subject: { kind: "tool", id: "authority-migration" },
        capabilityId: null,
        permissionIds: [],
        operationId: BASELINE_OPERATION,
        reason: "One-time explicit authority baseline migration.",
        now: BASELINE_AT,
      });
      this.db.raw
        .prepare("INSERT INTO authority_meta(key,value) VALUES(?,?)")
        .run(BASELINE_KEY, BASELINE_AT);
    });
    tx();
  }
}
