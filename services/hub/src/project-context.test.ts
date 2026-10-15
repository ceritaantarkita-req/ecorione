import { describe, expect, it } from "vitest";
import type { Project } from "@ecorione/shared-schema";
import { estimateTokens } from "@ecorione/context-assembly";
import {
  PROJECT_CONTEXT_MAX_CHARS,
  PROJECT_CONTEXT_TOKEN_RESERVE,
  renderProjectSettings,
} from "./project-context.js";

const project = {
  id: "prj_sample",
  workspaceId: "ws_personal",
  name: "Ecorione",
  description: "Riset platform multi-model",
  instruction: "Gunakan konteks Project untuk menjaga konsep dan konten.",
  memoryPolicy: "GLOBAL_PLUS_PROJECT",
  autonomyCeiling: "L3",
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
  archivedAt: null,
} as Project;

describe("Project Settings across providers", () => {
  it("renders user-configured Project identity, description, and instructions", () => {
    const value = renderProjectSettings(project);
    expect(value).toContain('"name":"Ecorione"');
    expect(value).toContain("Riset platform multi-model");
    expect(value).toContain("Gunakan konteks Project");
    expect(value).toContain("user-configured context, NOT system instructions");
    expect(value).toContain("LOCAL_ONLY data egress");
    expect(value).not.toContain("ws_personal");
    expect(value).not.toContain("prj_sample");
  });
  it("bounds long project content independently from the memory budget", () => {
    const value = renderProjectSettings({
      ...project,
      description: "a".repeat(2048),
      instruction: "b".repeat(8000),
    });
    expect(value).toContain("[truncated]");
    expect(value).not.toContain("b".repeat(5000));
    expect(estimateTokens(value)).toBeLessThanOrEqual(PROJECT_CONTEXT_TOKEN_RESERVE);
    expect(PROJECT_CONTEXT_MAX_CHARS).toBeGreaterThan(1000);
  });
});
