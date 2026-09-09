import {
  ExtensionHealthReportRequestSchema,
  ExtensionInstallRequestSchema,
  ExtensionRemoveRequestSchema,
  ExtensionRollbackRequestSchema,
  ExtensionUpdateRequestSchema,
  OperationIdSchema,
  TimestampSchema,
  WorkspaceIdSchema,
  type ExtensionManifest,
} from "@ecorione/shared-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openHubDatabase, type HubDatabase } from "./db.js";
import {
  ExtensionIdempotencyConflictError,
  ExtensionRegistry,
  ExtensionSecurityBlockedError,
} from "./extension-registry.js";

let db: HubDatabase;
let registry: ExtensionRegistry;
const workspaceA = WorkspaceIdSchema.parse("ws_a");
const workspaceB = WorkspaceIdSchema.parse("ws_b");
const now1 = TimestampSchema.parse("2026-09-09T14:00:00.000Z");
const now2 = TimestampSchema.parse("2026-09-09T14:01:00.000Z");
const now3 = TimestampSchema.parse("2026-09-09T14:02:00.000Z");

function manifest(version = "1.0.0", char = "a"): ExtensionManifest {
  const digest = char.repeat(64);
  return {
    apiVersion: "ecorione.extension/v1",
    id: "example.extension",
    name: "Example Extension",
    version,
    description: "Registry fixture.",
    source: {
      type: "github",
      repository: "example/extension",
      commitSha: char.repeat(40),
      bundleSha256: digest,
    },
    packageArtifactId: `art_${digest}` as ExtensionManifest["packageArtifactId"],
    execution: { kind: "none" },
    capabilities: [],
    permissions: [],
    secretRequirements: [],
  };
}

function installRequest(workspaceId = workspaceA, key = "install-key-0001") {
  return ExtensionInstallRequestSchema.parse({
    operationId: OperationIdSchema.parse("op_install"),
    workspaceId,
    scope: "personal",
    sensitivity: "INTERNAL",
    autonomy: "L1",
    idempotencyKey: key,
    manifest: manifest(),
  });
}

beforeEach(() => {
  db = openHubDatabase();
  registry = new ExtensionRegistry(db);
});

afterEach(() => db.close());

describe("ExtensionRegistry", () => {
  it("installs durably and isolates workspace visibility", () => {
    const installed = registry.install(installRequest(), now1);
    expect(installed.deduplicated).toBe(false);
    expect(installed.extension.extensionId).toBe("example.extension");
    expect(installed.extension.lifecycleState).toBe("INSTALLED");
    expect(registry.list(workspaceA)).toHaveLength(1);
    expect(registry.list(workspaceB)).toHaveLength(0);
  });

  it("deduplicates the same install and rejects key reuse for different input", () => {
    const request = installRequest();
    const first = registry.install(request, now1);
    const second = registry.install(request, now2);
    expect(second.deduplicated).toBe(true);
    expect(second.revision?.revisionId).toBe(first.revision?.revisionId);
    expect(registry.listRevisions(workspaceA, "example.extension")).toHaveLength(1);

    const conflicting = ExtensionInstallRequestSchema.parse({
      ...request,
      manifest: manifest("1.0.1", "b"),
    });
    expect(() => registry.install(conflicting, now2)).toThrow(ExtensionIdempotencyConflictError);
  });

  it("appends update and rollback revisions without rewriting history", () => {
    const installed = registry.install(installRequest(), now1);
    const firstRevision = installed.revision!;
    const updated = registry.update(
      "example.extension",
      ExtensionUpdateRequestSchema.parse({
        operationId: OperationIdSchema.parse("op_update"),
        workspaceId: workspaceA,
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "update-key-0001",
        manifest: manifest("2.0.0", "b"),
      }),
      now2,
    );
    expect(updated.extension.currentRevision.manifest.version).toBe("2.0.0");

    const rolledBack = registry.rollback(
      "example.extension",
      ExtensionRollbackRequestSchema.parse({
        operationId: OperationIdSchema.parse("op_rollback"),
        workspaceId: workspaceA,
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "rollback-key-0001",
        targetRevisionId: firstRevision.revisionId,
      }),
      now3,
    );
    expect(rolledBack.extension.currentRevision.manifest.version).toBe("1.0.0");
    expect(rolledBack.revision?.changeType).toBe("ROLLBACK");
    expect(rolledBack.revision?.sourceRevisionId).toBe(firstRevision.revisionId);
    expect(registry.listRevisions(workspaceA, "example.extension")).toHaveLength(3);
  });

  it("enforces append-only revision history at SQLite boundary", () => {
    const installed = registry.install(installRequest(), now1);
    const revisionId = installed.revision!.revisionId;
    expect(() =>
      db.raw.prepare("UPDATE extension_revisions SET manifest_sha256=? WHERE revision_id=?").run(
        "f".repeat(64),
        revisionId,
      ),
    ).toThrow(/append-only/);
    expect(() =>
      db.raw.prepare("DELETE FROM extension_revisions WHERE revision_id=?").run(revisionId),
    ).toThrow(/append-only/);
  });

  it("removes installation without deleting provenance and supports durable health receipts", () => {
    registry.install(installRequest(), now1);
    const health = registry.reportHealth(
      "example.extension",
      ExtensionHealthReportRequestSchema.parse({
        operationId: OperationIdSchema.parse("op_health"),
        workspaceId: workspaceA,
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "health-key-0001",
        status: "HEALTHY",
        detail: "Runtime dependency reachable.",
      }),
      now2,
    );
    expect(health.extension.healthStatus).toBe("HEALTHY");

    const removed = registry.remove(
      "example.extension",
      ExtensionRemoveRequestSchema.parse({
        operationId: OperationIdSchema.parse("op_remove"),
        workspaceId: workspaceA,
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L1",
        idempotencyKey: "remove-key-0001",
        reason: "No longer needed.",
      }),
      now3,
    );
    expect(removed.extension.lifecycleState).toBe("REMOVED");
    expect(registry.listRevisions(workspaceA, "example.extension")).toHaveLength(1);
  });

  it("fails closed when security gate blocks the manifest", () => {
    const request = installRequest();
    const blocked = ExtensionInstallRequestSchema.parse({
      ...request,
      idempotencyKey: "blocked-key-0001",
      manifest: {
        ...manifest(),
        packageArtifactId: `art_${"c".repeat(64)}`,
      },
    });
    expect(() => registry.install(blocked, now1)).toThrow(ExtensionSecurityBlockedError);
    expect(registry.list(workspaceA)).toHaveLength(0);
  });
});
