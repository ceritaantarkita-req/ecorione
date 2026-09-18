import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type CaseManifest = {
  suite: string;
  cases: Array<{ id: string }>;
};

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function loadManifest(path: string): CaseManifest {
  return JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as CaseManifest;
}

const governedManifests = [
  {
    path: "evals/product-regressions.json",
    manifest: loadManifest("evals/product-regressions.json"),
  },
  { path: "evals/agentic-cases.json", manifest: loadManifest("evals/agentic-cases.json") },
  {
    path: "evals/ecx-selector-heldout.json",
    manifest: loadManifest("evals/ecx-selector-heldout.json"),
  },
];

describe("repository eval inventory budget", () => {
  it("keeps all governed eval cases inside the permanent 50-case ceiling", () => {
    const totalCases = governedManifests.reduce(
      (sum, item) => sum + item.manifest.cases.length,
      0,
    );

    expect(totalCases).toBe(26);
    expect(totalCases).toBeLessThanOrEqual(50);
  });

  it("keeps case ids globally unique across governed manifests", () => {
    const ids = governedManifests.flatMap((item) =>
      item.manifest.cases.map((testCase) => testCase.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every governed manifest named and non-empty", () => {
    for (const item of governedManifests) {
      expect(item.manifest.suite.trim().length, item.path).toBeGreaterThan(0);
      expect(item.manifest.cases.length, item.path).toBeGreaterThan(0);
    }
  });
});
