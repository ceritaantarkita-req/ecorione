import {
  DEFAULT_WORKSPACE_ID,
  WorkspaceIdSchema,
  type WorkspaceId,
} from "@ecorione/shared-schema";

export const WORKSPACE_STORAGE_KEY = "ecorione.workspaceId";
export const WORKSPACE_QUERY_KEY = "workspace";

export function isWorkspaceIdCandidate(
  value: string | null | undefined,
): value is WorkspaceId {
  return value !== null && value !== undefined && WorkspaceIdSchema.safeParse(value).success;
}

export function resolveWorkspaceId(
  queryCandidate: string | null | undefined,
  storedCandidate: string | null | undefined,
): WorkspaceId {
  if (isWorkspaceIdCandidate(queryCandidate)) return queryCandidate;
  if (isWorkspaceIdCandidate(storedCandidate)) return storedCandidate;
  return DEFAULT_WORKSPACE_ID;
}
