import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRepoRuntimePath } from "./runtime-path.js";

describe("resolveRepoRuntimePath", () => {
  const repoRoot = resolve("/tmp", "ecorione-runtime-path-test");

  it("anchors configured relative paths to the repository root", () => {
    expect(resolveRepoRuntimePath(repoRoot, "./data/hub.db", "data/default.db")).toBe(
      resolve(repoRoot, "data/hub.db"),
    );
  });

  it("anchors fallback paths to the repository root", () => {
    expect(resolveRepoRuntimePath(repoRoot, undefined, "data/default.db")).toBe(
      resolve(repoRoot, "data/default.db"),
    );
    expect(resolveRepoRuntimePath(repoRoot, "", "data/default.db")).toBe(
      resolve(repoRoot, "data/default.db"),
    );
  });

  it("preserves absolute configured paths", () => {
    const absolute = resolve(repoRoot, "..", "external", "runtime.db");
    expect(resolveRepoRuntimePath(repoRoot, absolute, "data/default.db")).toBe(absolute);
  });
});
