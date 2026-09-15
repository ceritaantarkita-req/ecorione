import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsCssPath = resolve("apps/ai/app/settings/Settings.module.css");

async function settingsCss(): Promise<string> {
  return readFile(settingsCssPath, "utf8");
}

describe("W03 Settings responsive source contracts", () => {
  it("contains narrow viewport breakpoints and page containment", async () => {
    const css = await settingsCss();

    expect(css).toContain("min-width: 0;");
    expect(css).toContain("overflow-x: clip;");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 480px)");
  });

  it("stacks narrow Settings controls into one column", async () => {
    const css = await settingsCss();

    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain("width: 100%;");
    expect(css).toContain("max-width: 100%;");
  });

  it("contains long metadata and MCP JSON inside Settings", async () => {
    const css = await settingsCss();

    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain("word-break: break-word;");
    expect(css).toContain("overflow: auto;");
    expect(css).toContain("overscroll-behavior-inline: contain;");
  });

  it("keeps deliberate mobile cards and touch-sized controls", async () => {
    const css = await settingsCss();

    expect(css).toContain("border-radius: var(--radius-md);");
    expect(css).toContain("min-height: 44px;");
  });
});
