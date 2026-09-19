import { describe, expect, it } from "vitest";
import {
  BrainQuerySchema,
  type FlowGraphSummary,
  type Project,
  type ProjectSourceView,
} from "@ecorione/shared-schema";
import { buildBrainGraph } from "./brain-projection";

const NOW = "2026-09-19T12:00:00.000Z";
const PROJECT_ID = "prj_finance";
const WORKSPACE_ID = "ws_personal";

const project: Project = {
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: "Finance",
  description: "",
  instruction: "",
  memoryPolicy: "GLOBAL_PLUS_PROJECT",
  autonomyCeiling: "L3",
  createdAt: NOW,
  updatedAt: NOW,
  archivedAt: null,
};

function source(index: number): ProjectSourceView {
  const resourceId = `https://example.com/source-${String(index).padStart(2, "0")}`;
  return {
    binding: {
      projectId: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      resourceType: "url",
      resourceId,
      owner: "Connect",
      role: "source",
      createdAt: NOW,
    },
    availability: "AVAILABLE",
    metadata: { url: resourceId },
    unavailableReason: null,
  };
}

function graph(index: number): FlowGraphSummary {
  return {
    graphId: `fg_finance${String(index).padStart(2, "0")}`,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    name: `Finance Flow ${String(index)}`,
    scope: "personal",
    sensitivity: "INTERNAL",
    currentVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function query(limit = 120) {
  return BrainQuerySchema.parse({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    limit,
    runLimit: 50,
  });
}

describe("PE-06 Brain deterministic projection", () => {
  it("produces byte-equivalent graph ordering when owner arrays arrive in different order", () => {
    const sources = [source(3), source(1), source(2)];
    const graphs = [graph(2), graph(1)];

    const first = buildBrainGraph(query(), {
      project,
      sources,
      graphs,
      triggers: [],
      runs: [],
    });
    const rebuilt = buildBrainGraph(query(), {
      project,
      sources: [...sources].reverse(),
      graphs: [...graphs].reverse(),
      triggers: [],
      runs: [],
    });

    expect(rebuilt).toEqual(first);
    expect(first.nodes.map((node) => node.type)).toEqual([
      "Project",
      "Source",
      "Source",
      "Source",
      "Flow",
      "Flow",
    ]);
    for (const type of ["Source", "Flow"] as const) {
      const ids = first.nodes.filter((node) => node.type === type).map((node) => node.id);
      expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)));
    }
    expect(first.edges.map((edge) => edge.id)).toEqual(
      [...first.edges.map((edge) => edge.id)].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  });

  it("applies the bounded node limit and never returns an edge to a hidden node", () => {
    const result = buildBrainGraph(query(10), {
      project,
      sources: Array.from({ length: 12 }, (_, index) => source(index + 1)),
      graphs: [],
      triggers: [],
      runs: [],
    });

    expect(result.totalNodes).toBe(13);
    expect(result.nodes).toHaveLength(10);
    expect(result.truncated).toBe(true);
    const visible = new Set(result.nodes.map((node) => node.id));
    expect(
      result.edges.every(
        (edge) => visible.has(edge.sourceNodeId) && visible.has(edge.targetNodeId),
      ),
    ).toBe(true);
  });
});
