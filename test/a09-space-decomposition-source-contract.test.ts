import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09 Space frontend decomposition contract", () => {
  const page = readFileSync("apps/ai/app/space/page.tsx", "utf8");
  const blocks = readFileSync("apps/ai/app/space/SpacePageBlocks.tsx", "utf8");

  it("keeps the Space page below its audited concentration baseline", () => {
    expect(page.length).toBeLessThan(28_000);
    expect(page).toContain('from "./SpacePageBlocks"');
  });

  it("keeps block defaults and rendering outside owner orchestration", () => {
    expect(blocks).toContain("export function templateFor");
    expect(blocks).toContain("export function BlockPreview");
    expect(blocks).not.toContain("fetch(");
    expect(blocks).not.toContain("/api/");
  });

  it("keeps mutations and owner reads in the Space page boundary", () => {
    expect(page).toContain("async function createPage");
    expect(page).toContain("async function addBlock");
    expect(page).toContain("async function saveBlock");
    expect(page).toContain("async function deleteBlock");
  });
});
