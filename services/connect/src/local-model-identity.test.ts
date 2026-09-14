import { describe, expect, it } from "vitest";
import {
  LocalModelDigestSchema,
  localModelIdentity,
  parseOptionalLocalModelDigest,
} from "./local-model-identity.js";

const DIGEST = `sha256:${"a".repeat(64)}`;

describe("local model identity", () => {
  it("normalizes a raw SHA-256 hex digest", () => {
    expect(LocalModelDigestSchema.parse("A".repeat(64))).toBe(DIGEST);
    expect(parseOptionalLocalModelDigest(`  ${DIGEST.toUpperCase()}  `)).toBe(DIGEST);
  });

  it("rejects malformed model digests", () => {
    expect(() => LocalModelDigestSchema.parse("sha256:abc")).toThrow(/SHA-256/);
  });

  it("treats an absent digest as explicitly unpinned", () => {
    expect(
      localModelIdentity({
        runtime: "openai-compatible",
        modelTag: "qwen3:8b",
        digest: null,
      }),
    ).toEqual({
      id: "local:openai-compatible:qwen3:8b@unpinned",
      pinned: false,
      digest: null,
    });
  });

  it("builds a reproducible identity when a digest is pinned", () => {
    expect(
      localModelIdentity({
        runtime: "openai-compatible",
        modelTag: "qwen3:8b",
        digest: DIGEST,
      }),
    ).toEqual({
      id: `local:openai-compatible:qwen3:8b@${DIGEST}`,
      pinned: true,
      digest: DIGEST,
    });
  });
});
