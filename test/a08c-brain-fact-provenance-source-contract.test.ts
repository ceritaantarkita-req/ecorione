import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-08c Brain Fact provenance source contract", () => {
  const schema = readFileSync("packages/shared-schema/src/brain.ts", "utf8");
  const projection = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");
  const browser = readFileSync("scripts/pcs06-browser-acceptance.mjs", "utf8");

  it("uses the roadmap provenance edge instead of inventing a new relationship vocabulary", () => {
    expect(schema).toContain('"GENERATED_FROM"');
    expect(projection).toContain('addEdge(edges, "GENERATED_FROM", id, artifactNodeId)');
  });

  it("accepts only schema-valid artifact provenance and only when the authorized Artifact node exists", () => {
    expect(projection).toContain('sourceUri.startsWith("artifact:")');
    expect(projection).toContain("ArtifactIdSchema.safeParse");
    expect(projection).toContain('nodeId("Artifact", artifactId)');
    expect(projection).toContain("nodes.has(artifactNodeId)");
  });

  it("keeps provenance deterministic, owner-backed, and model-free", () => {
    expect(projection).not.toContain("chat/completions");
    expect(projection).not.toContain("embedding");
    expect(projection).not.toContain("semantic similarity");
    expect(projection).not.toContain("neo4j");
    expect(projection).not.toContain("falkor");
  });

  it("renders the exact provenance relationship in integrated browser acceptance", () => {
    expect(browser).toContain('"GENERATED_FROM"');
    expect(browser).toContain("PCS-06 canonical fact · GENERATED_FROM · PCS-06 Artifact");
  });
});
