import { CapabilityGrantRequestSchema, assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { buildHubServer } from "./http.js";

const NOW = "2026-09-27T16:30:00.000Z";

function localCompletion(reply: string) {
  return {
    reply,
    provider: "local",
    model: "qwen-test",
    pricingModel: "local/provider-token-zero",
    responseModel: "qwen-test",
    modelIdentity: "local:test:qwen-test",
    modelIdentityPinned: true,
    modelIdentityProvenance: "provider-verified",
    cacheHit: false,
    usage: {
      inputTokens: 10,
      outputTokens: 3,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    cost: {
      model: "local/provider-token-zero",
      actualUsd: 0,
      naiveUsd: 0,
      savedUsd: 0,
      savedPct: 0,
      routeReason: "local-consolidation",
      policyVersion: "3",
      optimizerOverheadMs: 0,
    },
    routeReason: "local-consolidation",
  };
}

describe("ECX Batch 7 fan-out round trip", () => {
  let db: HubDatabase | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  function setup() {
    db = openHubDatabase(":memory:");
    const ledger = new HistoryLedger(db);
    const app = buildHubServer(db, {
      contextUrl: "http://context.invalid",
      connectUrl: "http://connect.invalid",
      rndUrl: "http://rnd.invalid",
      artifactUrl: "http://artifact.invalid",
    });
    return { ledger, app };
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
        operationId: assertId("operation", "op_b7bind" + suffix),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: [capability],
        systemPrompt: "Bounded " + agentId + " system prompt.",
        enabled: true,
      },
    });
    expect(response.statusCode).toBe(200);
  }

  function grantLocal(agentId: string, suffix: string) {
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_b7grant" + suffix),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: agentId },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 7 focused fan-out test.",
        idempotencyKey: "ecx-b7-grant-" + suffix,
      }),
      NOW,
    );
  }

  function grantResultReceive(agentId: string, suffix: string) {
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_b7result" + suffix),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: agentId },
        capabilityId: "agent.result.receive",
        permissionIds: ["agent.result.receive"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 7 result aggregation grant.",
        idempotencyKey: "ecx-b7-result-" + suffix,
      }),
      NOW,
    );
  }

  function createSession(ledger: HistoryLedger, sessionId: string) {
    ledger.createSession({
      id: assertId("session", sessionId),
      createdAt: NOW,
      workspaceId: assertId("workspace", "ws_personal"),
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "CLOUD_ALLOWED",
    });
  }

  async function plan(
    app: ReturnType<typeof buildHubServer>,
    input: {
      sessionId: string;
      operationId: string;
      sender: string;
      recipients: readonly string[];
      responseMode?: "delta" | "full";
    },
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", input.operationId),
        requestedAt: NOW,
        sender: input.sender,
        intent: "fanout-review",
        task: "Review the change from your specialty and return a concise contribution.",
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        responseMode: input.responseMode ?? "delta",
        candidates: input.recipients.map((agentId, index) => ({
          agentId,
          capabilities: ["review"],
          estimatedCost: index,
        })),
        maxRecipients: input.recipients.length,
        historySessionId: input.sessionId,
      },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { packets: unknown[] };
  }

  it("executes two children, aggregates once, and replays without redispatch", async () => {
    const { ledger, app } = setup();
    const sessionId = "sess_b7fanout001";
    createSession(ledger, sessionId);

    await bind(app, "agent:parent-b7", "compose", "parent001");
    await bind(app, "agent:child-a-b7", "review", "childa001");
    await bind(app, "agent:child-b-b7", "review", "childb001");
    grantLocal("agent:parent-b7", "parent001");
    grantResultReceive("agent:parent-b7", "parent001");
    grantLocal("agent:child-a-b7", "childa001");
    grantLocal("agent:child-b-b7", "childb001");

    const planned = await plan(app, {
      sessionId,
      operationId: "op_b7fanout001",
      sender: "agent:parent-b7",
      recipients: ["agent:child-a-b7", "agent:child-b-b7"],
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    let calls = 0;
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, (opts) => {
      calls += 1;
      const body = JSON.parse(String(opts.body)) as {
        prefix: { systemPrompt: string };
        userMessage: string;
      };
      expect(body.prefix.systemPrompt).toContain("delegated contribution");
      expect(body.userMessage).toContain("Review the change");
      return localCompletion("CHILD_A_DELTA");
    });
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, (opts) => {
      calls += 1;
      const body = JSON.parse(String(opts.body)) as {
        prefix: { systemPrompt: string };
        userMessage: string;
      };
      expect(body.prefix.systemPrompt).toContain("delegated contribution");
      expect(body.userMessage).toContain("Review the change");
      return localCompletion("CHILD_B_DELTA");
    });
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, (opts) => {
      calls += 1;
      const body = JSON.parse(String(opts.body)) as {
        prefix: { systemPrompt: string };
        dynamicText: string;
      };
      expect(body.prefix.systemPrompt).toContain("synthesize all delegated deltas");
      expect(body.dynamicText).toContain("<untrusted_ecx_fanout_return>");
      expect(body.dynamicText).toContain("CHILD_A_DELTA");
      expect(body.dynamicText).toContain("CHILD_B_DELTA");
      return localCompletion("PARENT_AGGREGATED");
    });
    setGlobalDispatcher(mock);

    const payload = {
      packets: planned.packets,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };

    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/fanout-round-trip",
        payload,
      });
      expect(first.statusCode).toBe(200);
      const firstBody = first.json() as {
        fanoutId: string;
        replayed: boolean;
        recipients: string[];
        children: Array<{ recipient: string; completion: { reply: string } }>;
        aggregateEvidence: { replyBytes: number; resultSetSha256: string };
        handback: { finalReply: string; parentContinued: boolean };
      };
      expect(firstBody.replayed).toBe(false);
      expect(firstBody.recipients).toEqual(["agent:child-a-b7", "agent:child-b-b7"]);
      expect(firstBody.children.map((child) => child.recipient)).toEqual(firstBody.recipients);
      expect(firstBody.children.map((child) => child.completion.reply)).toEqual([
        "CHILD_A_DELTA",
        "CHILD_B_DELTA",
      ]);
      expect(firstBody.handback).toMatchObject({
        finalReply: "PARENT_AGGREGATED",
        parentContinued: true,
      });
      expect(firstBody.aggregateEvidence.replyBytes).toBe(
        Buffer.byteLength("CHILD_A_DELTA") + Buffer.byteLength("CHILD_B_DELTA"),
      );
      expect(firstBody.aggregateEvidence.resultSetSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(calls).toBe(3);

      const status = await app.inject({
        method: "GET",
        url:
          "/v1/exchange/fanouts/" +
          encodeURIComponent(firstBody.fanoutId) +
          "?workspaceId=ws_personal",
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        fanoutId: firstBody.fanoutId,
        state: "SUCCEEDED",
        resultAvailable: true,
        recipients: firstBody.recipients,
      });

      const replay = await app.inject({
        method: "POST",
        url: "/v1/exchange/fanout-round-trip",
        payload,
      });
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toMatchObject({
        fanoutId: firstBody.fanoutId,
        replayed: true,
        handback: { finalReply: "PARENT_AGGREGATED" },
      });
      expect(calls).toBe(3);

      const range = ledger.readRange({
        sessionId: assertId("session", sessionId),
        afterSeq: -1,
        limit: 30,
        grant: {
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: true,
        },
      });
      const eventTypes = range.events.map((event) => event.eventType);
      expect(eventTypes.slice(0, 2)).toEqual(["agent.handoff", "agent.handoff"]);
      expect(eventTypes.filter((type) => type === "agent.execution.started")).toHaveLength(2);
      expect(eventTypes.filter((type) => type === "agent.execution.succeeded")).toHaveLength(2);
      expect(eventTypes.filter((type) => type === "agent.result.returned")).toHaveLength(1);
      expect(eventTypes.filter((type) => type === "agent.continuation.started")).toHaveLength(
        1,
      );
      expect(eventTypes.filter((type) => type === "agent.continuation.succeeded")).toHaveLength(
        1,
      );

      const returned = range.events.find(
        (event) => event.eventType === "agent.result.returned",
      );
      expect(returned?.payload).toMatchObject({
        fanoutId: firstBody.fanoutId,
        recipients: ["agent:child-a-b7", "agent:child-b-b7"],
        aggregateEvidence: firstBody.aggregateEvidence,
      });
      expect(JSON.stringify(returned?.payload)).not.toContain("CHILD_A_DELTA");
      expect(JSON.stringify(returned?.payload)).not.toContain("CHILD_B_DELTA");
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("fails closed when one child fails and never dispatches the parent aggregation", async () => {
    const { ledger, app } = setup();
    const sessionId = "sess_b7fanout002";
    createSession(ledger, sessionId);

    await bind(app, "agent:parent-fail-b7", "compose", "parent002");
    await bind(app, "agent:child-ok-b7", "review", "childok002");
    await bind(app, "agent:child-fail-b7", "review", "childfail002");
    grantLocal("agent:parent-fail-b7", "parent002");
    grantResultReceive("agent:parent-fail-b7", "parent002");
    grantLocal("agent:child-ok-b7", "childok002");
    grantLocal("agent:child-fail-b7", "childfail002");

    const planned = await plan(app, {
      sessionId,
      operationId: "op_b7fanout002",
      sender: "agent:parent-fail-b7",
      recipients: ["agent:child-ok-b7", "agent:child-fail-b7"],
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    let calls = 0;
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, () => {
      calls += 1;
      return localCompletion("CHILD_OK");
    });
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(400, () => {
      calls += 1;
      return { error: "bounded child rejection" };
    });
    setGlobalDispatcher(mock);

    const payload = {
      packets: planned.packets,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };

    try {
      const failed = await app.inject({
        method: "POST",
        url: "/v1/exchange/fanout-round-trip",
        payload,
      });
      expect(failed.statusCode).toBe(400);
      expect(failed.body).toContain("ECX_EXECUTION_FAILED");
      expect(calls).toBe(2);

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/fanout-round-trip",
        payload,
      });
      expect(retry.statusCode).toBe(409);
      expect(retry.body).toContain("ECX_FANOUT_FAILED");
      expect(calls).toBe(2);

      const range = ledger.readRange({
        sessionId: assertId("session", sessionId),
        afterSeq: -1,
        limit: 30,
        grant: {
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: true,
        },
      });
      expect(
        range.events.some((event) => event.eventType === "agent.continuation.started"),
      ).toBe(false);
      expect(range.events.some((event) => event.eventType === "agent.result.returned")).toBe(
        false,
      );
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("rejects non-delta fan-out before any child dispatch", async () => {
    const { ledger, app } = setup();
    const sessionId = "sess_b7fanout003";
    createSession(ledger, sessionId);

    const planned = await plan(app, {
      sessionId,
      operationId: "op_b7fanout003",
      sender: "agent:parent-full-b7",
      recipients: ["agent:child-full-a-b7", "agent:child-full-b-b7"],
      responseMode: "full",
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/exchange/fanout-round-trip",
      payload: {
        packets: planned.packets,
        workspaceId: "ws_personal",
        scope: "personal",
        maxSensitivity: "INTERNAL",
        requestedAt: NOW,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Batch 7 fan-out hanya menerima responseMode delta");
  });
});
