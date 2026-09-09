import { createHash } from "node:crypto";
import {
  ExtensionManifestSchema,
  type ExtensionHealthReportRequest,
  type ExtensionHealthStatus,
  type ExtensionId,
  type ExtensionInstallRequest,
  type ExtensionLifecycleState,
  type ExtensionManifest,
  type ExtensionRemoveRequest,
  type ExtensionRevisionId,
  type ExtensionRollbackRequest,
  type ExtensionUpdateRequest,
  type OperationId,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";
import {
  validateExtensionManifest,
  type ExtensionSecurityReport,
} from "./extension-security.js";

export type ExtensionChangeType = "INSTALL" | "UPDATE" | "ROLLBACK";
export type ExtensionOperationAction = ExtensionChangeType | "REMOVE" | "HEALTH";

export interface ExtensionRevision {
  readonly revisionId: ExtensionRevisionId;
  readonly workspaceId: WorkspaceId;
  readonly extensionId: ExtensionId;
  readonly manifest: ExtensionManifest;
  readonly manifestSha256: string;
  readonly changeType: ExtensionChangeType;
  readonly sourceRevisionId: ExtensionRevisionId | null;
  readonly operationId: OperationId;
  readonly createdAt: Timestamp;
}

export interface ExtensionView {
  readonly workspaceId: WorkspaceId;
  readonly extensionId: ExtensionId;
  readonly lifecycleState: ExtensionLifecycleState;
  readonly healthStatus: ExtensionHealthStatus;
  readonly healthDetail: string | null;
  readonly healthCheckedAt: Timestamp | null;
  readonly updatedAt: Timestamp;
  readonly removedAt: Timestamp | null;
  readonly currentRevision: ExtensionRevision;
}

export interface ExtensionMutationResult {
  readonly extension: ExtensionView;
  readonly revision: ExtensionRevision | null;
  readonly deduplicated: boolean;
}

interface RevisionRow {
  revision_id: string;
  workspace_id: string;
  extension_id: string;
  manifest_json: string;
  manifest_sha256: string;
  change_type: string;
  source_revision_id: string | null;
  operation_id: string;
  created_at: string;
}

interface ViewRow extends RevisionRow {
  lifecycle_state: string;
  health_status: string;
  health_detail: string | null;
  health_checked_at: string | null;
  updated_at: string;
  removed_at: string | null;
}

interface OperationRow {
  fingerprint: string;
  result_json: string;
}

export class ExtensionNotFoundError extends Error {
  constructor(workspaceId: string, extensionId: string) {
    super(`Extension tidak ditemukan di workspace ${workspaceId}: ${extensionId}.`);
    this.name = "ExtensionNotFoundError";
  }
}

export class ExtensionAlreadyInstalledError extends Error {
  constructor(extensionId: string) {
    super(`Extension sudah terpasang: ${extensionId}. Gunakan update.`);
    this.name = "ExtensionAlreadyInstalledError";
  }
}

export class ExtensionRevisionNotFoundError extends Error {
  constructor(revisionId: string) {
    super(`Revision extension tidak ditemukan: ${revisionId}.`);
    this.name = "ExtensionRevisionNotFoundError";
  }
}

export class ExtensionIdMismatchError extends Error {
  constructor(pathId: string, manifestId: string) {
    super(`Extension id route (${pathId}) berbeda dari manifest (${manifestId}).`);
    this.name = "ExtensionIdMismatchError";
  }
}

export class ExtensionNoChangeError extends Error {
  constructor(extensionId: string) {
    super(`Manifest extension tidak berubah: ${extensionId}.`);
    this.name = "ExtensionNoChangeError";
  }
}

export class ExtensionIdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency key extension sudah dipakai untuk request berbeda: ${key}.`);
    this.name = "ExtensionIdempotencyConflictError";
  }
}

export class ExtensionSecurityBlockedError extends Error {
  constructor(readonly report: ExtensionSecurityReport) {
    super(
      `Extension ditolak security gate: ${report.findings
        .filter((finding) => finding.severity === "BLOCK")
        .map((finding) => finding.code)
        .join(", ")}.`,
    );
    this.name = "ExtensionSecurityBlockedError";
  }
}

function rowToRevision(row: RevisionRow): ExtensionRevision {
  return {
    revisionId: row.revision_id as ExtensionRevisionId,
    workspaceId: row.workspace_id as WorkspaceId,
    extensionId: row.extension_id as ExtensionId,
    manifest: ExtensionManifestSchema.parse(JSON.parse(row.manifest_json) as unknown),
    manifestSha256: row.manifest_sha256,
    changeType: row.change_type as ExtensionChangeType,
    sourceRevisionId: row.source_revision_id as ExtensionRevisionId | null,
    operationId: row.operation_id as OperationId,
    createdAt: row.created_at as Timestamp,
  };
}

function rowToView(row: ViewRow): ExtensionView {
  return {
    workspaceId: row.workspace_id as WorkspaceId,
    extensionId: row.extension_id as ExtensionId,
    lifecycleState: row.lifecycle_state as ExtensionLifecycleState,
    healthStatus: row.health_status as ExtensionHealthStatus,
    healthDetail: row.health_detail,
    healthCheckedAt: row.health_checked_at as Timestamp | null,
    updatedAt: row.updated_at as Timestamp,
    removedAt: row.removed_at as Timestamp | null,
    currentRevision: rowToRevision(row),
  };
}

function fingerprint(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

function revisionId(input: {
  readonly action: ExtensionChangeType;
  readonly workspaceId: WorkspaceId;
  readonly extensionId: ExtensionId;
  readonly operationId: OperationId;
  readonly manifestSha256: string;
  readonly sourceRevisionId: ExtensionRevisionId | null;
}): ExtensionRevisionId {
  const digest = fingerprint([
    input.action,
    input.workspaceId,
    input.extensionId,
    input.operationId,
    input.manifestSha256,
    input.sourceRevisionId ?? "",
  ]);
  return `xrev_${digest.slice(0, 24)}` as ExtensionRevisionId;
}

export class ExtensionRegistry {
  constructor(private readonly db: HubDatabase) {}

  list(workspaceId: WorkspaceId): ExtensionView[] {
    const rows = this.db.raw
      .prepare(
        `SELECT i.*, r.revision_id, r.workspace_id, r.extension_id, r.manifest_json,
                r.manifest_sha256, r.change_type, r.source_revision_id, r.operation_id, r.created_at
         FROM extension_installations i
         JOIN extension_revisions r ON r.revision_id=i.current_revision_id
         WHERE i.workspace_id=?
         ORDER BY i.extension_id ASC`,
      )
      .all(workspaceId) as ViewRow[];
    return rows.map(rowToView);
  }

  get(workspaceId: WorkspaceId, extensionId: ExtensionId): ExtensionView | null {
    const row = this.db.raw
      .prepare(
        `SELECT i.*, r.revision_id, r.workspace_id, r.extension_id, r.manifest_json,
                r.manifest_sha256, r.change_type, r.source_revision_id, r.operation_id, r.created_at
         FROM extension_installations i
         JOIN extension_revisions r ON r.revision_id=i.current_revision_id
         WHERE i.workspace_id=? AND i.extension_id=?`,
      )
      .get(workspaceId, extensionId) as ViewRow | undefined;
    return row === undefined ? null : rowToView(row);
  }

  listRevisions(workspaceId: WorkspaceId, extensionId: ExtensionId): ExtensionRevision[] {
    return (
      this.db.raw
        .prepare(
          `SELECT * FROM extension_revisions
           WHERE workspace_id=? AND extension_id=?
           ORDER BY created_at ASC, rowid ASC`,
        )
        .all(workspaceId, extensionId) as RevisionRow[]
    ).map(rowToRevision);
  }

  validate(manifest: unknown): ExtensionSecurityReport {
    return validateExtensionManifest(manifest);
  }

  install(input: ExtensionInstallRequest, now: Timestamp): ExtensionMutationResult {
    const report = validateExtensionManifest(input.manifest);
    if (!report.allowed) throw new ExtensionSecurityBlockedError(report);
    const requestFingerprint = fingerprint([
      "INSTALL",
      input.workspaceId,
      report.manifest.id,
      report.manifestSha256,
    ]);
    return this.mutate(
      input.idempotencyKey,
      requestFingerprint,
      "INSTALL",
      input.workspaceId,
      report.manifest.id,
      input.operationId,
      now,
      () => {
        const current = this.get(input.workspaceId, report.manifest.id);
        if (current !== null && current.lifecycleState !== "REMOVED") {
          throw new ExtensionAlreadyInstalledError(report.manifest.id);
        }
        const revision = this.insertRevision({
          action: "INSTALL",
          workspaceId: input.workspaceId,
          extensionId: report.manifest.id,
          operationId: input.operationId,
          manifest: report.manifest,
          manifestSha256: report.manifestSha256,
          sourceRevisionId: null,
          now,
        });
        this.db.raw
          .prepare(
            `INSERT INTO extension_installations
              (workspace_id,extension_id,current_revision_id,lifecycle_state,health_status,
               health_detail,health_checked_at,updated_at,removed_at)
             VALUES (?, ?, ?, 'INSTALLED', 'UNKNOWN', NULL, NULL, ?, NULL)
             ON CONFLICT(workspace_id,extension_id) DO UPDATE SET
               current_revision_id=excluded.current_revision_id,
               lifecycle_state='INSTALLED', health_status='UNKNOWN', health_detail=NULL,
               health_checked_at=NULL, updated_at=excluded.updated_at, removed_at=NULL`,
          )
          .run(input.workspaceId, report.manifest.id, revision.revisionId, now);
        return { extension: this.requireView(input.workspaceId, report.manifest.id), revision };
      },
    );
  }

  update(
    extensionId: ExtensionId,
    input: ExtensionUpdateRequest,
    now: Timestamp,
  ): ExtensionMutationResult {
    const report = validateExtensionManifest(input.manifest);
    if (!report.allowed) throw new ExtensionSecurityBlockedError(report);
    if (report.manifest.id !== extensionId) {
      throw new ExtensionIdMismatchError(extensionId, report.manifest.id);
    }
    const requestFingerprint = fingerprint([
      "UPDATE",
      input.workspaceId,
      extensionId,
      report.manifestSha256,
    ]);
    return this.mutate(
      input.idempotencyKey,
      requestFingerprint,
      "UPDATE",
      input.workspaceId,
      extensionId,
      input.operationId,
      now,
      () => {
        const current = this.requireActive(input.workspaceId, extensionId);
        if (current.currentRevision.manifestSha256 === report.manifestSha256) {
          throw new ExtensionNoChangeError(extensionId);
        }
        const revision = this.insertRevision({
          action: "UPDATE",
          workspaceId: input.workspaceId,
          extensionId,
          operationId: input.operationId,
          manifest: report.manifest,
          manifestSha256: report.manifestSha256,
          sourceRevisionId: null,
          now,
        });
        this.db.raw
          .prepare(
            `UPDATE extension_installations
             SET current_revision_id=?, lifecycle_state='INSTALLED', health_status='UNKNOWN',
                 health_detail=NULL, health_checked_at=NULL, updated_at=?, removed_at=NULL
             WHERE workspace_id=? AND extension_id=?`,
          )
          .run(revision.revisionId, now, input.workspaceId, extensionId);
        return { extension: this.requireView(input.workspaceId, extensionId), revision };
      },
    );
  }

  rollback(
    extensionId: ExtensionId,
    input: ExtensionRollbackRequest,
    now: Timestamp,
  ): ExtensionMutationResult {
    const requestFingerprint = fingerprint([
      "ROLLBACK",
      input.workspaceId,
      extensionId,
      input.targetRevisionId,
    ]);
    return this.mutate(
      input.idempotencyKey,
      requestFingerprint,
      "ROLLBACK",
      input.workspaceId,
      extensionId,
      input.operationId,
      now,
      () => {
        const current = this.requireActive(input.workspaceId, extensionId);
        const target = this.getRevision(input.workspaceId, extensionId, input.targetRevisionId);
        if (target === null) throw new ExtensionRevisionNotFoundError(input.targetRevisionId);
        if (current.currentRevision.manifestSha256 === target.manifestSha256) {
          throw new ExtensionNoChangeError(extensionId);
        }
        const report = validateExtensionManifest(target.manifest);
        if (!report.allowed) throw new ExtensionSecurityBlockedError(report);
        const revision = this.insertRevision({
          action: "ROLLBACK",
          workspaceId: input.workspaceId,
          extensionId,
          operationId: input.operationId,
          manifest: target.manifest,
          manifestSha256: target.manifestSha256,
          sourceRevisionId: target.revisionId,
          now,
        });
        this.db.raw
          .prepare(
            `UPDATE extension_installations
             SET current_revision_id=?, lifecycle_state='INSTALLED', health_status='UNKNOWN',
                 health_detail=NULL, health_checked_at=NULL, updated_at=?, removed_at=NULL
             WHERE workspace_id=? AND extension_id=?`,
          )
          .run(revision.revisionId, now, input.workspaceId, extensionId);
        return { extension: this.requireView(input.workspaceId, extensionId), revision };
      },
    );
  }

  remove(
    extensionId: ExtensionId,
    input: ExtensionRemoveRequest,
    now: Timestamp,
  ): ExtensionMutationResult {
    const requestFingerprint = fingerprint([
      "REMOVE",
      input.workspaceId,
      extensionId,
      input.reason,
    ]);
    return this.mutate(
      input.idempotencyKey,
      requestFingerprint,
      "REMOVE",
      input.workspaceId,
      extensionId,
      input.operationId,
      now,
      () => {
        this.requireActive(input.workspaceId, extensionId);
        this.db.raw
          .prepare(
            `UPDATE extension_installations
             SET lifecycle_state='REMOVED', health_status='UNKNOWN', health_detail=NULL,
                 health_checked_at=NULL, updated_at=?, removed_at=?
             WHERE workspace_id=? AND extension_id=?`,
          )
          .run(now, now, input.workspaceId, extensionId);
        return { extension: this.requireView(input.workspaceId, extensionId), revision: null };
      },
    );
  }

  reportHealth(
    extensionId: ExtensionId,
    input: ExtensionHealthReportRequest,
    now: Timestamp,
  ): ExtensionMutationResult {
    const requestFingerprint = fingerprint([
      "HEALTH",
      input.workspaceId,
      extensionId,
      input.status,
      input.detail,
    ]);
    return this.mutate(
      input.idempotencyKey,
      requestFingerprint,
      "HEALTH",
      input.workspaceId,
      extensionId,
      input.operationId,
      now,
      () => {
        this.requireActive(input.workspaceId, extensionId);
        this.db.raw
          .prepare(
            `UPDATE extension_installations
             SET health_status=?, health_detail=?, health_checked_at=?, updated_at=?
             WHERE workspace_id=? AND extension_id=?`,
          )
          .run(input.status, input.detail, now, now, input.workspaceId, extensionId);
        return { extension: this.requireView(input.workspaceId, extensionId), revision: null };
      },
    );
  }

  private getRevision(
    workspaceId: WorkspaceId,
    extensionId: ExtensionId,
    revision: ExtensionRevisionId,
  ): ExtensionRevision | null {
    const row = this.db.raw
      .prepare(
        `SELECT * FROM extension_revisions
         WHERE workspace_id=? AND extension_id=? AND revision_id=?`,
      )
      .get(workspaceId, extensionId, revision) as RevisionRow | undefined;
    return row === undefined ? null : rowToRevision(row);
  }

  private requireView(workspaceId: WorkspaceId, extensionId: ExtensionId): ExtensionView {
    const view = this.get(workspaceId, extensionId);
    if (view === null) throw new ExtensionNotFoundError(workspaceId, extensionId);
    return view;
  }

  private requireActive(workspaceId: WorkspaceId, extensionId: ExtensionId): ExtensionView {
    const view = this.requireView(workspaceId, extensionId);
    if (view.lifecycleState === "REMOVED") {
      throw new ExtensionNotFoundError(workspaceId, extensionId);
    }
    return view;
  }

  private insertRevision(input: {
    readonly action: ExtensionChangeType;
    readonly workspaceId: WorkspaceId;
    readonly extensionId: ExtensionId;
    readonly operationId: OperationId;
    readonly manifest: ExtensionManifest;
    readonly manifestSha256: string;
    readonly sourceRevisionId: ExtensionRevisionId | null;
    readonly now: Timestamp;
  }): ExtensionRevision {
    const id = revisionId({
      action: input.action,
      workspaceId: input.workspaceId,
      extensionId: input.extensionId,
      operationId: input.operationId,
      manifestSha256: input.manifestSha256,
      sourceRevisionId: input.sourceRevisionId,
    });
    this.db.raw
      .prepare(
        `INSERT INTO extension_revisions
          (revision_id,workspace_id,extension_id,manifest_json,manifest_sha256,change_type,
           source_revision_id,operation_id,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.workspaceId,
        input.extensionId,
        JSON.stringify(input.manifest),
        input.manifestSha256,
        input.action,
        input.sourceRevisionId,
        input.operationId,
        input.now,
      );
    return {
      revisionId: id,
      workspaceId: input.workspaceId,
      extensionId: input.extensionId,
      manifest: input.manifest,
      manifestSha256: input.manifestSha256,
      changeType: input.action,
      sourceRevisionId: input.sourceRevisionId,
      operationId: input.operationId,
      createdAt: input.now,
    };
  }

  private mutate(
    idempotencyKey: string,
    requestFingerprint: string,
    action: ExtensionOperationAction,
    workspaceId: WorkspaceId,
    extensionId: ExtensionId,
    operationId: OperationId,
    now: Timestamp,
    mutation: () => Omit<ExtensionMutationResult, "deduplicated">,
  ): ExtensionMutationResult {
    return this.db.raw.transaction(() => {
      const prior = this.db.raw
        .prepare(
          "SELECT fingerprint,result_json FROM extension_operations WHERE idempotency_key=?",
        )
        .get(idempotencyKey) as OperationRow | undefined;
      if (prior !== undefined) {
        if (prior.fingerprint !== requestFingerprint) {
          throw new ExtensionIdempotencyConflictError(idempotencyKey);
        }
        const result = JSON.parse(prior.result_json) as Omit<
          ExtensionMutationResult,
          "deduplicated"
        >;
        return { ...result, deduplicated: true };
      }

      const result = mutation();
      this.db.raw
        .prepare(
          `INSERT INTO extension_operations
            (idempotency_key,fingerprint,operation_id,action,workspace_id,extension_id,
             result_json,completed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(
          idempotencyKey,
          requestFingerprint,
          operationId,
          action,
          workspaceId,
          extensionId,
          JSON.stringify(result),
          now,
        );
      return { ...result, deduplicated: false };
    })();
  }
}
