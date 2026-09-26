import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09e Space frontend decomposition source contract", () => {
  const page = readFileSync("apps/ai/app/space/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/space/SpacePageSections.tsx", "utf8");
  const model = readFileSync("apps/ai/app/space/space-page-model.ts", "utf8");

  it("keeps owner reads and mutations in the Space page boundary", () => {
    expect(page).toContain("const loadPage = useCallback");
    expect(page).toContain("const refreshPages = useCallback");
    expect(page).toContain("const refreshMemory = useCallback");
    expect(page).toContain("async function createPage");
    expect(page).toContain("async function addBlock");
    expect(page).toContain("async function saveBlock");
    expect(page).toContain("async function deleteBlock");
    expect(page).toContain("async function moveBlock");
    expect(page).toContain("async function resolveBlock");
    expect(page).toContain("async function renamePage");
    expect(page).toContain("async function saveMemory");
  });

  it("moves workspace presentation into fetch-free sections", () => {
    expect(page).toContain("<PagesRail");
    expect(page).toContain("<DocumentPanel");
    expect(page).toContain("<InspectorPanel");
    expect(sections).toContain("BlockPreview");
    expect(sections).toContain("Context core memory");
    expect(sections).not.toContain("fetch(");
    expect(sections).not.toContain("/api/");
  });

  it("centralizes pure block-kind and template helpers", () => {
    expect(model).toContain("export const BLOCK_KINDS");
    expect(model).toContain("export function templateFor");
    expect(model).not.toContain("fetch(");
    expect(model).not.toContain("/api/");
    expect(page).not.toContain("const BLOCK_KINDS");
    expect(page).not.toContain("function templateFor");
  });

  it("materially reduces the Space orchestration module concentration", () => {
    expect(page.length).toBeLessThan(23_000);
  });
});
