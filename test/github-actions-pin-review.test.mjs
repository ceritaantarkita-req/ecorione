import { describe, expect, it } from "vitest";
import { reviewWorkflowContent } from "../scripts/github-actions-pin-review.mjs";

describe("GitHub Actions immutable pin review", () => {
  it("accepts full 40-character commit SHA refs", () => {
    const content = `
steps:
  - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0
  - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320
`;
    expect(reviewWorkflowContent(".github/workflows/ci.yml", content)).toEqual([]);
  });

  it("rejects mutable tags and branches", () => {
    const content = `
steps:
  - uses: actions/checkout@v5
  - uses: owner/action@main
`;
    expect(reviewWorkflowContent(".github/workflows/ci.yml", content)).toEqual([
      ".github/workflows/ci.yml:3 remote action harus dipin ke full 40-char commit SHA: actions/checkout@v5",
      ".github/workflows/ci.yml:4 remote action harus dipin ke full 40-char commit SHA: owner/action@main",
    ]);
  });

  it("checks reusable remote workflows too", () => {
    const content = `
jobs:
  shared:
    uses: owner/repo/.github/workflows/reusable.yml@stable
`;
    expect(reviewWorkflowContent(".github/workflows/reuse.yml", content)).toEqual([
      ".github/workflows/reuse.yml:4 remote action harus dipin ke full 40-char commit SHA: owner/repo/.github/workflows/reusable.yml@stable",
    ]);
  });

  it("ignores repository-local and docker action targets", () => {
    const content = `
steps:
  - uses: ./ .github/actions/local
  - uses: docker://alpine:3.20
`.replace("./ .github", "./.github");
    expect(reviewWorkflowContent(".github/workflows/local.yml", content)).toEqual([]);
  });
});
