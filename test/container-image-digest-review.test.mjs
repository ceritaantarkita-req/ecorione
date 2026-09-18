import { describe, expect, it } from "vitest";
import {
  isLocalBuiltImage,
  reviewComposeContent,
  reviewDockerfileContent,
} from "../scripts/container-image-digest-review.mjs";

const DIGEST = "a".repeat(64);

describe("container image digest review", () => {
  it("accepts tagged digest-pinned external images", () => {
    expect(
      reviewDockerfileContent(`FROM node:22.20.0-bookworm-slim@sha256:${DIGEST}\n`),
    ).toEqual([]);
    expect(
      reviewComposeContent(
        "deploy/compose.yml",
        `services:\n  db:\n    image: postgres:17.6-alpine@sha256:${DIGEST}\n`,
      ),
    ).toEqual([]);
  });

  it("rejects tag-only external images", () => {
    expect(reviewDockerfileContent("FROM node:22.20.0-bookworm-slim\n")).toEqual([
      "Dockerfile:1 external base image harus tag@sha256:<64hex>: node:22.20.0-bookworm-slim",
    ]);
    expect(
      reviewComposeContent(
        "deploy/compose.yml",
        "services:\n  db:\n    image: postgres:17.6-alpine\n",
      ),
    ).toEqual([
      "deploy/compose.yml:3 external image harus tag@sha256:<64hex>: postgres:17.6-alpine",
    ]);
  });

  it("rejects malformed or digest-only identities without readable tag", () => {
    expect(reviewDockerfileContent(`FROM node@sha256:${DIGEST}\n`)).toEqual([
      `Dockerfile:1 external base image harus tag@sha256:<64hex>: node@sha256:${DIGEST}`,
    ]);
  });

  it("allows repository-built ECORIONE image identity", () => {
    const image = "ecorione:${ECORIONE_IMAGE_TAG:-local}";
    expect(isLocalBuiltImage(image)).toBe(true);
    expect(reviewComposeContent("deploy/compose.yml", `image: ${image}\n`)).toEqual([]);
  });

  it("allows scratch build stages", () => {
    expect(reviewDockerfileContent("FROM scratch\n")).toEqual([]);
  });
});
