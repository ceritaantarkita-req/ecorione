import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectionPath = resolve("apps/ai/lib/brain-projection.ts");
const integrationPath = resolve("apps/ai/lib/brain-context-ecx.ts");
const retrievalPath = resolve("services/context/src/retrieval.ts");
const contextHttpPath = resolve("services/context/src/http.ts");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("PE-07 Brain Context ECX source contract", () => {
  it("keeps Brain neighborhood bounded and derived from the PE-06 owner graph", async () => {
    const projection = await source(projectionPath);
    expect(projection).toContain("selectBrainNeighborhood");
    expect(projection).toContain("maxHops");
    expect(projection).toContain("maxNodes");
    expect(projection).toContain("contextConstraint");
    expect(projection).not.toMatch(/better-sqlite3|sqlite3|neo4j|falkordb/i);
  });

  it("uses Brain only to constrain Context and sends only Context hits to ECX", async () => {
    const integration = await source(integrationPath);
    const contextCall = integration.indexOf("/v1/retrieve");
    const memoryRefs = integration.indexOf("memoryRefs(retrieval.hits)");
    const ecxPlan = integration.indexOf("/v1/exchange/plan");
    const semantic = integration.indexOf('mode: "semantic-v1"');

    expect(contextCall).toBeGreaterThan(-1);
    expect(ecxPlan).toBeGreaterThan(contextCall);
    expect(memoryRefs).toBeGreaterThan(ecxPlan);
    expect(semantic).toBeGreaterThan(ecxPlan);
    expect(integration).toContain("candidateSourceUris");
    expect(integration).toContain("candidateFactIds");
    expect(integration).not.toContain("/v1/complete");
    expect(integration).not.toContain("embedding");
  });

  it("keeps Context authorization filters before the optional Brain intersection", async () => {
    const retrieval = await source(retrievalPath);
    const authorized = retrieval.indexOf("const authorizedFacts = this.allowedFacts");
    const sourceConstraint = retrieval.indexOf("const sourceConstraint");
    const factConstraint = retrieval.indexOf("const factConstraint");
    const lexical = retrieval.indexOf("const lexical = this.lexicalSearch");

    expect(authorized).toBeGreaterThan(-1);
    expect(sourceConstraint).toBeGreaterThan(authorized);
    expect(factConstraint).toBeGreaterThan(authorized);
    expect(lexical).toBeGreaterThan(factConstraint);
    expect(retrieval).toContain("f.t_invalid IS NULL");
    expect(retrieval).toContain("f.sensitivity IN");
    expect(retrieval).toContain("f.sync_class IN ('CLOUD_ALLOWED','PUBLIC')");
    expect(retrieval).toContain("f.project_id=?");
    expect(retrieval).toContain("f.source_uri IN");
    expect(retrieval).toContain("f.id IN");
  });

  it("makes baseline omission different from an explicit empty fail-closed constraint", async () => {
    const [retrieval, http] = await Promise.all([
      source(retrievalPath),
      source(contextHttpPath),
    ]);
    expect(retrieval).toContain("options.candidateSourceUris === undefined");
    expect(retrieval).toContain("options.candidateFactIds === undefined");
    expect(retrieval).toContain("(candidateSourceUris?.length ?? 0) === 0");
    expect(retrieval).toContain("(candidateFactIds?.length ?? 0) === 0");
    expect(http).toContain("candidateSourceUris:");
    expect(http).toContain("candidateFactIds:");
    expect(http).toContain(".max(32).optional()");
  });
});
