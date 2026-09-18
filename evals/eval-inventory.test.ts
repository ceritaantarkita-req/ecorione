import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type CaseManifest = {
  suite: string;
  cases: Array<{ id: string }>;
};

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const evalsRoot = resolve(repoRoot, "evals");

function isCaseManifest(value: unknown): value is CaseManifest {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as { suite?: unknown; cases?: unknown };
  return typeof candidate.suite === "string" && Array.isArray(candidate.cases);
}

function discoverGovernedManifests() {
  return readdirSync(evalsRoot)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => {
      const path = `evals/${name}`;
      const parsed = JSON.parse(readFileSync(resolve(repoRoot, path), "utf8")) as unknown;
      return isCaseManifest(parsed) ? [{ path, manifest: parsed }] : [];
    });
}

const governedManifests = discoverGovernedManifests();

describe("repository eval inventory budget", () => {
  it("auto-discovers every eval JSON case manifest instead of relying on a hardcoded list", () => {
    expect(governedManifests.map((item) => item.path)).toEqual([
      "evals/agentic-cases.json",
      "evals/ecx-selector-heldout.json",
      "evals/product-regressions.json",
    ]);
  });

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
