import { describe, expect, it } from "vitest";
import {
  isLocalBuiltImage,
  readContainerImageLock,
  reviewComposeContent,
  reviewDockerfileContent,
} from "../scripts/container-image-digest-review.mjs";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

describe("container image digest review", () => {
  it("accepts an exact four-image lock", () => {
    const images = readContainerImageLock(() =>
      JSON.stringify({
        schemaVersion: 1,
        images: {
          node: `node:22.20.0-bookworm-slim@sha256:${DIGEST_A}`,
          postgres: `postgres:17.6-alpine@sha256:${DIGEST_A}`,
          caddy: `caddy:2.11.4-alpine@sha256:${DIGEST_A}`,
          temporal: `temporalio/auto-setup:1.29.7@sha256:${DIGEST_A}`,
        },
      }),
    );
    expect(Object.keys(images).sort()).toEqual(["caddy", "node", "postgres", "temporal"]);
  });

  it("rejects incomplete or mutable lock entries", () => {
    expect(() =>
      readContainerImageLock(() =>
        JSON.stringify({
          schemaVersion: 1,
          images: {
            node: "node:22.20.0-bookworm-slim",
            postgres: `postgres:17.6-alpine@sha256:${DIGEST_A}`,
            caddy: `caddy:2.11.4-alpine@sha256:${DIGEST_A}`,
            temporal: `temporalio/auto-setup:1.29.7@sha256:${DIGEST_A}`,
          },
        }),
      ),
    ).toThrow(/images\.node harus tag@sha256/);
  });

  it("accepts tagged digest-pinned external images", () => {
    expect(
      reviewDockerfileContent(`FROM node:22.20.0-bookworm-slim@sha256:${DIGEST_A}\n`),
    ).toEqual([]);
    expect(
      reviewComposeContent(
        "deploy/compose.yml",
        `services:\n  db:\n    image: postgres:17.6-alpine@sha256:${DIGEST_A}\n`,
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

  it("rejects a valid digest that differs from the reviewed lock", () => {
    const expected = `postgres:17.6-alpine@sha256:${DIGEST_A}`;
    const actual = `postgres:17.6-alpine@sha256:${DIGEST_B}`;
    expect(
      reviewComposeContent("deploy/local-temporal.yml", `image: ${actual}\n`, [expected]),
    ).toEqual([
      `deploy/local-temporal.yml external image tidak cocok dengan reviewed lock: ${actual}`,
      `deploy/local-temporal.yml reviewed image hilang: ${expected}`,
    ]);
  });

  it("rejects digest-only identities without readable tag", () => {
    expect(reviewDockerfileContent(`FROM node@sha256:${DIGEST_A}\n`)).toEqual([
      `Dockerfile:1 external base image harus tag@sha256:<64hex>: node@sha256:${DIGEST_A}`,
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
