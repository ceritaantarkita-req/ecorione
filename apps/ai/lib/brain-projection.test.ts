import { describe, expect, it } from "vitest";
import {
  BrainQuerySchema,
  MemoryFactSchema,
  ProjectIdSchema,
  WorkspaceIdSchema,
  type FlowGraphSummary,
  type Project,
  type ProjectSourceView,
} from "@ecorione/shared-schema";
import { buildBrainGraph } from "./brain-projection";

const NOW = "2026-09-19T12:00:00.000Z";
const PROJECT_ID = ProjectIdSchema.parse("prj_finance");
const WORKSPACE_ID = WorkspaceIdSchema.parse("ws_personal");

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

function artifactSource(
  role: ProjectSourceView["binding"]["role"] = "source",
): ProjectSourceView {
  return {
    binding: {
      projectId: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      resourceType: "artifact",
      resourceId: "art_report",
      owner: "Artifact",
      role,
      createdAt: NOW,
    },
    availability: "AVAILABLE",
    metadata: {
      id: "art_report",
      path: "sha256/aa/report.pdf",
      description: "Q3 report",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    },
    unavailableReason: null,
  };
}

function pageSource(): ProjectSourceView {
  return {
    binding: {
      projectId: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      resourceType: "space-page",
      resourceId: "page_notes",
      owner: "Space",
      role: "reference",
      createdAt: NOW,
    },
    availability: "AVAILABLE",
    metadata: {
      id: "page_notes",
      workspaceId: WORKSPACE_ID,
      title: "Finance notes",
      scope: "personal",
      version: 3,
      createdAt: NOW,
      updatedAt: NOW,
    },
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
      [...first.edges.map((edge) => edge.id)].sort((left, right) => left.localeCompare(right)),
    );
  });

  it("projects bound Artifact and Space Page resources as first-class canonical owner nodes", () => {
    const result = buildBrainGraph(query(), {
      project,
      sources: [pageSource(), artifactSource("reference"), artifactSource("source")],
      graphs: [],
      triggers: [],
      runs: [],
    });

    const artifact = result.nodes.find(
      (node) => node.type === "Artifact" && node.canonicalId === "art_report",
    );
    const page = result.nodes.find(
      (node) => node.type === "Page" && node.canonicalId === "page_notes",
    );
    const artifactBindings = result.nodes.filter(
      (node) =>
        node.type === "Source" &&
        node.metadata.resourceType === "artifact" &&
        node.metadata.resourceId === "art_report",
    );
    const pageBinding = result.nodes.find(
      (node) =>
        node.type === "Source" &&
        node.metadata.resourceType === "space-page" &&
        node.metadata.resourceId === "page_notes",
    );
    const projectNode = result.nodes.find((node) => node.type === "Project");

    expect(artifact).toMatchObject({
      owner: "Artifact",
      label: "Q3 report",
      availability: "AVAILABLE",
      href: "/projects",
      metadata: {
        mimeType: "application/pdf",
        sizeBytes: 4096,
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
    });
    expect(page).toMatchObject({
      owner: "Space",
      label: "Finance notes",
      availability: "AVAILABLE",
      href: "/space",
      metadata: {
        scope: "personal",
        version: 3,
      },
    });
    expect(artifactBindings).toHaveLength(2);
    expect(pageBinding).toBeDefined();
    expect(projectNode).toBeDefined();

    for (const binding of artifactBindings) {
      expect(
        result.edges.some(
          (edge) =>
            edge.type === "REFERENCES" &&
            edge.sourceNodeId === binding.id &&
            edge.targetNodeId === artifact?.id,
        ),
      ).toBe(true);
    }
    expect(
      result.edges.some(
        (edge) =>
          edge.type === "REFERENCES" &&
          edge.sourceNodeId === pageBinding?.id &&
          edge.targetNodeId === page?.id,
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) =>
          edge.type === "BELONGS_TO" &&
          edge.sourceNodeId === artifact?.id &&
          edge.targetNodeId === projectNode?.id,
      ),
    ).toBe(true);
    expect(
      result.edges.some(
        (edge) =>
          edge.type === "BELONGS_TO" &&
          edge.sourceNodeId === page?.id &&
          edge.targetNodeId === projectNode?.id,
      ),
    ).toBe(true);
  });

  it("projects canonical Context facts after existing owner node classes", () => {
    const fact = MemoryFactSchema.parse({
      id: "mem_financefact01",
      subject: "Revenue",
      predicate: "status",
      object: "reviewed",
      text: "Q3 revenue has been reviewed",
      confidence: 0.96,
      salience: 0.8,
      sourceEpisodeIds: ["epi_financefact01"],
      tValid: NOW,
      tInvalid: null,
      supersededBy: null,
      createdAt: NOW,
      projectId: PROJECT_ID,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "USER",
      provenance: {
        sourceApp: "projection-test",
        sourceUri: "artifact:art_report",
      },
    });

    const result = buildBrainGraph(query(), {
      project,
      sources: [],
      graphs: [graph(1)],
      triggers: [],
      runs: [],
      facts: [fact],
    });

    expect(result.nodes.map((node) => node.type)).toEqual(["Project", "Flow", "Fact"]);
    const factNode = result.nodes.find((node) => node.type === "Fact");
    const projectNode = result.nodes.find((node) => node.type === "Project");
    expect(factNode).toMatchObject({
      canonicalId: "mem_financefact01",
      owner: "Context",
      label: "Q3 revenue has been reviewed",
      availability: "AVAILABLE",
      href: null,
      metadata: {
        subject: "Revenue",
        predicate: "status",
        object: "reviewed",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
        sourceUri: "artifact:art_report",
      },
    });
    expect(
      result.edges.some(
        (edge) =>
          edge.type === "BELONGS_TO" &&
          edge.sourceNodeId === factNode?.id &&
          edge.targetNodeId === projectNode?.id,
      ),
    ).toBe(true);
    expect(result.edges.some((edge) => edge.type === "GENERATED_FROM")).toBe(false);
  });

  it("links Fact provenance only to an authorized bound Artifact node", () => {
    const fact = MemoryFactSchema.parse({
      id: "mem_financefact02",
      subject: "Revenue",
      predicate: "source",
      object: "Q3 report",
      text: "Q3 revenue came from the bound report",
      confidence: 0.94,
      salience: 0.7,
      sourceEpisodeIds: ["epi_financefact02"],
      tValid: NOW,
      tInvalid: null,
      supersededBy: null,
      createdAt: NOW,
      projectId: PROJECT_ID,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
      trust: "USER",
      provenance: {
        sourceApp: "hub:project-source",
        sourceUri: "artifact:art_report",
      },
    });

    const result = buildBrainGraph(query(), {
      project,
      sources: [artifactSource()],
      graphs: [],
      triggers: [],
      runs: [],
      facts: [fact],
    });

    const factNode = result.nodes.find(
      (node) => node.type === "Fact" && node.canonicalId === fact.id,
    );
    const artifactNode = result.nodes.find(
      (node) => node.type === "Artifact" && node.canonicalId === "art_report",
    );
    expect(factNode).toBeDefined();
    expect(artifactNode).toBeDefined();
    expect(
      result.edges.filter((edge) => edge.type === "GENERATED_FROM"),
    ).toEqual([
      expect.objectContaining({
        sourceNodeId: factNode?.id,
        targetNodeId: artifactNode?.id,
      }),
    ]);
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
