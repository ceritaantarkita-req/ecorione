import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const flowPagePath = resolve("apps/ai/app/flow/page.tsx");
const flowCssPath = resolve("apps/ai/app/flow/FlowCanvas.module.css");
const navigationCssPath = resolve("apps/ai/app/navigation.css");

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("W03 responsive Flow source contracts", () => {
  it("keeps invalid Trigger targets out of connection state", async () => {
    const page = await source(flowPagePath);

    expect(page).toContain('if (target.kind === "trigger")');
    expect(page).toContain('candidate.kind !== "trigger"');
    expect(page).toContain('setMessage("Trigger tidak menerima koneksi masuk.")');
  });

  it("does not render the node shell as a button containing another button", async () => {
    const page = await source(flowPagePath);

    expect(page).toContain('role="button"');
    expect(page).toContain('tabIndex={0}');
    expect(page).toContain('event.key === "Enter" || event.key === " "');
    expect(page).not.toMatch(/<button[\s\S]{0,400}className=\{styles\.nodeMain\}/);
  });

  it("keeps mobile connections explicit and removable", async () => {
    const page = await source(flowPagePath);

    expect(page).toContain("function removeEdge(edgeId: string): void");
    expect(page).toContain("[{edge.sourcePort}] →");
    expect(page).toContain("onClick={() => removeEdge(edge.id)}");
    expect(page).toContain("No connections");
  });

  it("contains mobile Stack by default and constrains Canvas panning inside Flow", async () => {
    const page = await source(flowPagePath);
    const css = await source(flowCssPath);

    expect(page).toContain('useState<MobileMode>("stack")');
    expect(page).toContain('mobileMode === "stack" ? styles.mobileStackActive');
    expect(css).toContain("@media (max-width: 780px)");
    expect(css).toMatch(/\.canvasWrap\s*\{[\s\S]*?overflow-x:\s*auto;/);
    expect(css).toMatch(/\.shell\s*\{[\s\S]*?overflow-x:\s*clip;/);
    expect(css).toMatch(/\.mobileStackActive\s*\{[\s\S]*?display:\s*block;/);
  });

  it("keeps the narrow app navigation as an overlay drawer without content reflow", async () => {
    const css = await source(navigationCssPath);

    expect(css).toContain("@media (max-width: 780px)");
    expect(css).toContain('html[data-mobile-nav="open"] .ecr-global-nav__inner');
    expect(css).toMatch(/html\[data-mobile-nav="open"\] \.ecr-global-nav__inner\s*\{[\s\S]*?position:\s*absolute;/);
    expect(css).toContain('html[data-mobile-nav="open"] .ecr-global-nav__backdrop');
  });
});
