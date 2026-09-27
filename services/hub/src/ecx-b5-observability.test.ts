import {
  CapabilityGrantRequestSchema,
  assertId,
} from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

const NOW = "2026-09-27T10:30:00.000Z";

function completion(
  reply: string,
  inputTokens: number,
  outputTokens: number,
  actualUsd: number,
) {
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
    usage: {
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    cost: {
      model: "local/provider-token-zero",
      naiveModel: "local/provider-token-zero",
      usage: {
        inputTokens,
        outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      baselineUsage: {
        inputTokens,
        outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      actualUsd,
      naiveUsd: actualUsd,
      savedUsd: 0,
      savedPct: 0,
      routeReason: "local-consolidation",
      policyVersion: "3",
      optimizerOverheadMs: 0,
    },
    routeReason: "local-consolidation",
  };
}

describe("ECX Batch 5 end-to-end observability/economics", () => {
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
        reason: "ECX Batch 5 model telemetry test.",
        idempotencyKey: "ecx-b5-model-" + suffix,
      }),
      NOW,
    );
  }

  function grantResult(agentId: string, suffix: string) {
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
        reason: "ECX Batch 5 result telemetry test.",
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
      task: string;
    },
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", input.operationId),
        requestedAt: NOW,
        sender: input.sender,
        intent: "b5-observability-quality-economics",
        task: input.task,
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        responseMode: input.responseMode,
        candidates: [
          { agentId: input.recipient, capabilities: ["review"], estimatedCost: 0 },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as { packets: unknown[] }).packets[0];
  }

  function counter(snapshot: unknown, name: string): number {
    const counters = (snapshot as { counters?: Array<{ name: string; value: number }> }).counters;
    return (counters ?? [])
      .filter((item) => item.name === name)
      .reduce((sum, item) => sum + item.value, 0);
  }

  function histogram(snapshot: unknown, name: string) {
    return (
      (snapshot as {
        histograms?: Array<{ name: string; count: number; min: number; max: number }>;
      }).histograms ?? []
    ).find((item) => item.name === name);
  }

  it("preserves full handback usage/cost and does not double-count economics on replay", async () => {
    const app = setup();
    await bind(app, "agent:b5-parent-full", "compose", "parentfull001");
    await bind(app, "agent:b5-child-full", "review", "childfull001");
    grantResult("agent:b5-parent-full", "parentfull001");
    grantModel("agent:b5-child-full", "childfull001");

    const packet = await plan(app, {
      operationId: "op_b5full001",
      sender: "agent:b5-parent-full",
      recipient: "agent:b5-child-full",
      responseMode: "full",
      task: "Return the measured full result.",
    });
    const payload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://connect.invalid")
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, completion('{"answer":"FULL_OK"}', 12, 4, 0.002));
    setGlobalDispatcher(mock);
    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        responseMode: "full",
        replayed: false,
        child: {
          completion: {
            usage: { inputTokens: 12, outputTokens: 4 },
            cost: { actualUsd: 0.002 },
          },
        },
      });

      const firstOps = await app.inject({ method: "GET", url: "/v1/ops/observability" });
      expect(firstOps.statusCode).toBe(200);
      const firstSnapshot = firstOps.json();
      expect(counter(firstSnapshot, "ecorione_ecx_round_trip_model_calls_total")).toBe(1);
      expect(counter(firstSnapshot, "ecorione_ecx_round_trip_input_tokens_total")).toBe(12);
      expect(counter(firstSnapshot, "ecorione_ecx_round_trip_output_tokens_total")).toBe(4);
      expect(counter(firstSnapshot, "ecorione_ecx_round_trip_actual_cost_usd_total")).toBeCloseTo(
        0.002,
        12,
      );
      expect(counter(firstSnapshot, "ecorione_ecx_round_trip_returned_bytes_total")).toBeGreaterThan(
        0,
      );
      expect(histogram(firstSnapshot, "ecorione_ecx_round_trip_duration_ms")?.count).toBe(1);

      const replay = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toMatchObject({ replayed: true });

      const replayOps = await app.inject({ method: "GET", url: "/v1/ops/observability" });
      const replaySnapshot = replayOps.json();
      expect(counter(replaySnapshot, "ecorione_ecx_round_trip_model_calls_total")).toBe(1);
      expect(counter(replaySnapshot, "ecorione_ecx_round_trip_input_tokens_total")).toBe(12);
      expect(counter(replaySnapshot, "ecorione_ecx_round_trip_actual_cost_usd_total")).toBeCloseTo(
        0.002,
        12,
      );
      expect(counter(replaySnapshot, "ecorione_ecx_round_trip_replays_total")).toBe(1);
      expect(histogram(replaySnapshot, "ecorione_ecx_round_trip_duration_ms")?.count).toBe(2);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("aggregates delta child + parent actual economics exactly once", async () => {
    const app = setup();
    await bind(app, "agent:b5-parent-delta", "compose", "parentdelta001");
    await bind(app, "agent:b5-child-delta", "review", "childdelta001");
    grantResult("agent:b5-parent-delta", "parentdelta001");
    grantModel("agent:b5-parent-delta", "parentdelta001");
    grantModel("agent:b5-child-delta", "childdelta001");

    const packet = await plan(app, {
      operationId: "op_b5delta001",
      sender: "agent:b5-parent-delta",
      recipient: "agent:b5-child-delta",
      responseMode: "delta",
      task: "Integrate the measured delegated result.",
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    connect
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, completion('{"evidence":"CHILD"}', 12, 4, 0.002));
    connect
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, completion('{"answer":"DELTA_OK"}', 8, 3, 0.003));
    setGlobalDispatcher(mock);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload: {
          packet,
          workspaceId: "ws_personal",
          scope: "personal",
          maxSensitivity: "INTERNAL",
          requestedAt: NOW,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        responseMode: "delta",
        handback: {
          parentContinued: true,
          parentCompletion: {
            usage: { inputTokens: 8, outputTokens: 3 },
            cost: { actualUsd: 0.003 },
          },
        },
      });

      const ops = await app.inject({ method: "GET", url: "/v1/ops/observability" });
      const snapshot = ops.json();
      expect(counter(snapshot, "ecorione_ecx_round_trip_model_calls_total")).toBe(2);
      expect(counter(snapshot, "ecorione_ecx_round_trip_input_tokens_total")).toBe(20);
      expect(counter(snapshot, "ecorione_ecx_round_trip_output_tokens_total")).toBe(7);
      expect(counter(snapshot, "ecorione_ecx_round_trip_actual_cost_usd_total")).toBeCloseTo(
        0.005,
        12,
      );
      expect(counter(snapshot, "ecorione_ecx_round_trips_total")).toBe(1);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });
});
