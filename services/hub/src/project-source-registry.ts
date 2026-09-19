import {
  ProjectSourceBindingSchema,
  projectSourceOwner,
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
