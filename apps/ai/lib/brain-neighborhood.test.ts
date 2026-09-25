import { describe, expect, it } from "vitest";
import {
  BrainGraphResponseSchema,
  BrainNeighborhoodQuerySchema,
} from "@ecorione/shared-schema";
import { BrainNeighborhoodSeedError, selectBrainNeighborhood } from "./brain-projection";

const graph = BrainGraphResponseSchema.parse({
  workspaceId: "ws_personal",
  projectId: "prj_alpha",
  totalNodes: 5,
  totalEdges: 4,
  truncated: false,
  nodes: [
    {
      id: "project:alpha",
      type: "Project",
      canonicalId: "prj_alpha",
      owner: "Hub",
      label: "Alpha",
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      availability: "AVAILABLE",
      href: "/projects",
      metadata: {},
    },
    {
      id: "source:a",
      type: "Source",
      canonicalId: "url:https://a.example/source",
      owner: "Connect",
      label: "url · a",
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      availability: "AVAILABLE",
      href: "/projects",
      metadata: {
        resourceType: "url",
        resourceId: "https://a.example/source",
        role: "source",
      },
    },
    {
      id: "source:b",
      type: "Source",
      canonicalId: "url:https://b.example/source",
      owner: "Connect",
      label: "url · b",
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      availability: "AVAILABLE",
      href: "/projects",
      metadata: {
        resourceType: "url",
        resourceId: "https://b.example/source",
        role: "reference",
      },
    },
    {
      id: "flow:alpha",
      type: "Flow",
      canonicalId: "flow_alpha",
      owner: "Flow",
      label: "Alpha flow",
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      availability: "AVAILABLE",
      href: "/flow",
      metadata: {},
    },
    {
      id: "fact:alpha",
      type: "Fact",
      canonicalId: "mem_alpha_fact01",
      owner: "Context",
      label: "Alpha fact",
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      availability: "AVAILABLE",
      href: null,
      metadata: { sensitivity: "INTERNAL" },
    },
  ],
  edges: [
    {
      id: "BELONGS_TO:source:a->project:alpha",
      type: "BELONGS_TO",
      sourceNodeId: "source:a",
      targetNodeId: "project:alpha",
    },
    {
      id: "BELONGS_TO:source:b->project:alpha",
      type: "BELONGS_TO",
      sourceNodeId: "source:b",
      targetNodeId: "project:alpha",
    },
    {
      id: "BELONGS_TO:flow:alpha->project:alpha",
      type: "BELONGS_TO",
      sourceNodeId: "flow:alpha",
      targetNodeId: "project:alpha",
    },
    {
      id: "BELONGS_TO:fact:alpha->project:alpha",
      type: "BELONGS_TO",
      sourceNodeId: "fact:alpha",
      targetNodeId: "project:alpha",
    },
  ],
});

describe("PE-07 Brain neighborhood", () => {
  it("returns deterministic bounded adjacency and source URI constraints", () => {
    const query = BrainNeighborhoodQuerySchema.parse({
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      seedNodeIds: ["project:alpha"],
      maxHops: 1,
      maxNodes: 3,
      nodeTypes: ["Source"],
      edgeTypes: ["BELONGS_TO"],
    });

    const first = selectBrainNeighborhood(graph, query);
    const second = selectBrainNeighborhood(graph, query);

    expect(first).toEqual(second);
    expect(first.nodes.map((node) => node.id)).toEqual([
      "project:alpha",
      "source:a",
      "source:b",
    ]);
    expect(first.contextConstraint.sourceUris).toEqual([
      "https://a.example/source",
      "https://b.example/source",
    ]);
    expect(first.contextConstraint.factIds).toEqual([]);
    expect(first.edges).toHaveLength(2);
    expect(first.truncated).toBe(false);
  });

  it("emits exact Fact IDs for a Fact-grounded neighborhood", () => {
    const query = BrainNeighborhoodQuerySchema.parse({
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      seedNodeIds: ["fact:alpha"],
      maxHops: 0,
      maxNodes: 1,
    });

    const result = selectBrainNeighborhood(graph, query);

    expect(result.nodes.map((node) => node.id)).toEqual(["fact:alpha"]);
    expect(result.contextConstraint).toEqual({
      sourceUris: [],
      factIds: ["mem_alpha_fact01"],
    });
  });

  it("fails closed when the requested seed is not in the authorized Project graph", () => {
    const query = BrainNeighborhoodQuerySchema.parse({
      workspaceId: "ws_personal",
      projectId: "prj_alpha",
      seedNodeIds: ["source:sibling"],
    });

    expect(() => selectBrainNeighborhood(graph, query)).toThrow(BrainNeighborhoodSeedError);
  });

  it("does not accept a graph from another Workspace/Project", () => {
    const query = BrainNeighborhoodQuerySchema.parse({
      workspaceId: "ws_other",
      projectId: "prj_alpha",
      seedNodeIds: ["project:alpha"],
    });

    expect(() => selectBrainNeighborhood(graph, query)).toThrow("Project tidak tersedia");
  });
});
