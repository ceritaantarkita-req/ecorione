import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09 Flow frontend decomposition contract", () => {
  const page = readFileSync("apps/ai/app/flow/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/flow/FlowPageSections.tsx", "utf8");
  const model = readFileSync("apps/ai/app/flow/flow-page-model.ts", "utf8");

  it("keeps the orchestration page below its audited concentration baseline", () => {
    expect(page.length).toBeLessThan(55_000);
    expect(page).toContain('from "./FlowPageSections"');
    expect(page).toContain('from "./flow-page-model"');
  });

  it("keeps extracted page-model and presentation modules free of owner API calls", () => {
    expect(model).not.toContain("fetch(");
    expect(sections).not.toContain("fetch(");
    expect(model).not.toContain("/api/");
    expect(sections).not.toContain("/api/");
  });

  it("keeps authority and execution orchestration in the page boundary", () => {
    expect(page).toContain("async function prepareAuthority");
    expect(page).toContain("async function decideAuthority");
    expect(page).toContain("async function runGraph");
    expect(page).toContain("async function decide(node:");
    expect(page).toContain("async function submitHuman");
    expect(sections).toContain("FlowAuthorityPanel");
    expect(sections).toContain("FlowExecutionPanel");
  });
});
