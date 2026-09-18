import { describe, expect, it } from "vitest";
import {
  readPinnedNodeVersion,
  reviewDockerfile,
  reviewNodeWorkflowContent,
} from "../scripts/node-toolchain-review.mjs";

describe("immutable Node toolchain review", () => {
  it("accepts exact semver from .node-version", () => {
    expect(readPinnedNodeVersion(() => "22.20.0\n")).toBe("22.20.0");
  });

  it("rejects mutable or incomplete Node versions", () => {
    expect(() => readPinnedNodeVersion(() => "22\n")).toThrow(/exact semver/);
    expect(() => readPinnedNodeVersion(() => "22.20\n")).toThrow(/exact semver/);
    expect(() => readPinnedNodeVersion(() => "lts/*\n")).toThrow(/exact semver/);
  });

  it("accepts setup-node using the central version file", () => {
    const workflow = `
steps:
  - uses: actions/setup-node@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    with:
      node-version-file: ".node-version"
      cache: pnpm
`;
    expect(reviewNodeWorkflowContent(".github/workflows/ci.yml", workflow)).toEqual([]);
  });

  it("rejects direct mutable setup-node selectors", () => {
    const workflow = `
steps:
  - uses: actions/setup-node@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    with:
      node-version: 22
`;
    expect(reviewNodeWorkflowContent(".github/workflows/ci.yml", workflow)).toEqual([
      ".github/workflows/ci.yml:5 node-version langsung dilarang; gunakan node-version-file: .node-version",
      ".github/workflows/ci.yml:5 actions/setup-node harus memakai node-version-file: .node-version",
    ]);
  });

  it("requires Dockerfile Node base to match the exact pinned version", () => {
    expect(reviewDockerfile("FROM node:22.20.0-bookworm-slim\n", "22.20.0")).toEqual([]);
    expect(reviewDockerfile("FROM node:22-bookworm-slim\n", "22.20.0")).toEqual([
      "Dockerfile Node base harus selaras dengan .node-version=22.20.0, ditemukan node:22-bookworm-slim",
    ]);
  });
});
