import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertId, type EcxPacket } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { selectEcxReferenceIndexes } from "../services/hub/src/exchange-selector.js";

type HeldOutCase = {
  id: string;
  category: string;
  surface: string;
  origin: {
    kind: "bug" | "task";
    source: string;
    ref: string;
  };
  query: {
    intent: string;
    task: string;
    need: string[];
  };
  selection: {
    mode: "semantic-v1";
    maxRefs: number;
  };
  descriptors: Array<{
    text: string;
    relevant: boolean;
  }>;
};

type HeldOutManifest = {
  version: number;
  suite: string;
  split: string;
  claimBoundary: string;
  cases: HeldOutCase[];
};

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = resolve(repoRoot, "evals/ecx-selector-heldout.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as HeldOutManifest;

function packetFor(item: HeldOutCase, caseIndex: number): EcxPacket {
  const suffix = String(caseIndex + 1).padStart(3, "0");
  return {
    version: 1,
    packetId: assertId("event", `evt_f6e01_${suffix}`),
    operationId: assertId("operation", `op_f6e01_${suffix}`),
    sender: "agent:planner",
    recipient: "agent:reviewer",
    intent: item.query.intent,
    task: item.query.task,
    need: item.query.need,
    refs: item.descriptors.map((_, descriptorIndex) => ({
      kind: "artifact" as const,
      artifactId: assertId("artifact", `art_f6e01_${suffix}_${String(descriptorIndex)}`),
    })),
    budget: { maxHydratedBytes: 16_384 },
    responseMode: "delta",
  };
}

describe("F6-E01 held-out ECX selector eval", () => {
  it("is bounded, held-out, and explicitly narrower than model/cost/generalization claims", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.suite).toBe("ecorione-f6-e01-heldout-selector");
    expect(manifest.split).toBe("held-out");
    expect(manifest.cases).toHaveLength(10);
    expect(manifest.claimBoundary).toMatch(/does not measure model answer quality/u);
    expect(manifest.claimBoundary).toMatch(/universal optimizer effectiveness/u);
  });

  it("uses unique cases with real bug/task provenance and bounded selector budgets", () => {
    const ids = manifest.cases.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of manifest.cases) {
      expect(item.id).toMatch(/^F6-E01-\d{3}$/u);
      expect(["bug", "task"]).toContain(item.origin.kind);
      expect(item.selection).toMatchObject({ mode: "semantic-v1" });
      expect(item.selection.maxRefs).toBeGreaterThanOrEqual(1);
      expect(item.selection.maxRefs).toBeLessThanOrEqual(3);
      expect(item.query.need.length).toBeGreaterThan(0);
      expect(item.descriptors.length).toBeGreaterThan(item.selection.maxRefs);

      const relevantCount = item.descriptors.filter((descriptor) => descriptor.relevant).length;
      expect(relevantCount).toBeGreaterThan(0);
      expect(relevantCount).toBeLessThanOrEqual(item.selection.maxRefs);

      const sourcePath = resolve(repoRoot, item.origin.source);
      expect(existsSync(sourcePath), `${item.id}: source ${item.origin.source}`).toBe(true);
      expect(
        readFileSync(sourcePath, "utf8"),
        `${item.id}: provenance ${item.origin.ref}`,
      ).toContain(item.origin.ref);
    }
  });

  it("selects every evaluation-only relevant ref without receiving oracle indexes", () => {
    for (const [caseIndex, item] of manifest.cases.entries()) {
      const descriptors = item.descriptors.map((descriptor, index) => ({
        index,
        text: descriptor.text,
      }));
      const relevantIndexes = item.descriptors.flatMap((descriptor, index) =>
        descriptor.relevant ? [index] : [],
      );

      const selected = selectEcxReferenceIndexes(packetFor(item, caseIndex), descriptors, {
        maxRefs: item.selection.maxRefs,
      });

      expect(selected.length, `${item.id}: selected ref budget`).toBeLessThanOrEqual(
        item.selection.maxRefs,
      );
      expect(new Set(selected).size, `${item.id}: selected refs unique`).toBe(selected.length);
      for (const relevantIndex of relevantIndexes) {
        expect(selected, `${item.id}: missing relevant ref ${String(relevantIndex)}`).toContain(
          relevantIndex,
        );
      }
    }
  });
});
