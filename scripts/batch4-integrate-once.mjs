import { readFileSync, writeFileSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function write(path, value) { writeFileSync(path, value); }
function mustReplace(path, from, to, count = 1) {
  let text = read(path);
  let hits = 0;
  while (hits < count) {
    const index = text.indexOf(from);
    if (index < 0) throw new Error(`Anchor not found in ${path}: ${from.slice(0, 80)}`);
    text = text.slice(0, index) + to + text.slice(index + from.length);
    hits += 1;
  }
  write(path, text);
}

// Shared authority helpers.
{
  const p = "packages/shared-schema/src/capabilities.ts";
  mustReplace(p,
    'import { ActionClassSchema, AutonomyLevelSchema } from "./policy.js";',
    'import { ActionClassSchema, AutonomyLevelSchema, type ActionClass } from "./policy.js";');
  mustReplace(p,
    'export type CapabilityPermission = z.infer<typeof CapabilityPermissionSchema>;\n',
    `export type CapabilityPermission = z.infer<typeof CapabilityPermissionSchema>;\n\nconst MCP_ACTION_PERMISSIONS: Readonly<Record<ActionClass, PermissionId>> = {\n  READ: "mcp.tool.read" as PermissionId,\n  REVERSIBLE_WRITE: "mcp.tool.write" as PermissionId,\n  IRREVERSIBLE_WRITE: "mcp.tool.irreversible-write" as PermissionId,\n  SPEND: "mcp.tool.spend" as PermissionId,\n  EXTERNAL_SEND: "mcp.tool.external-send" as PermissionId,\n  CREDENTIAL_ACCESS: "mcp.tool.credential-access" as PermissionId,\n  EXECUTE: "mcp.tool.execute" as PermissionId,\n  POLICY_ADMIN: "mcp.tool.policy-admin" as PermissionId,\n};\nexport function mcpPermissionForActionClass(actionClass: ActionClass): PermissionId {\n  return MCP_ACTION_PERMISSIONS[actionClass];\n}\n`);
}

// Registry correctness + deterministic receipts + compatibility migration.
{
  const p = "services/hub/src/capability-registry.ts";
  mustReplace(p,
    '  CapabilityDefinitionSchema,\n  SensitivitySchema,',
    '  CapabilityDefinitionSchema,\n  extensionPermissionCapabilityId,\n  SensitivitySchema,');
  const localMapStart = 'const MCP_ACTION_PERMISSIONS: Readonly<Record<ActionClass, PermissionId>> = {';
  let text = read(p);
  const start = text.indexOf(localMapStart);
  const endAnchor = 'function actionPermission(';
  const end = text.indexOf(endAnchor, start);
  if (start < 0 || end < 0) throw new Error("MCP map anchor missing");
  text = text.slice(0, start) + text.slice(end);
  write(p, text);
  mustReplace(p,
    'return this.mutate(input.idempotencyKey, requestFingerprint, () => {',
    'return this.mutate(input.idempotencyKey, requestFingerprint, now, () => {', 2);
  mustReplace(p,
    '    execute: () => T,\n  ): T {',
    '    now: Timestamp,\n    execute: () => T,\n  ): T {');
  mustReplace(p, 'JSON.stringify(result), new Date().toISOString());', 'JSON.stringify(result), now);');
  const oldSync = `      for (const capability of manifest.capabilities) {\n        for (const permission of manifest.permissions) {\n          this.db.raw\n            .prepare(\n              \`INSERT INTO authority_declarations(\n                workspace_id,subject_kind,subject_id,capability_id,permission_id,action_class,\n                resource,access,side_effect,description,source_ref,updated_at\n              ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)\`,\n            )\n            .run(\n              workspaceId,\n              subject.kind,\n              subject.id,\n              capability.id,\n              permission.id,\n              permission.actionClass,\n              permission.resource,\n              permission.access,\n              permission.sideEffect ?? permission.actionClass !== "READ" ? 1 : 0,\n              permission.reason,\n              \`extension:\${manifest.id}@\${manifest.version}\`,\n              now,\n            );\n        }\n      }`;
  const newSync = `      for (const permission of manifest.permissions) {\n        const capabilityId = extensionPermissionCapabilityId(permission);\n        this.db.raw\n          .prepare(\n            \`INSERT INTO authority_declarations(\n              workspace_id,subject_kind,subject_id,capability_id,permission_id,action_class,\n              resource,access,side_effect,description,source_ref,updated_at\n            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)\`,\n          )\n          .run(\n            workspaceId,\n            subject.kind,\n            subject.id,\n            capabilityId,\n            permission.id,\n            permission.actionClass,\n            permission.resource,\n            permission.access,\n            (permission.sideEffect ?? permission.actionClass !== "READ") ? 1 : 0,\n            permission.reason,\n            \`extension:\${manifest.id}@\${manifest.version}\`,\n            now,\n          );\n      }`;
  mustReplace(p, oldSync, newSync);
  mustReplace(p,
    '  clearSubject(workspaceId: WorkspaceId, subject: AuthoritySubject, now: Timestamp): void {',
    `  clearExtension(workspaceId: WorkspaceId, extensionId: string, now: Timestamp): void {\n    this.clearSubject(workspaceId, { kind: "extension", id: extensionId }, now);\n  }\n\n  clearSubject(workspaceId: WorkspaceId, subject: AuthoritySubject, now: Timestamp): void {`);
  const oldBaseline = `        {\n          subject: { kind: "model", id: "hosted" },\n          capabilityId: "model.invoke.hosted" as CapabilityId,\n          permissionIds: [\n            "model.invoke" as PermissionId,\n            "network.connect" as PermissionId,\n            "provider.spend" as PermissionId,\n          ],\n        },\n        {\n          subject: { kind: "sandbox", id: "tier0" },\n          capabilityId: "sandbox.execute" as CapabilityId,\n          permissionIds: ["sandbox.execute" as PermissionId, "filesystem.read" as PermissionId],\n        },`;
  const newBaseline = `        {\n          subject: { kind: "model", id: "hosted" },\n          capabilityId: "model.invoke.hosted" as CapabilityId,\n          permissionIds: [\n            "model.invoke" as PermissionId,\n            "network.connect" as PermissionId,\n            "provider.spend" as PermissionId,\n          ],\n        },\n        {\n          subject: { kind: "model", id: "local" },\n          capabilityId: "model.invoke.local" as CapabilityId,\n          permissionIds: ["model.invoke" as PermissionId, "execution.local" as PermissionId],\n        },\n        {\n          subject: { kind: "sandbox", id: "tier0" },\n          capabilityId: "sandbox.execute" as CapabilityId,\n          permissionIds: ["sandbox.execute" as PermissionId, "filesystem.read" as PermissionId],\n        },\n        {\n          subject: { kind: "sandbox", id: "tier1.5" },\n          capabilityId: "sandbox.execute" as CapabilityId,\n          permissionIds: ["sandbox.execute" as PermissionId],\n        },\n        {\n          subject: { kind: "sandbox", id: "tier1" },\n          capabilityId: "sandbox.execute" as CapabilityId,\n          permissionIds: [\n            "sandbox.execute" as PermissionId,\n            "filesystem.read" as PermissionId,\n            "filesystem.write" as PermissionId,\n          ],\n        },`;
  mustReplace(p, oldBaseline, newBaseline);
}

// Extension activation and authority declaration updates share the same SQLite transaction.
{
  const p = "services/hub/src/extension-registry.ts";
  mustReplace(p,
    'export class ExtensionRegistry {\n  constructor(private readonly db: HubDatabase) {}',
    `export interface ExtensionAuthorityPlane {\n  syncExtensionManifest(\n    workspaceId: WorkspaceId,\n    extensionId: string,\n    manifest: ExtensionManifest,\n    now: Timestamp,\n  ): void;\n  clearExtension(workspaceId: WorkspaceId, extensionId: string, now: Timestamp): void;\n}\n\nexport class ExtensionRegistry {\n  constructor(\n    private readonly db: HubDatabase,\n    private readonly authority?: ExtensionAuthorityPlane,\n  ) {}`);
  mustReplace(p,
    '          .run(input.workspaceId, report.manifest.id, revision.revisionId, now);\n        return { extension: this.requireView(input.workspaceId, report.manifest.id), revision };',
    '          .run(input.workspaceId, report.manifest.id, revision.revisionId, now);\n        this.authority?.syncExtensionManifest(input.workspaceId, report.manifest.id, report.manifest, now);\n        return { extension: this.requireView(input.workspaceId, report.manifest.id), revision };');
  mustReplace(p,
    '          .run(revision.revisionId, now, input.workspaceId, extensionId);\n        return { extension: this.requireView(input.workspaceId, extensionId), revision };',
    '          .run(revision.revisionId, now, input.workspaceId, extensionId);\n        this.authority?.syncExtensionManifest(input.workspaceId, extensionId, report.manifest, now);\n        return { extension: this.requireView(input.workspaceId, extensionId), revision };');
  mustReplace(p,
    '          .run(revision.revisionId, now, input.workspaceId, extensionId);\n        return { extension: this.requireView(input.workspaceId, extensionId), revision };',
    '          .run(revision.revisionId, now, input.workspaceId, extensionId);\n        this.authority?.syncExtensionManifest(input.workspaceId, extensionId, target.manifest, now);\n        return { extension: this.requireView(input.workspaceId, extensionId), revision };');
  mustReplace(p,
    '          .run(now, now, input.workspaceId, extensionId);\n        return { extension: this.requireView(input.workspaceId, extensionId), revision: null };',
    '          .run(now, now, input.workspaceId, extensionId);\n        this.authority?.clearExtension(input.workspaceId, extensionId, now);\n        return { extension: this.requireView(input.workspaceId, extensionId), revision: null };');
}

// Hub runtime owns the authority registry.
{
  const p = "services/hub/src/http.ts";
  mustReplace(p,
    'import { nowIso } from "./clock.js";',
    'import { nowIso } from "./clock.js";\nimport { registerCapabilityRoutes } from "./capability-http.js";\nimport { CapabilityRegistry } from "./capability-registry.js";');
  mustReplace(p,
    '  const history = new HistoryLedger(db);\n  const extensions = new ExtensionRegistry(db);',
    '  const history = new HistoryLedger(db);\n  const authority = new CapabilityRegistry(db);\n  const extensions = new ExtensionRegistry(db, authority);');
  mustReplace(p,
    '    history,\n    contextUrl:',
    '    history,\n    authority,\n    contextUrl:');
  mustReplace(p,
    '  registerExtensionRoutes(app, extensions, repo);',
    '  registerCapabilityRoutes(app, authority, repo);\n  registerExtensionRoutes(app, extensions, repo);');
  mustReplace(p,
    '  if (err instanceof PolicyEngineBugError) return err;',
    '  if (err instanceof PolicyEngineBugError) return err;\n  if (err instanceof CapabilityAuthorityDeniedError) {\n    return new HttpError(403, "CAPABILITY_DENIED", err.message);\n  }');
  mustReplace(p,
    '  PolicyEngineBugError,\n  UpstreamError,',
    '  CapabilityAuthorityDeniedError,\n  PolicyEngineBugError,\n  UpstreamError,');
}

// Chat carries workspace identity and checks model authority before provider/data egress.
{
  const p = "packages/shared-schema/src/chat.ts";
  mustReplace(p,
    'import { MemoryFactIdSchema, OperationIdSchema, SessionIdSchema } from "./ids.js";',
    'import { MemoryFactIdSchema, OperationIdSchema, SessionIdSchema, WorkspaceIdSchema } from "./ids.js";');
  mustReplace(p,
    '  sessionId: SessionIdSchema,\n  message:',
    '  sessionId: SessionIdSchema,\n  workspaceId: WorkspaceIdSchema.optional(),\n  message:');
}
{
  const p = "services/hub/src/orchestrate.ts";
  mustReplace(p,
    '  makeId,\n  type ActionRequest,',
    '  assertId,\n  makeId,\n  type ActionRequest,\n  type CapabilityId,\n  type PermissionId,');
  mustReplace(p,
    'import type { HistoryLedger } from "./history-ledger.js";',
    'import type { CapabilityRegistry } from "./capability-registry.js";\nimport type { HistoryLedger } from "./history-ledger.js";');
  mustReplace(p,
    'export class PolicyEngineBugError extends Error {',
    `export class CapabilityAuthorityDeniedError extends Error {\n  constructor(message: string) {\n    super(message);\n    this.name = "CapabilityAuthorityDeniedError";\n  }\n}\nexport class PolicyEngineBugError extends Error {`);
  mustReplace(p,
    '  readonly history: HistoryLedger;\n  readonly contextUrl:',
    '  readonly history: HistoryLedger;\n  readonly authority: CapabilityRegistry;\n  readonly contextUrl:');
  mustReplace(p,
    '  // Hosted chat is explicitly cloud-eligible.',
    `  const workspaceId = req.workspaceId ?? assertId("workspace", "ws_personal");\n  const authority = deps.authority.authorize({\n    operationId,\n    workspaceId,\n    subject: { kind: "model", id: "hosted" },\n    capabilityId: "model.invoke.hosted" as CapabilityId,\n    permissionIds: [\n      "model.invoke" as PermissionId,\n      "network.connect" as PermissionId,\n      "provider.spend" as PermissionId,\n    ],\n    scope: req.scope,\n    sensitivity: req.maxSensitivity,\n    autonomy: req.autonomy,\n  });\n  if (authority.outcome === "DENY") {\n    throw new CapabilityAuthorityDeniedError(authority.reason);\n  }\n\n  // Hosted chat is explicitly cloud-eligible.`);
}

// Flow gets workspace identity; AI and Sandbox paths both go through authority.
{
  const p = "packages/shared-schema/src/flow.ts";
  mustReplace(p,
    'import { OperationIdSchema, WorkflowIdSchema, type WorkflowId } from "./ids.js";',
    'import { OperationIdSchema, WorkflowIdSchema, WorkspaceIdSchema, type WorkflowId } from "./ids.js";');
  mustReplace(p,
    'export const FlowStartRequestSchema = z.object({\n  scope:',
    'export const FlowStartRequestSchema = z.object({\n  workspaceId: WorkspaceIdSchema.optional(),\n  scope:');
}
{
  const p = "services/flow/src/activities.ts";
  mustReplace(p,
    '  assertId,\n  type FlowWorkflowInput,',
    '  assertId,\n  CapabilityAuthorizationResultSchema,\n  type CapabilityId,\n  type FlowWorkflowInput,\n  type PermissionId,');
  mustReplace(p,
    'export function createFlowActivities(config: FlowActivityConfig): FlowActivities {',
    `const PERSONAL_WORKSPACE = assertId("workspace", "ws_personal");\n\nexport function createFlowActivities(config: FlowActivityConfig): FlowActivities {`);
  mustReplace(p,
    '    async callAi({ flow, transformed }): Promise<{ readonly reply: string }> {\n      const operationId = childOperationId(flow.operationId, "ai");',
    `    async callAi({ flow, transformed }): Promise<{ readonly reply: string }> {\n      const operationId = childOperationId(flow.operationId, "ai");\n      const workspaceId = flow.workspaceId ?? PERSONAL_WORKSPACE;\n      const hosted = flow.aiTarget === "hosted";\n      const authority = CapabilityAuthorizationResultSchema.parse(\n        await httpJson<unknown>(\`\${config.hubUrl}/v1/authority/authorize\`, {\n          method: "POST",\n          token: config.token,\n          body: {\n            operationId,\n            workspaceId,\n            subject: { kind: "model", id: flow.aiTarget },\n            capabilityId: (hosted ? "model.invoke.hosted" : "model.invoke.local") as CapabilityId,\n            permissionIds: (hosted\n              ? ["model.invoke", "network.connect", "provider.spend"]\n              : ["model.invoke", "execution.local"]) as PermissionId[],\n            scope: flow.scope,\n            sensitivity: flow.sensitivity,\n            autonomy: "L2",\n          },\n        }),\n      );\n      if (authority.outcome === "DENY") {\n        throw new Error(\`Flow model authority ditolak: \${authority.reason}\`);\n      }`);
  mustReplace(p,
    '          operationId,\n          tier: flow.execution.tier,',
    '          operationId,\n          workspaceId: flow.workspaceId ?? PERSONAL_WORKSPACE,\n          tier: flow.execution.tier,');
}

// Outbound MCP checks standing grants before policy/approval and before network connection.
{
  const p = "services/connect/src/mcp-client/governance.ts";
  mustReplace(p,
    '  type ActionRequest,',
    '  CapabilityAuthorizationResultSchema,\n  mcpPermissionForActionClass,\n  type ActionRequest,\n  type CapabilityId,\n  type PermissionId,');
  mustReplace(p,
    '  async authorize(request: McpGovernanceRequest): Promise<void> {\n    if (request.actionClass !== "READ"',
    `  async authorize(request: McpGovernanceRequest): Promise<void> {\n    const discover = request.toolName === "server.discover";\n    const authority = CapabilityAuthorizationResultSchema.parse(\n      await httpJson<unknown>(\`\${this.hubUrl}/v1/authority/authorize\`, {\n        token: this.token,\n        body: {\n          operationId: request.context.operationId,\n          workspaceId: request.context.workspaceId,\n          subject: { kind: "mcp-tool", id: \`\${request.server.id}/\${request.toolName}\` },\n          capabilityId: (discover ? "mcp.discover" : "mcp.tool.call") as CapabilityId,\n          permissionIds: [\n            discover ? ("mcp.read" as PermissionId) : mcpPermissionForActionClass(request.actionClass),\n          ],\n          scope: request.context.scope,\n          sensitivity: request.context.sensitivity,\n          autonomy: request.context.autonomy,\n        },\n      }),\n    );\n    if (authority.outcome === "DENY") throw new McpPolicyDeniedError(authority.reason);\n\n    if (request.server.transport.credentialRef !== undefined) {\n      const credentialAuthority = CapabilityAuthorizationResultSchema.parse(\n        await httpJson<unknown>(\`\${this.hubUrl}/v1/authority/authorize\`, {\n          token: this.token,\n          body: {\n            operationId: request.context.operationId,\n            workspaceId: request.context.workspaceId,\n            subject: { kind: "mcp-tool", id: \`\${request.server.id}/\${request.toolName}\` },\n            capabilityId: "secret.access" as CapabilityId,\n            permissionIds: ["credential.use" as PermissionId],\n            scope: request.context.scope,\n            sensitivity: request.context.sensitivity,\n            autonomy: request.context.autonomy,\n          },\n        }),\n      );\n      if (credentialAuthority.outcome === "DENY") {\n        throw new McpPolicyDeniedError(credentialAuthority.reason);\n      }\n    }\n\n    if (request.actionClass !== "READ"`);
}

// Acceptance-only fake control remains explicit rather than bypassing production authority.
{
  const p = "test/phase3-runtime.test.ts";
  mustReplace(p,
    'const allowControl: SandboxControlPlane = {\n  async evaluate(): Promise<PolicyVerdict> {',
    'const allowControl: SandboxControlPlane = {\n  async authorize() {\n    return { outcome: "ALLOW", reason: "runtime acceptance", grantedPermissionIds: ["sandbox.execute"] };\n  },\n  async evaluate(): Promise<PolicyVerdict> {');
}

console.log("Batch 4 integration patch applied.");
