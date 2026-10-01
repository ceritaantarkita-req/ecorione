import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 5 Project Source Picker contract", () => {
  const picker = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");
  const styles = readFileSync("apps/ai/app/projects/Projects.module.css", "utf8");
  const catalog = readFileSync("apps/ai/app/api/projects/source-catalog/route.ts", "utf8");
  const bindings = readFileSync("apps/ai/app/api/projects/[id]/sources/route.ts", "utf8");

  it("uses the existing owner catalogs rather than a duplicate source database", () => {
    expect(catalog).toContain("/v1/artifacts?");
    expect(catalog).toContain("/v1/pages?");
    expect(catalog).toContain("/v1/graphs?");
    expect(catalog).toContain("/v1/mcp-outbound/servers?");
    expect(catalog).not.toContain('method: "POST"');
  });

  it("provides a searchable picker while keeping URL as the explicit manual path", () => {
    expect(picker).toContain('type="search"');
    expect(picker).toContain('aria-label="Cari Project source"');
    expect(picker).toContain("filteredCandidates");
    expect(picker).toContain('resourceType === "url"');
    expect(picker).toContain('aria-label="HTTPS URL source"');
  });

  it("shows exact binding state and prevents duplicate one-click attach for the selected role", () => {
    expect(picker).toContain("attachedBindingKeys");
    expect(picker).toContain('"Terpasang"');
    expect(picker).toContain("disabled={busyKey !== null || attached}");
    expect(picker).toContain(
      "attachBinding(candidate.resourceType, candidate.resourceId, role)",
    );
  });

  it("preserves authoritative Hub attach/detach validation and owner availability", () => {
    expect(bindings).toContain("ProjectSourceAttachRequestSchema.safeParse");
    expect(bindings).toContain("ProjectSourceDetachRequestSchema.safeParse");
    expect(picker).toContain("source.availability");
    expect(picker).toContain("unavailableReason");
  });

  it("keeps the picker responsive and bounded for large source catalogs", () => {
    expect(styles).toContain(".sourcePickerGrid");
    expect(styles).toContain("max-height: 300px");
    expect(styles).toContain("overflow-y: auto");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });
});
