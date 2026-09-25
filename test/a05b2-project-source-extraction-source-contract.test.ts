import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-05b.2 Project-scoped extraction contract", () => {
  const hub = readFileSync("services/hub/src/project-source-http.ts", "utf8");
  const schema = readFileSync("packages/shared-schema/src/multimodal.ts", "utf8");
  const context = readFileSync("services/context/src/multimodal-routes.ts", "utf8");
  const ai = readFileSync(
    "apps/ai/app/api/projects/[id]/sources/extract/route.ts",
    "utf8",
  );
  const ui = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");

  it("writes extraction into Project-scoped Context with Artifact lineage", () => {
    expect(hub).toContain('"/v1/projects/:id/sources/extract"');
    expect(hub).toContain("projectId: id");
    expect(hub).toContain('sourceApp: "hub:project-source"');
    expect(hub).toContain("sourceArtifactId: body.artifactId");
    expect(hub).toContain("sourceUri: `artifact:${body.artifactId}`");
    expect(schema).toContain("projectId: ProjectIdSchema.nullable().default(null)");
    expect(context).toContain("MultimodalDerivationWriteSchema");
  });

  it("does not fabricate a chat session or Historical Ledger event", () => {
    expect(hub).not.toContain("sessionId");
    expect(hub).not.toContain("/v1/multimodal/analyze");
    expect(hub).not.toContain("history.append");
    expect(hub).not.toContain("ensureSession");
  });

  it("keeps Project extraction local-only by default and user-triggered", () => {
    expect(hub).toContain('routes: ["local"]');
    expect(hub).toContain('preferred: "local"');
    expect(hub).toContain('"PROJECT_SOURCE_EXTRACTED"');
    expect(ai).toContain('makeId("operation")');
    expect(ui).toContain("`${endpoint}/extract`");
    expect(ui).toContain('"Extract"');
  });
});
