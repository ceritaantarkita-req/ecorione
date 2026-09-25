import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-08a Brain canonical owner-resource projection source contract", () => {
  const schema = readFileSync("packages/shared-schema/src/brain.ts", "utf8");
  const projection = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");
  const layout = readFileSync("apps/ai/lib/brain-layout.ts", "utf8");
  const css = readFileSync("apps/ai/app/brain/Brain.module.css", "utf8");
  const browser = readFileSync("scripts/pcs06-browser-acceptance.mjs", "utf8");

  it("adds first-class Artifact and Page node classes while keeping Source as the binding", () => {
    expect(schema).toContain('"Artifact"');
    expect(schema).toContain('"Page"');
    expect(projection).toContain('type: "Artifact"');
    expect(projection).toContain('owner: "Artifact"');
    expect(projection).toContain('type: "Page"');
    expect(projection).toContain('owner: "Space"');
    expect(projection).toContain('nodeId("Source", canonicalId)');
  });

  it("derives owner-resource edges only from already-authorized Project Source views", () => {
    expect(projection).toContain('view.binding.resourceType === "artifact"');
    expect(projection).toContain('view.binding.resourceType === "space-page"');
    expect(projection).toContain('addEdge(edges, "REFERENCES", id, resourceNodeId)');
    expect(projection).toContain('addEdge(edges, "BELONGS_TO", resourceNodeId, projectNodeId)');
    expect(projection).not.toContain("ECORIONE_CONTEXT_URL");
    expect(projection).not.toContain("ECORIONE_SPACE_URL");
    expect(projection).not.toContain("metadata: view.metadata");
  });

  it("keeps the richer graph rebuildable and deterministic without a graph store or model call", () => {
    expect(projection).toContain("buildBrainGraph");
    expect(projection).toContain("ProjectSourceListResponseSchema.parse");
    expect(projection).not.toContain("neo4j");
    expect(projection).not.toContain("falkor");
    expect(projection).not.toContain("embedding");
    expect(projection).not.toContain("chat/completions");
  });

  it("expands the lane canvas and proves owner resources in rendered browser acceptance", () => {
    expect(layout).toContain("BRAIN_NODE_TYPES.length - 1");
    expect(layout).toContain("BRAIN_LANE_CENTER_GAP");
    expect(css).toContain("repeat(7, minmax(86px, 1fr))");
    expect(browser).toContain('name: "Artifact", exact: true');
    expect(browser).toContain('name: "Page", exact: true');
    expect(browser).toContain('Artifact: PCS-06 Artifact');
    expect(browser).toContain('Page: PCS-06 Notes');
  });
});
