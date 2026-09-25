import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-05a Source Picker source contract", () => {
  const picker = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");
  const catalog = readFileSync("apps/ai/app/api/projects/source-catalog/route.ts", "utf8");
  const attach = readFileSync("apps/ai/app/api/projects/[id]/sources/route.ts", "utf8");

  it("discovers existing owner resources without creating a new source store", () => {
    expect(catalog).toContain("/v1/artifacts?");
    expect(catalog).toContain("/v1/pages?");
    expect(catalog).toContain("/v1/graphs?");
    expect(catalog).toContain("/v1/mcp-outbound/servers?");
    expect(catalog).not.toContain('method: "POST"');
  });

  it("uses picker candidates for owned resources and keeps URL manual", () => {
    expect(picker).toContain("/api/projects/source-catalog");
    expect(picker).toContain('resourceType === "url"');
    expect(picker).toContain("sourceCatalog");
    expect(picker).toContain("Pilih resource");
  });

  it("keeps authoritative attach verification on the existing Hub route", () => {
    expect(attach).toContain("ProjectSourceAttachRequestSchema.safeParse");
    expect(attach).toContain('method: "POST"');
    expect(picker).toContain("fetch(endpoint");
  });
});
