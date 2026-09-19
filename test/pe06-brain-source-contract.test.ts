import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectionPath = resolve("apps/ai/lib/brain-projection.ts");
const pagePath = resolve("apps/ai/app/brain/page.tsx");
const cssPath = resolve("apps/ai/app/brain/Brain.module.css");
const navPath = resolve("apps/ai/app/ProductNav.tsx");
const schemaPath = resolve("packages/shared-schema/src/brain.ts");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("PE-06 Brain source contract", () => {
  it("exposes Brain as a first-class Project-scoped navigation surface", async () => {
    const [page, nav] = await Promise.all([source(pagePath), source(navPath)]);
    expect(nav).toContain('["Brain", "/brain", "brain"]');
    expect(page).toContain('const WORKSPACE_ID = "ws_personal"');
    expect(page).toContain('const PROJECT_STORAGE_KEY = "ecorione.projectId"');
    expect(page).toContain("/api/brain?");
    expect(page).toContain("BRAIN_NODE_TYPES");
    expect(page).toContain("BRAIN_EDGE_TYPES");
  });

  it("authorizes Project before fan-out and reads only owner HTTP contracts", async () => {
    const projection = await source(projectionPath);
    const authorization = projection.indexOf('ownerJson(\n      "HubProject"');
    const fanout = projection.indexOf("await Promise.all([");
    expect(authorization).toBeGreaterThan(-1);
    expect(fanout).toBeGreaterThan(authorization);
    expect(projection).toContain("/v1/projects/");
    expect(projection).toContain("/v1/graphs?");
    expect(projection).toContain("/v1/triggers?");
    expect(projection).toContain("/v1/runs?");
    expect(projection).not.toMatch(/better-sqlite3|sqlite3|neo4j|falkordb/i);
    expect(projection).not.toContain("setInterval(");
    expect(projection).not.toContain("setTimeout(");
  });

  it("keeps PE-07 Context and ECX behavior out of Brain V1", async () => {
    const projection = await source(projectionPath);
    expect(projection).not.toContain("/v1/context");
    expect(projection).not.toContain("ECX");
    expect(projection).not.toContain("ecx");
    expect(projection).not.toContain("completion");
    expect(projection).not.toContain("embedding");
  });

  it("uses deterministic bounded graph contracts rather than a persistent graph store", async () => {
    const schema = await source(schemaPath);
    expect(schema).toContain('z.coerce.number().int().min(10).max(200).default(120)');
    expect(schema).toContain('z.coerce.number().int().min(1).max(100).default(50)');
    expect(schema).toContain('"Project", "Source", "Flow", "Trigger", "Run"');
    expect(schema).toContain('"BELONGS_TO"');
    expect(schema).toContain('"TRIGGERED"');
    expect(schema).toContain('"EXECUTED"');
  });

  it("keeps the connected graph responsive without page-level horizontal overflow", async () => {
    const css = await source(cssPath);
    expect(css).toMatch(/\.shell\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.shell\s*\{[\s\S]*?overflow-x:\s*clip;/);
    expect(css).toMatch(/\.graphScroll\s*\{[\s\S]*?overflow-x:\s*auto;/);
    expect(css).toContain("@media (max-width: 780px)");
    expect(css).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
  });
});
