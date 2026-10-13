/** Clear MCP configuration owned by a previous Workspace when selecting another. */
export function resetMcpWorkspaceView(
  previousWorkspaceId: string,
  nextWorkspaceId: string,
  requestId: number,
): {
  readonly workspaceId: string;
  readonly requestId: number;
  readonly servers: [];
  readonly json: "";
  readonly loading: false;
} | null {
  if (previousWorkspaceId === nextWorkspaceId) return null;
  return {
    workspaceId: nextWorkspaceId,
    requestId: requestId + 1,
    servers: [],
    json: "",
    loading: false,
  };
}
