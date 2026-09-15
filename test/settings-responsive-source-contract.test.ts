import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsCssPath = resolve("apps/ai/app/settings/Settings.module.css");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("W03 Settings responsive source contracts", () => {
  it("contains page-level horizontal overflow on narrow Settings", async () => {
    const css = await source(settingsCssPath);

    expect(css).toMatch(/\.page\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.page\s*\{[\s\S]*?overflow-x:\s*clip;/);
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 480px)");
  });

  it("stacks narrow Settings controls without desktop minimum widths", async () => {
    const css = await source(settingsCssPath);

    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.inline,[\s\S]*?\.actions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(
      /\.inline input,[\s\S]*?\.actions button\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.page input,[\s\S]*?\.page select,[\s\S]*?\.page textarea\s*\{[\s\S]*?max-width:\s*100%;/,
    );
  });

  it("wraps long Settings metadata and keeps MCP JSON scrolling local", async () => {
    const css = await source(settingsCssPath);

    expect(css).toMatch(
      /\.section p,[\s\S]*?\.section code\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/,
    );
    expect(css).toMatch(
      /\.server span\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/,
    );
    expect(css).toMatch(/\.page textarea\s*\{[\s\S]*?overflow:\s*auto;/);
    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.page textarea\s*\{[\s\S]*?overscroll-behavior-inline:\s*contain;/,
    );
  });

  it("uses deliberate card sections and touch-sized mobile controls", async () => {
    const css = await source(settingsCssPath);

    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.section\s*\{[\s\S]*?border:\s*1px solid var\(--border\);[\s\S]*?border-radius:\s*var\(--radius-md\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.page input,[\s\S]*?\.page select,[\s\S]*?\.page button\s*\{[\s\S]*?min-height:\s*44px;/,
    );
  });
});
