import {
  CapabilityAuthorizationRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityRevokeRequestSchema,
  ExtensionManifestSchema,
} from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { CapabilityIdempotencyConflictError, CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";

const opened: HubDatabase[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});
function setup(): CapabilityRegistry {
  const db = openHubDatabase();
  opened.push(db);
  return new CapabilityRegistry(db);
}
const T0 = "2026-09-09T15:30:00.000Z";

function mcpGrant(workspaceId = "ws_alpha") {
  return CapabilityGrantRequestSchema.parse({
    operationId: "op_authoritygrant001",
    workspaceId,
    subject: { kind: "mcp-tool", id: "remote/read" },
    capabilityId: "mcp.tool.call",
    permissionIds: ["mcp.tool.read"],
    scope: "personal",
    maxSensitivity: "INTERNAL",
    autonomy: "L1",
    reason: "Allow explicit read MCP tool.",
    idempotencyKey: `authority-grant-${workspaceId}`,
  });
}

function mcpAuthorize(workspaceId = "ws_alpha", sensitivity = "INTERNAL") {
  return CapabilityAuthorizationRequestSchema.parse({
    operationId: "op_authoritycheck001",
    workspaceId,
    subject: { kind: "mcp-tool", id: "remote/read" },
    capabilityId: "mcp.tool.call",
    permissionIds: ["mcp.tool.read"],
    scope: "personal",
    sensitivity,
    autonomy: "L1",
  });
}

describe("CapabilityRegistry", () => {
  it("fails closed until exact workspace/subject permission is granted", () => {
    const registry = setup();
    expect(registry.authorize(mcpAuthorize()).outcome).toBe("DENY");
    registry.grant(mcpGrant(), T0);
    expect(registry.authorize(mcpAuthorize()).outcome).toBe("ALLOW");
    expect(registry.authorize(mcpAuthorize("ws_beta")).outcome).toBe("DENY");
    expect(registry.authorize(mcpAuthorize("ws_alpha", "SENSITIVE")).outcome).toBe("DENY");
  });

  it("applies one-time explicit baseline grants and keeps them revocable", () => {
    const registry = setup();
    const baseline = CapabilityAuthorizationRequestSchema.parse({
      operationId: "op_baselinecheck001",
      workspaceId: "ws_personal",
      subject: { kind: "model", id: "hosted" },
      capabilityId: "model.invoke.hosted",
      permissionIds: ["model.invoke", "network.connect", "provider.spend"],
      scope: "personal",
      sensitivity: "RESTRICTED",
      autonomy: "L1",
    });
    expect(registry.authorize(baseline).outcome).toBe("ALLOW");
    registry.revoke(
      CapabilityRevokeRequestSchema.parse({
        operationId: "op_baselinerevoke01",
        workspaceId: "ws_personal",
        subject: { kind: "model", id: "hosted" },
        capabilityId: "model.invoke.hosted",
        permissionIds: ["provider.spend"],
        scope: "personal",
        maxSensitivity: "RESTRICTED",
        autonomy: "L1",
        reason: "Disable hosted spend.",
        idempotencyKey: "baseline-revoke-provider-spend",
      }),
      T0,
    );
    expect(registry.authorize(baseline).outcome).toBe("DENY");
    const second = new CapabilityRegistry(opened[0]!);
    expect(second.authorize(baseline).outcome).toBe("DENY");
  });

  it("requires extension declaration, grants it explicitly, and prunes stale grants on update", () => {
    const registry = setup();
    const digest = "a".repeat(64);
    const manifest = ExtensionManifestSchema.parse({
      apiVersion: "ecorione.extension/v1",
      id: "example.extension",
      name: "Example",
      version: "1.0.0",
      description: "Example",
      source: { type: "artifact", artifactId: `art_${digest}`, bundleSha256: digest },
      packageArtifactId: `art_${digest}`,
      execution: { kind: "none" },
      capabilities: [{ id: "example.read", description: "Read example." }],
      permissions: [
        {
          id: "example.read",
          actionClass: "READ",
          resource: "data",
          access: "read",
          sideEffect: false,
          reason: "Read example.",
        },
      ],
      secretRequirements: [],
    });
    registry.syncExtensionManifest("ws_alpha", manifest.id, manifest, T0);
    const grant = CapabilityGrantRequestSchema.parse({
      operationId: "op_extensiongrant01",
      workspaceId: "ws_alpha",
      subject: { kind: "extension", id: manifest.id },
      capabilityId: "example.read",
      permissionIds: ["example.read"],
      scope: "personal",
      maxSensitivity: "SENSITIVE",
      autonomy: "L1",
      reason: "User grants extension read.",
      idempotencyKey: "extension-example-read-grant",
    });
    registry.grant(grant, T0);
    const auth = CapabilityAuthorizationRequestSchema.parse({
      operationId: "op_extensionauth001",
      workspaceId: "ws_alpha",
      subject: { kind: "extension", id: manifest.id },
      capabilityId: "example.read",
      permissionIds: ["example.read"],
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
    });
    expect(registry.authorize(auth).outcome).toBe("ALLOW");

    const changed = ExtensionManifestSchema.parse({
      ...manifest,
      version: "1.1.0",
      capabilities: [{ id: "example.write", description: "Write example." }],
      permissions: [
        {
          id: "example.write",
          actionClass: "REVERSIBLE_WRITE",
          resource: "data",
          access: "write",
          sideEffect: true,
          reason: "Write example.",
        },
      ],
    });
    registry.syncExtensionManifest("ws_alpha", changed.id, changed, T0);
    expect(registry.authorize(auth).outcome).toBe("DENY");
    expect(registry.listGrants({ workspaceId: "ws_alpha", subject: { kind: "extension", id: manifest.id } })).toHaveLength(0);
  });

  it("returns idempotent result and rejects key reuse with a different grant", () => {
    const registry = setup();
    const first = registry.grant(mcpGrant(), T0);
    const second = registry.grant(mcpGrant(), T0);
    expect(second.deduplicated).toBe(true);
    expect(second.grants).toEqual(first.grants);
    expect(() =>
      registry.grant(
        CapabilityGrantRequestSchema.parse({
          ...mcpGrant(),
          permissionIds: ["mcp.tool.write"],
        }),
        T0,
      ),
    ).toThrow(CapabilityIdempotencyConflictError);
  });
});
