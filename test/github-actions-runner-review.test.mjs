import { describe, expect, it } from "vitest";
import { reviewRunnerLabels } from "../scripts/github-actions-runner-review.mjs";

describe("GitHub Actions fixed runner label review", () => {
  it("accepts fixed GitHub-hosted OS labels", () => {
    const content = `
jobs:
  linux:
    runs-on: ubuntu-24.04
  windows:
    runs-on: windows-2025
`;
    expect(reviewRunnerLabels(".github/workflows/ci.yml", content)).toEqual([]);
  });

  it("rejects mutable latest runner aliases", () => {
    const content = `
jobs:
  linux:
    runs-on: ubuntu-latest
  windows:
    runs-on: "windows-latest"
`;
    expect(reviewRunnerLabels(".github/workflows/ci.yml", content)).toEqual([
      ".github/workflows/ci.yml:4 GitHub-hosted runner label harus dipin ke versi OS tetap: ubuntu-latest",
      ".github/workflows/ci.yml:6 GitHub-hosted runner label harus dipin ke versi OS tetap: windows-latest",
    ]);
  });

  it("rejects latest labels inside inline runner arrays", () => {
    const content = `
jobs:
  build:
    runs-on: [self-hosted, linux, ubuntu-latest]
`;
    expect(reviewRunnerLabels(".github/workflows/reuse.yml", content)).toEqual([
      ".github/workflows/reuse.yml:4 GitHub-hosted runner label harus dipin ke versi OS tetap: [self-hosted, linux, ubuntu-latest]",
    ]);
  });

  it("does not reject non-GitHub-hosted custom latest-like labels", () => {
    const content = `
jobs:
  custom:
    runs-on: [self-hosted, my-runner-latest]
`;
    expect(reviewRunnerLabels(".github/workflows/custom.yml", content)).toEqual([]);
  });
});
