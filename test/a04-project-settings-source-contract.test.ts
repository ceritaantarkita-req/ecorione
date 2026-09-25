import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-04 Project settings source contract", () => {
  const page = readFileSync("apps/ai/app/projects/page.tsx", "utf8");
  const settings = readFileSync("apps/ai/app/projects/ProjectSettings.tsx", "utf8");
  const route = readFileSync("apps/ai/app/api/projects/[id]/route.ts", "utf8");
  const schema = readFileSync("packages/shared-schema/src/project.ts", "utf8");

  it("creates Projects with the editable settings exposed by the backend contract", () => {
    expect(page).toContain("createDescription");
    expect(page).toContain("createInstruction");
    expect(page).toContain("createAutonomyCeiling");
    expect(page).toContain("description: createDescription");
    expect(page).toContain("instruction: createInstruction");
    expect(page).toContain("autonomyCeiling: createAutonomyCeiling");
  });

  it("edits Project metadata through a same-origin validated PATCH route", () => {
    expect(page).toContain("<ProjectSettings");
    expect(settings).toContain('method: "PATCH"');
    expect(settings).toContain("description");
    expect(settings).toContain("instruction");
    expect(settings).toContain("autonomyCeiling");
    expect(route).toContain("ProjectUpdateRequestSchema.safeParse");
    expect(route).toContain('method: "PATCH"');
  });

  it("keeps the V1 memory policy fixed instead of presenting a fake selector", () => {
    expect(schema).toContain('z.literal("GLOBAL_PLUS_PROJECT")');
    expect(settings).toContain("{props.project.memoryPolicy}");
    expect(settings).toContain("Fixed V1 policy");
    expect(settings).not.toContain('option value="PROJECT_ONLY"');
  });
});
