import {
  ProjectExternalSourceLifecycleSchema,
  ProjectSourceBindingSchema,
  projectSourceOwner,
  type ArtifactId,
  type EpisodeId,
  type ProjectExternalSourceLifecycle,
  type ProjectExternalSourceType,
  type ProjectId,
  type ProjectSourceBinding,
  type ProjectSourceResourceType,
  type ProjectSourceRole,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface BindingRow {
  project_id: string;
  workspace_id: string;
  resource_type: string;
  resource_id: string;
  owner: string;
  role: string;
  created_at: string;
}

interface ExternalLifecycleRow {
  project_id: string;
  workspace_id: string;
  source_type: string;
  source_key: string;
  role: string;
  latest_artifact_id: string;
  latest_context_episode_id: string | null;
  state: string;
  last_refreshed_at: string;
  last_indexed_at: string | null;
  updated_at: string;
}

function rowToBinding(row: BindingRow): ProjectSourceBinding {
  return ProjectSourceBindingSchema.parse({
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    owner: row.owner,
    role: row.role,
    createdAt: row.created_at,
  });
}

function rowToExternalLifecycle(row: ExternalLifecycleRow): ProjectExternalSourceLifecycle {
  return ProjectExternalSourceLifecycleSchema.parse({
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    role: row.role,
    latestArtifactId: row.latest_artifact_id,
    latestContextEpisodeId: row.latest_context_episode_id,
    state: row.state,
    lastRefreshedAt: row.last_refreshed_at,
    lastIndexedAt: row.last_indexed_at,
    updatedAt: row.updated_at,
  });
}

export interface UpsertProjectExternalSourceInput {
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId;
  readonly sourceType: ProjectExternalSourceType;
  readonly sourceKey: string;
  readonly role: ProjectSourceRole;
  readonly latestArtifactId: ArtifactId;
  readonly refreshedAt: Timestamp;
}

export interface AttachProjectSourceInput {
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId;
  readonly resourceType: ProjectSourceResourceType;
  readonly resourceId: string;
  readonly role: ProjectSourceRole;
  readonly createdAt: Timestamp;
}

export interface DetachProjectSourceInput {
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId;
  readonly resourceType: ProjectSourceResourceType;
  readonly resourceId: string;
  readonly role: ProjectSourceRole;
}

export class ProjectSourceRegistry {
  constructor(private readonly db: HubDatabase) {}

  list(projectId: ProjectId, workspaceId: WorkspaceId): ProjectSourceBinding[] {
    const rows = this.db.raw
      .prepare(
        `SELECT * FROM project_source_bindings
         WHERE project_id=? AND workspace_id=?
         ORDER BY created_at DESC, resource_type ASC, resource_id ASC, role ASC`,
      )
      .all(projectId, workspaceId) as BindingRow[];
    return rows.map(rowToBinding);
  }

  attach(input: AttachProjectSourceInput): {
    readonly binding: ProjectSourceBinding;
    readonly created: boolean;
  } {
    const existing = this.db.raw
      .prepare(
        `SELECT * FROM project_source_bindings
         WHERE project_id=? AND workspace_id=? AND resource_type=? AND resource_id=? AND role=?`,
      )
      .get(
        input.projectId,
        input.workspaceId,
        input.resourceType,
        input.resourceId,
        input.role,
      ) as BindingRow | undefined;
    if (existing !== undefined) return { binding: rowToBinding(existing), created: false };

    const owner = projectSourceOwner(input.resourceType);
    this.db.raw
      .prepare(
        `INSERT INTO project_source_bindings
         (project_id,workspace_id,resource_type,resource_id,owner,role,created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run(
        input.projectId,
        input.workspaceId,
        input.resourceType,
        input.resourceId,
        owner,
        input.role,
        input.createdAt,
      );
    return {
      binding: ProjectSourceBindingSchema.parse({
        ...input,
        owner,
      }),
      created: true,
    };
  }

  detach(input: DetachProjectSourceInput): ProjectSourceBinding | null {
    const existing = this.db.raw
      .prepare(
        `SELECT * FROM project_source_bindings
         WHERE project_id=? AND workspace_id=? AND resource_type=? AND resource_id=? AND role=?`,
      )
      .get(
        input.projectId,
        input.workspaceId,
        input.resourceType,
        input.resourceId,
        input.role,
      ) as BindingRow | undefined;
    if (existing === undefined) return null;
    this.db.raw
      .prepare(
        `DELETE FROM project_source_bindings
         WHERE project_id=? AND workspace_id=? AND resource_type=? AND resource_id=? AND role=?`,
      )
      .run(
        input.projectId,
        input.workspaceId,
        input.resourceType,
        input.resourceId,
        input.role,
      );
    return rowToBinding(existing);
  }

  listExternalLifecycle(
    projectId: ProjectId,
    workspaceId: WorkspaceId,
  ): ProjectExternalSourceLifecycle[] {
    const rows = this.db.raw
      .prepare(
        `SELECT * FROM project_external_source_lifecycle
         WHERE project_id=? AND workspace_id=?
         ORDER BY updated_at DESC, source_type ASC, source_key ASC, role ASC`,
      )
      .all(projectId, workspaceId) as ExternalLifecycleRow[];
    return rows.map(rowToExternalLifecycle);
  }

  upsertExternalLifecycle(
    input: UpsertProjectExternalSourceInput,
  ): ProjectExternalSourceLifecycle {
    this.db.raw
      .prepare(
        `INSERT INTO project_external_source_lifecycle
         (project_id,workspace_id,source_type,source_key,role,latest_artifact_id,
          latest_context_episode_id,state,last_refreshed_at,last_indexed_at,updated_at)
         VALUES (?,?,?,?,?,?,NULL,'SNAPSHOT_READY',?,NULL,?)
         ON CONFLICT(project_id,source_type,source_key,role) DO UPDATE SET
           workspace_id=excluded.workspace_id,
           latest_context_episode_id=
             CASE
               WHEN latest_artifact_id=excluded.latest_artifact_id AND state='INDEXED'
                 THEN latest_context_episode_id
               ELSE NULL
             END,
           state=
             CASE
               WHEN latest_artifact_id=excluded.latest_artifact_id AND state='INDEXED'
                 THEN 'INDEXED'
               ELSE 'SNAPSHOT_READY'
             END,
           last_refreshed_at=excluded.last_refreshed_at,
           last_indexed_at=
             CASE
               WHEN latest_artifact_id=excluded.latest_artifact_id AND state='INDEXED'
                 THEN last_indexed_at
               ELSE NULL
             END,
           latest_artifact_id=excluded.latest_artifact_id,
           updated_at=excluded.updated_at`,
      )
      .run(
        input.projectId,
        input.workspaceId,
        input.sourceType,
        input.sourceKey,
        input.role,
        input.latestArtifactId,
        input.refreshedAt,
        input.refreshedAt,
      );
    const row = this.db.raw
      .prepare(
        `SELECT * FROM project_external_source_lifecycle
         WHERE project_id=? AND workspace_id=? AND source_type=? AND source_key=? AND role=?`,
      )
      .get(
        input.projectId,
        input.workspaceId,
        input.sourceType,
        input.sourceKey,
        input.role,
      ) as ExternalLifecycleRow;
    return rowToExternalLifecycle(row);
  }

  markExternalIndexed(
    projectId: ProjectId,
    workspaceId: WorkspaceId,
    artifactId: ArtifactId,
    episodeId: EpisodeId,
    indexedAt: Timestamp,
  ): ProjectExternalSourceLifecycle[] {
    this.db.raw
      .prepare(
        `UPDATE project_external_source_lifecycle
         SET latest_context_episode_id=?, state='INDEXED', last_indexed_at=?, updated_at=?
         WHERE project_id=? AND workspace_id=? AND latest_artifact_id=?`,
      )
      .run(episodeId, indexedAt, indexedAt, projectId, workspaceId, artifactId);
    const rows = this.db.raw
      .prepare(
        `SELECT * FROM project_external_source_lifecycle
         WHERE project_id=? AND workspace_id=? AND latest_artifact_id=?
         ORDER BY source_type ASC, source_key ASC, role ASC`,
      )
      .all(projectId, workspaceId, artifactId) as ExternalLifecycleRow[];
    return rows.map(rowToExternalLifecycle);
  }

  markExternalDetachedByArtifact(
    projectId: ProjectId,
    workspaceId: WorkspaceId,
    artifactId: ArtifactId,
    detachedAt: Timestamp,
  ): void {
    this.db.raw
      .prepare(
        `UPDATE project_external_source_lifecycle
         SET state='DETACHED', updated_at=?
         WHERE project_id=? AND workspace_id=? AND latest_artifact_id=?`,
      )
      .run(detachedAt, projectId, workspaceId, artifactId);
  }

  markExternalDetachedByOrigin(
    projectId: ProjectId,
    workspaceId: WorkspaceId,
    sourceType: ProjectExternalSourceType,
    sourceKey: string,
    role: ProjectSourceRole,
    detachedAt: Timestamp,
  ): void {
    this.db.raw
      .prepare(
        `UPDATE project_external_source_lifecycle
         SET state='DETACHED', updated_at=?
         WHERE project_id=? AND workspace_id=? AND source_type=? AND source_key=? AND role=?`,
      )
      .run(detachedAt, projectId, workspaceId, sourceType, sourceKey, role);
  }

  countForResource(
    workspaceId: WorkspaceId,
    resourceType: ProjectSourceResourceType,
    resourceId: string,
  ): number {
    const row = this.db.raw
      .prepare(
        `SELECT COUNT(*) AS count FROM project_source_bindings
         WHERE workspace_id=? AND resource_type=? AND resource_id=?`,
      )
      .get(workspaceId, resourceType, resourceId) as { count: number };
    return row.count;
  }
}
