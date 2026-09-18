import { describe, expect, it } from "vitest";
import {
  isRepositoryBuiltImage,
  reviewComposeContent,
  reviewDockerfileContent,
  reviewImageReference,
} from "../scripts/container-image-review.mjs";

const DIGEST = `sha256:${"a".repeat(64)}`;

describe("immutable container image review", () => {
  it("accepts external readable tag + full sha256 digest", () => {
    expect(
      reviewImageReference("deploy/compose.yml", 3, `postgres:17.6-alpine@${DIGEST}`),
    ).toEqual([]);
    expect(
      reviewDockerfileContent("Dockerfile", `FROM node:22.20.0-bookworm-slim@${DIGEST}\n`),
    ).toEqual([]);
  });

  it("rejects tag-only external references", () => {
    expect(
      reviewComposeContent("deploy/compose.yml", "image: postgres:17.6-alpine\n"),
    ).toEqual([
      "deploy/compose.yml:1 external image harus memakai readable tag + @sha256 digest: postgres:17.6-alpine",
    ]);
  });

  it("rejects digest-only and malformed digest references", () => {
    expect(
      reviewImageReference("deploy/compose.yml", 7, `postgres@${DIGEST}`),
    ).toContain(
      `deploy/compose.yml:7 image digest harus mempertahankan explicit readable tag: postgres@${DIGEST}`,
    );
    expect(
      reviewImageReference(
        "deploy/compose.yml",
        8,
        "postgres:17.6-alpine@sha256:abc",
      ),
    ).toContain(
      "deploy/compose.yml:8 image digest harus full sha256 64-hex: postgres:17.6-alpine@sha256:abc",
    );
  });

  it("allows repository-built ECORIONE images but not arbitrary dynamic images", () => {
    expect(
      isRepositoryBuiltImage("ecorione:${ECORIONE_IMAGE_TAG:-local}", "deploy/compose.yml"),
    ).toBe(true);
    expect(
      isRepositoryBuiltImage(
        "${ECORIONE_DESKTOP_IMAGE:?set ECORIONE_DESKTOP_IMAGE}",
        "desktop/compose.yml",
      ),
    ).toBe(true);
    expect(
      reviewImageReference("deploy/compose.yml", 10, "${UNTRUSTED_EXTERNAL_IMAGE}"),
    ).not.toEqual([]);
  });

  it("checks every image declaration in compose content", () => {
    const content = [
      `image: postgres:17.6-alpine@${DIGEST}`,
      "image: temporalio/auto-setup:1.29.7",
    ].join("\n");
    expect(reviewComposeContent("deploy/local-temporal.yml", content)).toEqual([
      "deploy/local-temporal.yml:2 external image harus memakai readable tag + @sha256 digest: temporalio/auto-setup:1.29.7",
    ]);
  });
});
