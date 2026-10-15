import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Project Memory diagnostics boundary", () => {
  const route = readFileSync("apps/ai/app/api/projects/memory-status/route.ts", "utf8");
  const page = readFileSync("apps/ai/app/projects/page.tsx", "utf8");
  const component = readFileSync("apps/ai/app/projects/ProjectMemoryStatus.tsx", "utf8");
  const context = readFileSync("services/context/src/http.ts", "utf8");

  it("verifies Hub Project owner before querying Context", () => {
    expect(route).toContain("await authorizeBrainProject(");
    expect(route).toContain("ProjectIdSchema.safeParse");
    expect(route.indexOf("await authorizeBrainProject(")).toBeLessThan(
      route.indexOf("const response = await fetch("),
    );
    expect(route).toContain("contextUrl()");
  });

  it("surfaces read-only Project-specific counts with no uncontrolled memory selector", () => {
    expect(page).toContain("<ProjectMemoryStatus");
    expect(page).toContain("key={`memory:${selected.id}`}");
    expect(component).toContain("pendingEpisodes");
    expect(component).toContain("savedFacts");
    expect(component).toContain("localOnlyFacts");
    expect(component).toContain("cloudEligibleFacts");
    expect(component).toContain("Fakta Local Only tidak boleh dibaca OpenRouter");
    expect(context).toContain('app.get("/v1/memory/status"');
    expect(route).not.toContain("POST(request");
  });
});
