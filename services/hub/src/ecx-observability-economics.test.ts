import {
  CapabilityGrantRequestSchema,
  EcxExecutionCompletionSchema,
  EcxRoundTripResponseSchema,
  assertId,
} from "@ecorione/shared-schema";
import { observabilityFor } from "@ecorione/shared-server";
import { afterEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

const NOW = "2026-09-27T10:00:00.000Z";

function completion(
  reply: string,
  inputTokens: number,
  outputTokens: number,
  actualUsd: number,
  naiveUsd: number,
) {
  const usage = {
    inputTokens,
    outputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  return {
    reply,
    provider: "local",
    model: "qwen-b5-test",
    pricingModel: "local/provider-token-zero",
    responseModel: "qwen-b5-test",
    modelIdentity: "local:test:qwen-b5-test",
    modelIdentityPinned: true,
    modelIdentityProvenance: "provider-verified",
    cacheHit: false,
    usage,
    cost: {
      model: "local/provider-token-zero",
      naiveModel: "claude-sonnet-4-5-20250929",
      usage,
      baselineUsage: usage,
      actualUsd,
      naiveUsd,
      savedUsd: naiveUsd - actualUsd,
      savedPct: naiveUsd === 0 ? 0 : ((naiveUsd - actualUsd) / naiveUsd) * 100,
      routeReason: "local-consolidation",
      policyVersion: "3",
      optimizerOverheadMs: 1.25,
      operationId: "op_b5connectshape001",
    },
    routeReason: "local-consolidation",
  };
}

describe("ECX Batch 5 observability and economics", () => {
  let db: HubDatabase | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  function setup() {
    db = openHubDatabase(":memory:");
    const app = buildHubServer(db, {
      contextUrl: "http://context.invalid",
      connectUrl: "http://connect.invalid",
      rndUrl: "http://rnd.invalid",
      artifactUrl: "http://artifact.invalid",
    });
    return app;
  }

  async function bind(
    app: ReturnType<typeof buildHubServer>,
    agentId: string,
    capability: string,
    suffix: string,
  ) {
    const response = await app.inject({
      method: "PUT",
      url: "/v1/exchange/agents/" + agentId,
      payload: {
        operationId: assertId("operation", "op_b5bind" + suffix),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: [capability],
        systemPrompt: "Batch 5 bounded " + agentId + " prompt.",
        enabled: true,
      },
    });
    expect(response.statusCode).toBe(200);
  }

  function grantModel(agentId: string, suffix: string) {
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_b5model" + suffix),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: agentId },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 5 focused telemetry test.",
        idempotencyKey: "ecx-b5-model-" + suffix,
      }),
      NOW,
    );
  }

  function grantResultReceive(agentId: string, suffix: string) {
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_b5result" + suffix),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: agentId },
        capabilityId: "agent.result.receive",
        permissionIds: ["agent.result.receive"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 5 focused result receive grant.",
        idempotencyKey: "ecx-b5-result-" + suffix,
      }),
      NOW,
    );
  }

  async function plan(
    app: ReturnType<typeof buildHubServer>,
    input: {
      operationId: string;
      sender: string;
      recipient: string;
      responseMode: "delta" | "full";
      refs?: unknown[];
    },
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", input.operationId),
        requestedAt: NOW,
        sender: input.sender,
        intent: "b5-e2e-measurement",
        task: "Return the requested deterministic evidence.",
        need: ["review"],
        refs: input.refs ?? [],
        budget: { maxHydratedBytes: 16_384 },
        responseMode: input.responseMode,
        candidates: [{ agentId: input.recipient, capabilities: ["review"], estimatedCost: 0 }],
      },
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as { packets: unknown[] }).packets[0];
  }

  const roundTripPayload = (packet: unknown) => ({
    packet,
    workspaceId: "ws_personal",
    scope: "personal",
    maxSensitivity: "INTERNAL",
    requestedAt: NOW,
  });

  it("accepts the full Connect accounting shape while retaining only bounded ECX fields", () => {
    const parsed = EcxExecutionCompletionSchema.parse(
      completion("ACCOUNTING_OK", 12, 4, 0.01, 0.02),
    );
    expect(parsed.usage).toEqual({
      inputTokens: 12,
      outputTokens: 4,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(parsed.cost).toEqual({
      actualUsd: 0.01,
      naiveUsd: 0.02,
      savedUsd: 0.01,
      savedPct: 50,
      optimizerOverheadMs: 1.25,
      baselineUsage: {
        inputTokens: 12,
        outputTokens: 4,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    });
    expect(parsed.cost).not.toHaveProperty("model");
    expect(parsed.cost).not.toHaveProperty("operationId");
  });

  it("preserves historical Batch 4 round-trip results without Batch 5 telemetry", () => {
    const childCompletion = {
      reply: "LEGACY_CHILD",
      provider: "local",
      model: "legacy-model",
      responseModel: "legacy-model",
      modelIdentity: "local:legacy-model",
      modelIdentityPinned: true,
      cacheHit: false,
      routeReason: "local-consolidation",
    };
    const parsed = EcxRoundTripResponseSchema.parse({
      packetId: "evt_b5legacy001",
      operationId: "op_b5legacy001",
      continuationOperationId: "op_b5legacycont001",
      sender: "agent:b5-legacy-parent",
      recipient: "agent:b5-legacy-child",
      responseMode: "full",
      state: "SUCCEEDED",
      replayed: true,
      child: {
        packetId: "evt_b5legacy001",
        operationId: "op_b5legacy001",
        recipient: "agent:b5-legacy-child",
        target: "local",
        state: "SUCCEEDED",
        replayed: true,
        hydratedBytes: 0,
        selectedRefIndexes: [],
        history: { startedEventId: null, outcomeEventId: null },
        completion: childCompletion,
      },
      returnedResult: {
        sourceAgent: "agent:b5-legacy-child",
        sourceTarget: "local",
        trust: "LOCAL_AGENT",
        sensitivity: "INTERNAL",
        reply: "LEGACY_CHILD",
        evidence: {
          replyBytes: Buffer.byteLength("LEGACY_CHILD", "utf8"),
          replySha256: "a".repeat(64),
        },
      },
      handback: {
        parentContinued: false,
        parentTarget: "local",
        finalSource: "recipient",
        finalReply: "LEGACY_CHILD",
        parentCompletion: null,
      },
      history: { returnedEventId: null, continuationEventId: null },
    });
    expect(parsed.telemetry).toBeUndefined();
    expect(parsed.child.completion.usage).toBeUndefined();
    expect(parsed.child.completion.cost).toBeUndefined();
  });

  it("aggregates child plus parent usage/cost for delta and replays without provider redispatch", async () => {
    const app = setup();
    await bind(app, "agent:b5-parent-delta", "compose", "parentdelta001");
    await bind(app, "agent:b5-child-delta", "review", "childdelta001");
    grantModel("agent:b5-parent-delta", "parentdelta001");
    grantResultReceive("agent:b5-parent-delta", "parentdelta001");
    grantModel("agent:b5-child-delta", "childdelta001");
    const packet = await plan(app, {
      operationId: "op_b5delta001",
      sender: "agent:b5-parent-delta",
      recipient: "agent:b5-child-delta",
      responseMode: "delta",
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    connect
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, completion("CHILD_B5", 11, 3, 0.01, 0.02));
    connect
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, completion("PARENT_B5_FINAL", 7, 2, 0.02, 0.04));
    setGlobalDispatcher(mock);

    try {
      const payload = roundTripPayload(packet);
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        replayed: false,
        responseMode: "delta",
        telemetry: {
          accountedModelCalls: 2,
          inputTokens: 18,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          actualUsd: 0.03,
          naiveUsd: 0.06,
          refCandidateCount: 0,
          refSelectedCount: 0,
          refOmittedCount: 0,
        },
        handback: {
          finalSource: "sender",
          finalReply: "PARENT_B5_FINAL",
        },
      });
      const firstBody = first.json() as {
        telemetry: {
          totalLatencyMs: number;
          childLatencyMs: number;
          continuationLatencyMs: number | null;
        };
      };
      expect(firstBody.telemetry.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(firstBody.telemetry.childLatencyMs).toBeGreaterThanOrEqual(0);
      expect(firstBody.telemetry.continuationLatencyMs).toBeGreaterThanOrEqual(0);

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toMatchObject({
        replayed: true,
        telemetry: {
          accountedModelCalls: 2,
          actualUsd: 0.03,
          naiveUsd: 0.06,
        },
      });

      const snapshot = observabilityFor(app).snapshot();
      expect(
        snapshot.histograms.find(
          (entry) =>
            entry.name === "ecorione_ecx_round_trip_duration_ms" &&
            entry.labels.response_mode === "delta" &&
            entry.labels.parent_target === "local" &&
            entry.labels.outcome === undefined,
        )?.count,
      ).toBe(1);
      expect(
        snapshot.counters.find(
          (entry) =>
            entry.name === "ecorione_ecx_round_trip_outcomes_total" &&
            entry.labels.response_mode === "delta" &&
            entry.labels.outcome === "success",
        )?.value,
      ).toBe(1);
      expect(
        snapshot.counters.find(
          (entry) =>
            entry.name === "ecorione_ecx_round_trip_outcomes_total" &&
            entry.labels.response_mode === "delta" &&
            entry.labels.outcome === "replay",
        )?.value,
      ).toBe(1);
      expect(
        snapshot.counters.find(
          (entry) => entry.name === "ecorione_ecx_execution_replays_total",
        )?.value,
      ).toBe(1);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("aggregates one child call for full without requiring parent model authority", async () => {
    const app = setup();
    await bind(app, "agent:b5-parent-full", "compose", "parentfull001");
    await bind(app, "agent:b5-child-full", "review", "childfull001");
    grantResultReceive("agent:b5-parent-full", "parentfull001");
    grantModel("agent:b5-child-full", "childfull001");
    const packet = await plan(app, {
      operationId: "op_b5full001",
      sender: "agent:b5-parent-full",
      recipient: "agent:b5-child-full",
      responseMode: "full",
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://connect.invalid")
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, completion("FULL_B5_FINAL", 13, 4, 0.015, 0.03));
    setGlobalDispatcher(mock);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload: roundTripPayload(packet),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        responseMode: "full",
        telemetry: {
          accountedModelCalls: 1,
          inputTokens: 13,
          outputTokens: 4,
          actualUsd: 0.015,
          naiveUsd: 0.03,
          refCandidateCount: 0,
          refSelectedCount: 0,
          refOmittedCount: 0,
          continuationLatencyMs: null,
        },
        handback: {
          parentContinued: false,
          finalSource: "recipient",
          finalReply: "FULL_B5_FINAL",
        },
      });
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("records owner reference-denial events and hydrate failure latency without claiming denied ref count", async () => {
    const app = setup();
    const artifactId = "art_" + "b".repeat(64);
    const packet = await plan(app, {
      operationId: "op_b5denied001",
      sender: "agent:b5-denial-parent",
      recipient: "agent:b5-denial-child",
      responseMode: "full",
      refs: [{ kind: "artifact", artifactId }],
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://artifact.invalid")
      .intercept({
        path:
          "/v1/artifacts/" +
          artifactId +
          "/content?scope=personal&maxSensitivity=INTERNAL&hostedEligible=0",
        method: "GET",
      })
      .reply(404, { error: { type: "NOT_FOUND", message: "denied fixture" } });
    setGlobalDispatcher(mock);

    try {
      const denied = await app.inject({
        method: "POST",
        url: "/v1/exchange/hydrate",
        payload: {
          packet,
          refIndexes: [0],
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: false,
        },
      });
      expect(denied.statusCode).toBe(404);
      const snapshot = observabilityFor(app).snapshot();
      expect(
        snapshot.counters.find(
          (entry) =>
            entry.name === "ecorione_ecx_reference_denial_events_total" &&
            entry.labels.phase === "hydration",
        )?.value,
      ).toBe(1);
      expect(
        snapshot.histograms.find(
          (entry) =>
            entry.name === "ecorione_ecx_hydration_duration_ms" &&
            entry.labels.outcome === "error" &&
            entry.labels.mode === "explicit",
        )?.count,
      ).toBe(1);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });
});
