import {
  DEFAULT_PROJECT_ID,
  DEFAULT_WORKSPACE_ID,
  ProjectSchema,
  makeId,
  type Project,
  type ProjectAutonomyCeiling,
  type ProjectCreateRequest,
  type ProjectId,
  type ProjectUpdateRequest,
  type Timestamp,
  type WorkspaceId,
} from "@ecorione/shared-schema";
import type { HubDatabase } from "./db.js";

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  instruction: string;
  memory_policy: string;
  autonomy_ceiling: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function rowToProject(row: ProjectRow): Project {
  return ProjectSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    instruction: row.instruction,
    memoryPolicy: row.memory_policy,
    autonomyCeiling: row.autonomy_ceiling,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  });
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project tidak ditemukan: ${id}.`);
    this.name = "ProjectNotFoundError";
  }
}
export class ProjectWorkspaceConflictError extends Error {
  constructor(projectId: string, workspaceId: string) {
    super(`Project ${projectId} tidak berada di Workspace ${workspaceId}.`);
    this.name = "ProjectWorkspaceConflictError";
  }
}
export class ProjectRequiredError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace ${workspaceId} membutuhkan projectId eksplisit.`);
    this.name = "ProjectRequiredError";
  }
}
export class ProjectArchivedError extends Error {
  constructor(id: string) {
    super(`Project sudah diarsipkan: ${id}.`);
    this.name = "ProjectArchivedError";
  }
}
export class DefaultProjectArchiveError extends Error {
  constructor() {
    super("Project Personal tidak boleh diarsipkan.");
    this.name = "DefaultProjectArchiveError";
  }
}

export class ProjectRegistry {
  constructor(private readonly db: HubDatabase) {}

  list(workspaceId: WorkspaceId, includeArchived = false): Project[] {
    const rows = this.db.raw
      .prepare(
        `SELECT * FROM projects
         WHERE workspace_id=? ${includeArchived ? "" : "AND archived_at IS NULL"}
         ORDER BY CASE WHEN id='prj_personal' THEN 0 ELSE 1 END, updated_at DESC, id ASC`,
      )
      .all(workspaceId) as ProjectRow[];
    return rows.map(rowToProject);
  }

  get(id: ProjectId): Project | null {
    const row = this.db.raw.prepare("SELECT * FROM projects WHERE id=?").get(id) as
      | ProjectRow
      | undefined;
    return row === undefined ? null : rowToProject(row);
  }

  require(id: ProjectId, workspaceId: WorkspaceId, allowArchived = false): Project {
    const project = this.get(id);
    if (project === null) throw new ProjectNotFoundError(id);
    if (project.workspaceId !== workspaceId)
      throw new ProjectWorkspaceConflictError(id, workspaceId);
    if (!allowArchived && project.archivedAt !== null) throw new ProjectArchivedError(id);
    return project;
  }

  resolve(input: {
    readonly workspaceId?: WorkspaceId | undefined;
    readonly projectId?: ProjectId | undefined;
  }): { readonly workspaceId: WorkspaceId; readonly project: Project } {
    const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID;
    const projectId =
      input.projectId ??
      (workspaceId === DEFAULT_WORKSPACE_ID
        ? DEFAULT_PROJECT_ID
        : (() => {
            throw new ProjectRequiredError(workspaceId);
          })());
    return { workspaceId, project: this.require(projectId, workspaceId) };
  }

  create(input: ProjectCreateRequest, now: Timestamp): Project {
    const id = makeId("project");
    this.db.raw
      .prepare(
        `INSERT INTO projects
         (id,workspace_id,name,description,instruction,memory_policy,autonomy_ceiling,created_at,updated_at,archived_at)
         VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
      )
      .run(
        id,
        input.workspaceId,
        input.name,
        input.description,
        input.instruction,
        input.memoryPolicy,
        input.autonomyCeiling,
        now,
        now,
      );
    return this.require(id, input.workspaceId);
  }

  update(id: ProjectId, input: ProjectUpdateRequest, now: Timestamp): Project {
    const current = this.require(id, input.workspaceId);
    const next = {
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      instruction: input.instruction ?? current.instruction,
      autonomyCeiling: input.autonomyCeiling ?? current.autonomyCeiling,
    };
    this.db.raw
      .prepare(
        `UPDATE projects SET name=?,description=?,instruction=?,autonomy_ceiling=?,updated_at=?
         WHERE id=? AND workspace_id=?`,
      )
      .run(
        next.name,
        next.description,
        next.instruction,
        next.autonomyCeiling satisfies ProjectAutonomyCeiling,
        now,
        id,
        input.workspaceId,
      );
    return this.require(id, input.workspaceId);
  }

  archive(id: ProjectId, workspaceId: WorkspaceId, now: Timestamp): Project {
    if (id === DEFAULT_PROJECT_ID && workspaceId === DEFAULT_WORKSPACE_ID)
      throw new DefaultProjectArchiveError();
    this.require(id, workspaceId);
    this.db.raw
      .prepare("UPDATE projects SET archived_at=?,updated_at=? WHERE id=? AND workspace_id=?")
      .run(now, now, id, workspaceId);
    return this.require(id, workspaceId, true);
  }
}
