import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type ProductEvalCase = {
  id: string;
  category: string;
  surface: string;
  origin: {
    kind: "bug" | "task";
    source: string;
    ref: string;
  };
  target: {
    file: string;
    testName: string;
  };
  expected: string;
};

type ProductEvalManifest = {
  version: number;
  suite: string;
  claimBoundary: string;
  cases: ProductEvalCase[];
};

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = resolve(repoRoot, "evals/product-regressions.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ProductEvalManifest;

describe("W14 product eval manifest", () => {
  it("menjaga suite bounded, versioned, dan terpisah dari W15 model eval", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.suite).toBe("ecorione-product-regressions");
    expect(manifest.claimBoundary).toMatch(/does not measure agent\/model quality/u);
    expect(manifest.cases.length).toBeGreaterThan(0);
    expect(manifest.cases.length).toBeLessThanOrEqual(50);
  });

  it("memakai id unik dan hanya provenance bug/task nyata", () => {
    const ids = manifest.cases.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of manifest.cases) {
      expect(item.id).toMatch(/^W14-\d{3}$/u);
      expect(["bug", "task"]).toContain(item.origin.kind);
      expect(item.category.trim().length).toBeGreaterThan(0);
      expect(item.surface.trim().length).toBeGreaterThan(0);
      expect(item.expected.trim().length).toBeGreaterThan(12);
    }
  });

  it("setiap provenance dan deterministic regression target benar-benar ada", () => {
    for (const item of manifest.cases) {
      const sourcePath = resolve(repoRoot, item.origin.source);
      const targetPath = resolve(repoRoot, item.target.file);

      expect(existsSync(sourcePath), `${item.id}: source ${item.origin.source}`).toBe(true);
      expect(existsSync(targetPath), `${item.id}: target ${item.target.file}`).toBe(true);
      expect(item.target.file).toMatch(/\.test\.ts$/u);

      const sourceText = readFileSync(sourcePath, "utf8");
      const targetText = readFileSync(targetPath, "utf8");
      expect(sourceText, `${item.id}: provenance ${item.origin.ref}`).toContain(item.origin.ref);
      expect(targetText, `${item.id}: test ${item.target.testName}`).toContain(item.target.testName);
    }
  });
});
