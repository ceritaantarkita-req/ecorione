import { describe, expect, it } from "vitest";
import type { Project } from "@ecorione/shared-schema";
import {
  PERSONAL_PROJECT_ID,
  activeProjects,
  isProjectIdCandidate,
  resolveActiveProjectId,
} from "./project-selection";

const base = {
  workspaceId: "ws_personal",
  description: "",
  instruction: "",
  memoryPolicy: "GLOBAL_PLUS_PROJECT" as const,
  autonomyCeiling: "L3" as const,
  createdAt: "2026-09-25T00:00:00.000Z",
  updatedAt: "2026-09-25T00:00:00.000Z",
};

function project(id: string, archivedAt: string | null = null): Project {
  return {
    ...base,
    id,
    name: id === PERSONAL_PROJECT_ID ? "Personal" : id,
    archivedAt,
  };
}

describe("Project selection reconciliation", () => {
  it("keeps an active stored Project", () => {
    const projects = [project(PERSONAL_PROJECT_ID), project("prj_finance")];
    expect(resolveActiveProjectId("prj_finance", projects)).toBe("prj_finance");
  });

  it("falls back to Personal when the stored Project is archived", () => {
    const projects = [
      project(PERSONAL_PROJECT_ID),
      project("prj_finance", "2026-09-25T01:00:00.000Z"),
    ];
    expect(resolveActiveProjectId("prj_finance", projects)).toBe(PERSONAL_PROJECT_ID);
  });

  it("falls back to the first active Project when Personal is unavailable", () => {
    const projects = [
      project(PERSONAL_PROJECT_ID, "2026-09-25T01:00:00.000Z"),
      project("prj_work"),
    ];
    expect(resolveActiveProjectId("prj_missing", projects)).toBe("prj_work");
  });

  it("returns null when there is no active Project", () => {
    expect(
      resolveActiveProjectId("prj_missing", [
        project(PERSONAL_PROJECT_ID, "2026-09-25T01:00:00.000Z"),
      ]),
    ).toBeNull();
  });

  it("filters archived Projects and rejects malformed candidates", () => {
    const projects = [
      project(PERSONAL_PROJECT_ID),
      project("prj_archived", "2026-09-25T01:00:00.000Z"),
    ];
    expect(activeProjects(projects).map((item) => item.id)).toEqual([PERSONAL_PROJECT_ID]);
    expect(isProjectIdCandidate("prj_ok")).toBe(true);
    expect(isProjectIdCandidate("not-a-project")).toBe(false);
  });
});
