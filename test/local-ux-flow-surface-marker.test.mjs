import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { UI_SURFACES } from "../scripts/local-ux-product-evidence.mjs";

describe("local UX Flow surface inventory contract", () => {
  it("keeps the configured Flow marker aligned with the rendered Flow page source", () => {
    const flowSurface = UI_SURFACES.find(([name]) => name === "flow");
    expect(flowSurface).toBeDefined();

    const marker = flowSurface?.[2];
    expect(marker).toBe("Visual workflow builder");

    const source = readFileSync(resolve("apps/ai/app/flow/page.tsx"), "utf8");
    expect(source).toContain(marker);
  });
});
