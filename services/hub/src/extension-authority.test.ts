import {
  ExtensionInstallRequestSchema,
  ExtensionUpdateRequestSchema,
  type CapabilityGrantRequest,
  type ExtensionManifest,
  type Timestamp,
} from "@ecorione/shared-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { ExtensionRegistry } from "./extension-registry.js";

const T0 = "2026-09-09T16:00:00.000Z" as Timestamp;
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
let db: HubDatabase;
let authority: CapabilityRegistry;
let extensions: ExtensionRegistry;

beforeEach(() => {
  db = openHubDatabase();
  authority = new CapabilityRegistry(db);
  extensions = new ExtensionRegistry(db, authority);
});
afterEach(() => db.close());

function manifest(version: string, digest: string, withPermission = true): ExtensionManifest {
  return {
    apiVersion: "ecorione.extension/v1",
    id: "authority.demo",
    name: "Authority Demo",
    version,
    description: "Authority lifecycle fixture.",
    source: {
      type: "github",
      repository: "example/authority-demo",
      commitSha: version === "1.0.0" ? "1".repeat(40) : "2".repeat(40),
      bundleSha256: digest,
    },
    packageArtifactId: `art_${digest}` as ExtensionManifest["packageArtifactId"],
    execution: { kind: "none" },
    capabilities: withPermission ? [{ id: "demo.read", description: "Read demo data." }] : [],
    permissions: withPermission
      ? [
          {
            id: "demo.read",
            capabilityId: "demo.read",
            actionClass: "READ",
            resource: "data",
            access: "read",
            sideEffect: false,
            reason: "Read demo data.",
          },
        ]
      : [],
    secretRequirements: [],
  };
}

function grant(): CapabilityGrantRequest {
  return {
    operationId: "op_extauthoritygrant01" as CapabilityGrantRequest["operationId"],
    workspaceId: "ws_alpha" as CapabilityGrantRequest["workspaceId"],
    subject: { kind: "extension", id: "authority.demo" },
    capabilityId: "demo.read" as CapabilityGrantRequest["capabilityId"],
    permissionIds: ["demo.read" as CapabilityGrantRequest["permissionIds"][number]],
    scope: "personal",
    maxSensitivity: "INTERNAL",
    autonomy: "L1",
    reason: "Test approved extension grant.",
    idempotencyKey: "extension-authority-grant",
  };
}

describe("Extension authority lifecycle", () => {
  it("syncs declarations, permits explicit grant, and prunes stale grant on update", () => {
    const first = manifest("1.0.0", DIGEST_A, true);
    extensions.install(
      ExtensionInstallRequestSchema.parse({
        operationId: "op_extauthorityinstall",
        workspaceId: "ws_alpha",
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "extension-authority-install",
        manifest: first,
      }),
      T0,
    );

    const before = authority.authorize({
      operationId: "op_extauthoritycheck1" as never,
      workspaceId: "ws_alpha" as never,
      subject: { kind: "extension", id: first.id },
      capabilityId: "demo.read" as never,
      permissionIds: ["demo.read" as never],
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
    });
    expect(before.outcome).toBe("DENY");

    authority.grant(grant(), T0);
    expect(
      authority.authorize({
        operationId: "op_extauthoritycheck2" as never,
        workspaceId: "ws_alpha" as never,
        subject: { kind: "extension", id: first.id },
        capabilityId: "demo.read" as never,
        permissionIds: ["demo.read" as never],
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
      }).outcome,
    ).toBe("ALLOW");

    extensions.update(
      first.id,
      ExtensionUpdateRequestSchema.parse({
        operationId: "op_extauthorityupdate",
        workspaceId: "ws_alpha",
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "extension-authority-update",
        manifest: manifest("2.0.0", DIGEST_B, false),
      }),
      T0,
    );

    expect(authority.listGrants({ workspaceId: "ws_alpha" as never })).toEqual([]);
    expect(
      authority.authorize({
        operationId: "op_extauthoritycheck3" as never,
        workspaceId: "ws_alpha" as never,
        subject: { kind: "extension", id: first.id },
        capabilityId: "demo.read" as never,
        permissionIds: ["demo.read" as never],
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
      }).outcome,
    ).toBe("DENY");
  });
});
