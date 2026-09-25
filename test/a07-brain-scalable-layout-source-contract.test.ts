import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layoutPath = resolve("apps/ai/lib/brain-layout.ts");
const pagePath = resolve("apps/ai/app/brain/page.tsx");
const cssPath = resolve("apps/ai/app/brain/Brain.module.css");
const browserPath = resolve("scripts/pcs06-browser-acceptance.mjs");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("A-07 Brain scalable-layout source contract", () => {
  it("uses a dynamic deterministic canvas with bounded minimum node spacing", async () => {
    const layout = await source(layoutPath);

    expect(layout).toContain("BRAIN_CANVAS_MIN_HEIGHT = 640");
    expect(layout).toContain("BRAIN_NODE_MIN_CENTER_GAP = 64");
    expect(layout).toContain("largestLane - 1");
    expect(layout).toContain("layoutBrainNodes");
  });

  it("exposes explicit pan, zoom, reset, and drag-to-pan controls", async () => {
    const page = await source(pagePath);

    expect(page).toContain('aria-label="Pan Brain graph"');
    expect(page).toContain('aria-label="Pan down"');
    expect(page).toContain('aria-label="Zoom in"');
    expect(page).toContain('aria-label="Zoom out"');
    expect(page).toContain('aria-label="Reset graph view"');
    expect(page).toContain("onPointerDown={startGraphPan}");
    expect(page).toContain("layoutBrainNodes(visibleNodes)");
    expect(page).not.toContain("VIEWBOX_HEIGHT");
  });

  it("contains graph overflow inside the Brain panel instead of the page", async () => {
    const css = await source(cssPath);

    expect(css).toMatch(/\.graphScroll\s*\{[\s\S]*?height:\s*min\(68dvh, 640px\);/);
    expect(css).toMatch(/\.graphScroll\s*\{[\s\S]*?overflow-x:\s*auto;/);
    expect(css).toMatch(/\.graphScroll\s*\{[\s\S]*?overflow-y:\s*auto;/);
    expect(css).toMatch(/\.graph\s*\{[\s\S]*?max-width:\s*none;/);
  });

  it("proves the allowed 50-Run case in rendered browser acceptance", async () => {
    const browser = await source(browserPath);

    expect(browser).toContain("Array.from({ length: 50 }");
    expect(browser).toContain("50-Run layout does not preserve 64px center spacing");
    expect(browser).toContain('name: "Pan down"');
    expect(browser).toContain('name: "Zoom in"');
    expect(browser).toContain("desktop-brain-scalable-layout");
  });
});
