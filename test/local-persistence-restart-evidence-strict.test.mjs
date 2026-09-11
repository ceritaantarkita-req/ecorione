import { describe, expect, it } from "vitest";
import {
  assertBaselineEvidenceState,
  assertCleanupEvidenceState,
  assertPostEvidenceState,
} from "../scripts/local-persistence-restart-evidence-strict.mjs";

function baselineState() {
  return {
    phase: "baseline-ready",
    ledger: {
      eventHash: "hash-1",
      headHash: "hash-1",
    },
    context: {
      episodeId: "episode-1",
      sha256: "context-hash",
    },
    artifact: {
      artifactId: "artifact-1",
      sha256: "artifact-hash",
    },
    flow: {
      flowId: "flow-1",
      approvalOperationId: "operation-1",
      statusBefore: "RUNNING",
    },
  };
}

describe("strict local persistence restart evidence gates", () => {
  it("accepts an exact baseline identity", () => {
    const state = baselineState();
    expect(() =>
      assertBaselineEvidenceState(
        state,
        { status: "PENDING", operationId: "operation-1" },
        { headHash: "hash-1", nextSeq: 1 },
      ),
    ).not.toThrow();
  });

  it("rejects a baseline that is not durably waiting", () => {
    const state = baselineState();
    state.flow.statusBefore = "COMPLETED";
    expect(() =>
      assertBaselineEvidenceState(
        state,
        { status: "PENDING", operationId: "operation-1" },
        { headHash: "hash-1", nextSeq: 1 },
      ),
    ).toThrow("baseline Flow status");
  });

  it("rejects a baseline whose approval is no longer pending", () => {
    const state = baselineState();
    expect(() =>
      assertBaselineEvidenceState(
        state,
        { status: "APPROVE", operationId: "operation-1" },
        { headHash: "hash-1", nextSeq: 1 },
      ),
    ).toThrow("baseline approval status");
  });

  it("rejects a baseline Ledger head mismatch", () => {
    const state = baselineState();
    expect(() =>
      assertBaselineEvidenceState(
        state,
        { status: "PENDING", operationId: "operation-1" },
        { headHash: "different", nextSeq: 1 },
      ),
    ).toThrow("session headHash");
  });

  it("accepts exact post-restart identities", () => {
    const state = {
      ...baselineState(),
      phase: "post-verified",
      post: {
        ledger: { eventHash: "hash-1", headHash: "hash-1", nextSeq: 1 },
        context: { episodeId: "episode-1", sha256: "context-hash" },
        artifact: { artifactId: "artifact-1", sha256: "artifact-hash" },
        flow: { flowId: "flow-1", status: "RUNNING" },
      },
    };
    expect(() =>
      assertPostEvidenceState(state, { status: "PENDING", operationId: "operation-1" }),
    ).not.toThrow();
  });

  it("rejects post-restart Ledger head drift", () => {
    const state = {
      ...baselineState(),
      phase: "post-verified",
      post: {
        ledger: { eventHash: "hash-1", headHash: "changed", nextSeq: 1 },
        context: { episodeId: "episode-1", sha256: "context-hash" },
        artifact: { artifactId: "artifact-1", sha256: "artifact-hash" },
        flow: { flowId: "flow-1", status: "RUNNING" },
      },
    };
    expect(() =>
      assertPostEvidenceState(state, { status: "PENDING", operationId: "operation-1" }),
    ).toThrow("Ledger headHash changed");
  });

  it("rejects post-restart approval drift", () => {
    const state = {
      ...baselineState(),
      phase: "post-verified",
      post: {
        ledger: { eventHash: "hash-1", headHash: "hash-1", nextSeq: 1 },
        context: { episodeId: "episode-1", sha256: "context-hash" },
        artifact: { artifactId: "artifact-1", sha256: "artifact-hash" },
        flow: { flowId: "flow-1", status: "RUNNING" },
      },
    };
    expect(() =>
      assertPostEvidenceState(state, { status: "REJECT", operationId: "operation-1" }),
    ).toThrow("post approval status");
  });

  it("accepts cleanup only after the Flow is terminal", () => {
    expect(() =>
      assertCleanupEvidenceState({
        phase: "cleanup-complete",
        cleanup: { finalStatus: "REJECTED" },
      }),
    ).not.toThrow();
    expect(() =>
      assertCleanupEvidenceState({
        phase: "cleanup-complete",
        cleanup: { finalStatus: "RUNNING" },
      }),
    ).toThrow("not terminal");
  });
});
