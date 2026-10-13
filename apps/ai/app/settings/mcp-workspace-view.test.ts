import { describe, expect, it } from "vitest";
import { resetMcpWorkspaceView } from "./mcp-workspace-view.js";

describe("Settings MCP Workspace view isolation", () => {
  it("preserves in-progress editor content when the Workspace has not changed", () => {
    expect(resetMcpWorkspaceView("ws_personal", "ws_personal", 4)).toBeNull();
  });

  it("clears previously loaded servers and JSON when switching Workspace", () => {
    expect(resetMcpWorkspaceView("ws_personal", "ws_project", 4)).toEqual({
      workspaceId: "ws_project",
      requestId: 5,
      servers: [],
      json: "",
      loading: false,
    });
  });

  it("invalidates in-flight responses on every Workspace change", () => {
    const first = resetMcpWorkspaceView("ws_personal", "ws_team", 8);
    expect(first?.requestId).toBe(9);
    const second = resetMcpWorkspaceView("ws_team", "ws_project", first!.requestId);
    expect(second?.requestId).toBe(10);
  });
});
