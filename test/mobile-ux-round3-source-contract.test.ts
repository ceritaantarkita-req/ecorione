import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsCssPath = resolve("apps/ai/app/settings/Settings.module.css");
const spaceCssPath = resolve("apps/ai/app/space/Space.module.css");
const mobileCssPath = resolve("apps/ai/app/mobile-ux-overrides.css");
const layoutPath = resolve("apps/ai/app/layout.tsx");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("W03 real-device mobile UX round 3", () => {
  it("keeps the Settings hosted toggle compact instead of inheriting touch-field sizing", async () => {
    const css = await source(settingsCssPath);

    expect(css).toContain("width: 16px !important;");
    expect(css).toContain("min-height: 16px !important;");
    expect(css).toContain("text-overflow: ellipsis;");
  });

  it("keeps Space compact and card-based on narrow screens", async () => {
    const css = await source(spaceCssPath);

    expect(css).toContain("min-height: 150px;");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain("border-radius: var(--radius-md);");
    expect(css).toContain("min-height: 44px;");
  });

  it("loads the semantic mobile override layer after shared navigation styles", async () => {
    const layout = await source(layoutPath);

    expect(layout).toContain('import "./navigation.css";');
    expect(layout).toContain('import "./mobile-ux-overrides.css";');
    expect(layout.indexOf('import "./mobile-ux-overrides.css";')).toBeGreaterThan(
      layout.indexOf('import "./navigation.css";'),
    );
  });

  it("moves Flow lifecycle actions to a bottom bar and exposes connect affordances", async () => {
    const css = await source(mobileCssPath);

    expect(css).toContain('body:has([aria-label="Flow mobile view"])');
    expect(css).toContain("position: fixed;");
    expect(css).toContain("bottom: 0;");
    expect(css).toContain('content: "Edit / connect";');
    expect(css).toContain('content: "Connections";');
    expect(css).toContain('button[aria-label^="Add "]');
  });
});
