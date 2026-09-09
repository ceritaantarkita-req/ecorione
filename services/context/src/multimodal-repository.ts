import {
  ArtifactPointerSchema,
  ContextMultimodalContextResponseSchema,
  MultimodalAttachmentSchema,
  MultimodalDerivationSchema,
  maySendToHosted,
  sensitivityRank,
  type AttachmentId,
  type ContextCreateAttachmentRequest,
  type ContextMultimodalContextRequest,
  type ContextMultimodalContextResponse,
  type MultimodalAttachment,
  type MultimodalDerivation,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { ContextDatabase } from "./db.js";

interface AttachmentRow {
  id: string;
  workspace_id: string;
  artifact_id: string;
  media_kind: string;
  scope: string;
  sensitivity: string;
  sync_class: string;
  lifecycle_state: string;
  latest_derivation_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface BindingRow {
  id: string;
  path: string;
  description: string;
  mime_type: string;
  size_bytes: number;
  scope: string;
  sensitivity: string;
  sync_class: string;
}

interface DerivationRow {
  id: string;
  attachment_id: string;
  artifact_id: string;
  operation_id: string;
  session_id: string | null;
  task: string;
  result_json: string;
  target: string;
  provider: string;
  model: string;
  scope: string;
  sensitivity: string;
  sync_class: string;
  created_at: string;
}

export class MultimodalAttachmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Attachment multimodal tidak ditemukan: ${id}.`);
    this.name = "MultimodalAttachmentNotFoundError";
  }
}

export class MultimodalAttachmentConflictError extends Error {
  constructor(id: string) {
    super(`Attachment multimodal ${id} sudah terikat ke metadata berbeda.`);
    this.name = "MultimodalAttachmentConflictError";
  }
}

export class MultimodalDerivationConflictError extends Error {
  constructor(id: string) {
    super(`Derivasi multimodal ${id} sudah ada dengan payload berbeda.`);
    this.name = "MultimodalDerivationConflictError";
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class MultimodalRepository {
  constructor(readonly db: ContextDatabase) {}

  private binding(row: AttachmentRow): BindingRow {
    const binding = this.db.raw
      .prepare(
        `SELECT * FROM artifact_bindings
         WHERE id=? AND scope=? AND sensitivity=? AND sync_class=? LIMIT 1`,
      )
      .get(row.artifact_id, row.scope, row.sensitivity, row.sync_class) as
      | BindingRow
      | undefined;
    if (binding === undefined) {
      throw new MultimodalAttachmentConflictError(row.id);
    }
    return binding;
  }

  private attachmentFromRow(row: AttachmentRow): MultimodalAttachment {
    const binding = this.binding(row);
    return MultimodalAttachmentSchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      artifact: {
        id: binding.id,
        path: binding.path,
        description: binding.description,
        mimeType: binding.mime_type,
        sizeBytes: binding.size_bytes,
        scope: binding.scope,
        sensitivity: binding.sensitivity,
        syncClass: binding.sync_class,
      },
      mediaKind: row.media_kind,
      state: row.lifecycle_state,
      latestDerivationId: row.latest_derivation_id,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  createAttachment(input: ContextCreateAttachmentRequest): MultimodalAttachment {
    const existing = this.getAttachment(input.id, input.workspaceId);
    if (existing !== null) {
      const candidate = MultimodalAttachmentSchema.parse({
        id: input.id,
        workspaceId: input.workspaceId,
        artifact: input.artifact,
        mediaKind: input.mediaKind,
        state: existing.state,
        latestDerivationId: existing.latestDerivationId,
        error: existing.error,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      });
      if (
        candidate.artifact.id !== existing.artifact.id ||
        candidate.artifact.scope !== existing.artifact.scope ||
        candidate.artifact.sensitivity !== existing.artifact.sensitivity ||
        candidate.artifact.syncClass !== existing.artifact.syncClass ||
        candidate.mediaKind !== existing.mediaKind
      ) {
        throw new MultimodalAttachmentConflictError(input.id);
      }
      return existing;
    }

    const authorizedBinding = this.db.raw
      .prepare(
        `SELECT * FROM artifact_bindings
         WHERE id=? AND scope=? AND sensitivity=? AND sync_class=? LIMIT 1`,
      )
      .get(
        input.artifact.id,
        input.artifact.scope,
        input.artifact.sensitivity,
        input.artifact.syncClass ?? "LOCAL_ONLY",
      ) as BindingRow | undefined;
    if (authorizedBinding === undefined) {
      throw new MultimodalAttachmentConflictError(input.id);
    }
    ArtifactPointerSchema.parse({
      id: authorizedBinding.id,
      path: authorizedBinding.path,
      description: authorizedBinding.description,
      mimeType: authorizedBinding.mime_type,
      sizeBytes: authorizedBinding.size_bytes,
      scope: authorizedBinding.scope,
      sensitivity: authorizedBinding.sensitivity,
      syncClass: authorizedBinding.sync_class,
    });

    this.db.raw
      .prepare(
        `INSERT INTO multimodal_attachments(
          id,workspace_id,artifact_id,media_kind,scope,sensitivity,sync_class,lifecycle_state,
          latest_derivation_id,error,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,'UPLOADED',NULL,NULL,?,?)`,
      )
      .run(
        input.id,
        input.workspaceId,
        input.artifact.id,
        input.mediaKind,
        input.artifact.scope,
        input.artifact.sensitivity,
        input.artifact.syncClass ?? "LOCAL_ONLY",
        input.now,
        input.now,
      );
    return this.requireAttachment(input.id, input.workspaceId);
  }

  getAttachment(id: AttachmentId, workspaceId: WorkspaceId): MultimodalAttachment | null {
    const row = this.db.raw
      .prepare("SELECT * FROM multimodal_attachments WHERE id=? AND workspace_id=?")
      .get(id, workspaceId) as AttachmentRow | undefined;
    return row === undefined ? null : this.attachmentFromRow(row);
  }

  requireAttachment(id: AttachmentId, workspaceId: WorkspaceId): MultimodalAttachment {
    const attachment = this.getAttachment(id, workspaceId);
    if (attachment === null) throw new MultimodalAttachmentNotFoundError(id);
    return attachment;
  }

  markProcessing(id: AttachmentId, workspaceId: WorkspaceId, now: string): MultimodalAttachment {
    const existing = this.requireAttachment(id, workspaceId);
    this.db.raw
      .prepare(
        "UPDATE multimodal_attachments SET lifecycle_state='PROCESSING',error=NULL,updated_at=? WHERE id=? AND workspace_id=?",
      )
      .run(now, id, workspaceId);
    return { ...existing, state: "PROCESSING", error: null, updatedAt: now };
  }

  markFailed(
    id: AttachmentId,
    workspaceId: WorkspaceId,
    error: string,
    now: string,
  ): MultimodalAttachment {
    const existing = this.requireAttachment(id, workspaceId);
    this.db.raw
      .prepare(
        "UPDATE multimodal_attachments SET lifecycle_state='FAILED',error=?,updated_at=? WHERE id=? AND workspace_id=?",
      )
      .run(error.slice(0, 2048), now, id, workspaceId);
    return { ...existing, state: "FAILED", error: error.slice(0, 2048), updatedAt: now };
  }

  appendDerivation(input: MultimodalDerivation): MultimodalDerivation {
    const parsed = MultimodalDerivationSchema.parse(input);
    const existingRow = this.db.raw
      .prepare("SELECT * FROM multimodal_derivations WHERE id=?")
      .get(parsed.id) as DerivationRow | undefined;
    if (existingRow !== undefined) {
      const existing = this.derivationFromRow(existingRow);
      if (!sameJson(existing, parsed)) throw new MultimodalDerivationConflictError(parsed.id);
      return existing;
    }

    const attachment = this.requireAttachment(
      parsed.attachmentId,
      this.workspaceForAttachment(parsed.attachmentId),
    );
    if (
      attachment.artifact.id !== parsed.artifactId ||
      attachment.artifact.scope !== parsed.scope ||
      attachment.artifact.sensitivity !== parsed.sensitivity ||
      (attachment.artifact.syncClass ?? "LOCAL_ONLY") !== parsed.syncClass
    ) {
      throw new MultimodalDerivationConflictError(parsed.id);
    }

    const tx = this.db.raw.transaction(() => {
      this.db.raw
        .prepare(
          `INSERT INTO multimodal_derivations(
            id,attachment_id,artifact_id,operation_id,session_id,task,result_json,target,
            provider,model,scope,sensitivity,sync_class,created_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          parsed.id,
          parsed.attachmentId,
          parsed.artifactId,
          parsed.operationId,
          parsed.sessionId,
          parsed.task,
          JSON.stringify(parsed.result),
          parsed.target,
          parsed.provider,
          parsed.model,
          parsed.scope,
          parsed.sensitivity,
          parsed.syncClass,
          parsed.createdAt,
        );
      this.db.raw
        .prepare(
          `UPDATE multimodal_attachments
           SET lifecycle_state='READY',latest_derivation_id=?,error=NULL,updated_at=?
           WHERE id=?`,
        )
        .run(parsed.id, parsed.createdAt, parsed.attachmentId);
    });
    tx();
    return parsed;
  }

  private workspaceForAttachment(id: AttachmentId): WorkspaceId {
    const row = this.db.raw
      .prepare("SELECT workspace_id FROM multimodal_attachments WHERE id=?")
      .get(id) as { workspace_id: string } | undefined;
    if (row === undefined) throw new MultimodalAttachmentNotFoundError(id);
    return row.workspace_id as WorkspaceId;
  }

  private derivationFromRow(row: DerivationRow): MultimodalDerivation {
    return MultimodalDerivationSchema.parse({
      id: row.id,
      attachmentId: row.attachment_id,
      artifactId: row.artifact_id,
      operationId: row.operation_id,
      sessionId: row.session_id,
      task: row.task,
      result: JSON.parse(row.result_json) as unknown,
      target: row.target,
      provider: row.provider,
      model: row.model,
      scope: row.scope,
      sensitivity: row.sensitivity,
      syncClass: row.sync_class,
      createdAt: row.created_at,
    });
  }

  context(input: ContextMultimodalContextRequest): ContextMultimodalContextResponse {
    if (input.attachmentIds.length === 0) return { items: [] };
    const items: ContextMultimodalContextResponse["items"] = [];
    for (const id of input.attachmentIds) {
      const attachment = this.getAttachment(id, input.workspaceId);
      if (attachment === null || attachment.state !== "READY" || attachment.latestDerivationId === null)
        continue;
      if (attachment.artifact.scope !== input.scope) continue;
      if (
        sensitivityRank(attachment.artifact.sensitivity) > sensitivityRank(input.maxSensitivity)
      )
        continue;
      const syncClass = attachment.artifact.syncClass ?? "LOCAL_ONLY";
      if (input.hostedEligible && !maySendToHosted(syncClass)) continue;
      const row = this.db.raw
        .prepare("SELECT * FROM multimodal_derivations WHERE id=? AND attachment_id=?")
        .get(attachment.latestDerivationId, id) as DerivationRow | undefined;
      if (row === undefined) continue;
      const derivation = this.derivationFromRow(row);
      items.push({
        attachmentId: id,
        derivationId: derivation.id,
        task: derivation.task,
        text: derivation.result.text,
        language: derivation.result.language,
        target: derivation.target,
        provider: derivation.provider,
        model: derivation.model,
      });
    }
    return ContextMultimodalContextResponseSchema.parse({ items });
  }
}
