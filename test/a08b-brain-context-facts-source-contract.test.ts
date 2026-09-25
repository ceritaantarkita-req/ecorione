import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-08b Brain Context Fact projection source contract", () => {
  const schema = readFileSync("packages/shared-schema/src/brain.ts", "utf8");
  const projection = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");
  const runtime = readFileSync("test/pe06-brain-owner-runtime.test.ts", "utf8");
  const css = readFileSync("apps/ai/app/brain/Brain.module.css", "utf8");
  const browser = readFileSync("scripts/pcs06-browser-acceptance.mjs", "utf8");

  it("adds stable Context-owned Fact nodes without a graph store", () => {
    expect(schema).toContain('"Fact"');
    expect(schema).toContain('"Context"');
    expect(projection).toContain('type: "Fact"');
    expect(projection).toContain('owner: "Context"');
    expect(projection).toContain("canonicalId: fact.id");
    expect(projection).not.toContain("neo4j");
    expect(projection).not.toContain("falkor");
  });

  it("reads bounded Project facts from the Context owner only after Hub Project authorization", () => {
    const auth = projection.indexOf("const project = await authorizeBrainProject(query)");
    const facts = projection.indexOf('ownerJson("Context"');
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(facts).toBeGreaterThan(auth);
    expect(projection).toContain('"ECORIONE_CONTEXT_URL"');
    expect(projection).toContain('maxSensitivity: "RESTRICTED"');
    expect(projection).toContain("BRAIN_FACT_LIMIT = 40");
    expect(projection).toContain("fact.projectId !== query.projectId");
    expect(projection).not.toContain("services/context/src/db");
    expect(projection).not.toContain("openContextDatabase");
  });

  it("keeps Fact relationships deterministic and mutation-free", () => {
    expect(projection).toContain('addEdge(edges, "BELONGS_TO", id, projectNodeId)');
    expect(projection).not.toContain("/v1/facts/propose");
    expect(projection).not.toContain("/promote");
    expect(projection).not.toContain("/forget");
    expect(projection).not.toContain("chat/completions");
  });

  it("proves Project isolation, an explicit sensitivity bound, and rendered Fact UI", () => {
    expect(runtime).toContain('"Fact:mem_pe06personal"');
    expect(runtime).toContain('"Fact:mem_pe06sibling"');
    expect(projection).toContain('maxSensitivity: "RESTRICTED"');
    expect(css).toContain("repeat(8, minmax(86px, 1fr))");
    expect(browser).toContain('name: "Fact", exact: true');
    expect(browser).toContain("Fact: PCS-06 canonical fact");
  });
});
