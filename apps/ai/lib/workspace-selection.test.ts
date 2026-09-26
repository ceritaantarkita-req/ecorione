import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@ecorione/shared-schema";
import { isWorkspaceIdCandidate, resolveWorkspaceId } from "./workspace-selection";

describe("browser Workspace selection", () => {
  it("prefers an explicit valid query Workspace", () => {
    expect(resolveWorkspaceId("ws_research", "ws_saved")).toBe("ws_research");
  });

  it("falls back to a valid persisted Workspace", () => {
    expect(resolveWorkspaceId(null, "ws_saved")).toBe("ws_saved");
  });

  it("falls back to the canonical Personal Workspace when candidates are absent or invalid", () => {
    expect(resolveWorkspaceId(null, null)).toBe(DEFAULT_WORKSPACE_ID);
    expect(resolveWorkspaceId("bad", "also-bad")).toBe(DEFAULT_WORKSPACE_ID);
  });

  it("accepts only canonical Workspace ids", () => {
    expect(isWorkspaceIdCandidate("ws_team-a")).toBe(true);
    expect(isWorkspaceIdCandidate("prj_team-a")).toBe(false);
    expect(isWorkspaceIdCandidate("WS_TEAM")).toBe(false);
  });
});
