import { describe, expect, it } from "vitest";
import { ProjectIdSchema, WorkspaceIdSchema, type BrainNode } from "@ecorione/shared-schema";
import {
  BRAIN_CANVAS_MIN_HEIGHT,
  BRAIN_NODE_MIN_CENTER_GAP,
  layoutBrainNodes,
} from "./brain-layout";

const WORKSPACE_ID = WorkspaceIdSchema.parse("ws_personal");
const PROJECT_ID = ProjectIdSchema.parse("prj_personal");

function node(id: string, type: BrainNode["type"]): BrainNode {
  return {
    id,
    type,
    canonicalId: id,
    owner: type === "Project" || type === "Source" ? "Hub" : "Flow",
    label: id,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    availability: "AVAILABLE",
    href: null,
    metadata: {},
  };
}

describe("A-07 Brain scalable layout", () => {
  it("keeps the bounded 50-Run lane separated instead of compressing it into 640px", () => {
    const runs = Array.from({ length: 50 }, (_, index) => node(`run:${index}`, "Run"));
    const layout = layoutBrainNodes([node("project:personal", "Project"), ...runs]);

    expect(layout.height).toBeGreaterThan(BRAIN_CANVAS_MIN_HEIGHT);

    const runY = runs.map((run) => layout.positions.get(run.id)?.y ?? -1);
    for (let index = 1; index < runY.length; index += 1) {
      expect(runY[index]! - runY[index - 1]!).toBeGreaterThanOrEqual(BRAIN_NODE_MIN_CENTER_GAP);
    }
  });

  it("keeps sparse graphs centered at the original minimum canvas height", () => {
    const project = node("project:personal", "Project");
    const flow = node("flow:alpha", "Flow");
    const layout = layoutBrainNodes([project, flow]);

    expect(layout.height).toBe(BRAIN_CANVAS_MIN_HEIGHT);
    expect(layout.positions.get(project.id)?.y).toBe(BRAIN_CANVAS_MIN_HEIGHT / 2);
    expect(layout.positions.get(flow.id)?.y).toBe(BRAIN_CANVAS_MIN_HEIGHT / 2);
  });

  it("is deterministic for the same ordered owner projection", () => {
    const nodes = [
      node("project:personal", "Project"),
      node("run:a", "Run"),
      node("run:b", "Run"),
    ];

    expect([...layoutBrainNodes(nodes).positions]).toEqual([
      ...layoutBrainNodes(nodes).positions,
    ]);
  });
});
