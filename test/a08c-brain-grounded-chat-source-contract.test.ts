import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-08c Brain grounded chat source contract", () => {
  const brainSchema = readFileSync("packages/shared-schema/src/brain.ts", "utf8");
  const chatSchema = readFileSync("packages/shared-schema/src/chat.ts", "utf8");
  const projection = readFileSync("apps/ai/lib/brain-projection.ts", "utf8");
  const contextHttp = readFileSync("services/context/src/http.ts", "utf8");
  const retrieval = readFileSync("services/context/src/retrieval.ts", "utf8");
  const hub = readFileSync("services/hub/src/orchestrate.ts", "utf8");
  const page = readFileSync("apps/ai/app/brain/page.tsx", "utf8");

  it("derives exact URL and Fact identities from the authorized Brain neighborhood", () => {
    expect(brainSchema).toContain("factIds: z.array(MemoryFactIdSchema)");
    expect(projection).toContain('node.type === "Fact"');
    expect(projection).toContain("node.canonicalId");
    expect(projection).toContain("sourceUris");
    expect(projection).toContain("factIds");
  });

  it("narrows Context after its normal Project/scope/sensitivity authorization", () => {
    const authorized = retrieval.indexOf("const authorizedFacts = this.allowedFacts");
    const sourceConstraint = retrieval.indexOf("const sourceConstraint");
    const factConstraint = retrieval.indexOf("const factConstraint");
    expect(authorized).toBeGreaterThanOrEqual(0);
    expect(sourceConstraint).toBeGreaterThan(authorized);
    expect(factConstraint).toBeGreaterThan(authorized);
    expect(contextHttp).toContain("candidateFactIds: z.array(MemoryFactIdSchema)");
    expect(retrieval).toContain("factConstraint?.has(factId)");
    expect(retrieval).toContain("sourceConstraint?.has(sourceUri)");
    expect(retrieval).toContain("constraintApplied");
  });

  it("reuses the canonical Hub chat path and suppresses wider Project memory for Brain turns", () => {
    expect(chatSchema).toContain("ChatContextConstraintSchema");
    expect(chatSchema).toContain('source: z.literal("brain")');
    expect(hub).toContain("HUB_BRAIN_GROUNDED_SYSTEM_PROMPT");
    expect(hub).toContain('req.contextConstraint?.source === "brain"');
    expect(hub).toContain("candidateFactIds: req.contextConstraint.factIds");
    expect(hub).toContain("brainGrounded");
    expect(hub).toContain("? { blocks: [] }");
    expect(hub).toContain("? { pointers: [] }");
    expect(hub).toContain("/v1/complete");
  });

  it("keeps Brain UI local-only, selected-node scoped, and free of a second completion route", () => {
    expect(page).toContain("/api/brain/neighborhood?");
    expect(page).toContain('fetch("/api/chat"');
    expect(page).toContain('target: "local"');
    expect(page).toContain('source: "brain"');
    expect(page).toContain("setAssistantSessionId(makeId");
    expect(page).toContain("constraint.sourceUris.length === 0");
    expect(page).toContain("constraint.factIds.length === 0");
    expect(page).not.toContain("/v1/complete");
    expect(page).not.toContain('target: "hosted"');
  });
});
