import { CapabilityGrantRequestSchema, assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { buildHubServer } from "./http.js";

const NOW = "2026-09-27T07:30:00.000Z";

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

describe("ECX Batch 3 round trip", () => {
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
        operationId: assertId("operation", "op_b3bind" + suffix),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: [capability],
        systemPrompt: "Bounded " + agentId + " system prompt.",
        enabled: true,
      },
    });
    expect(response.statusCode).toBe(200);
  }

  function grant(agentId: string, suffix: string) {
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_b3grant" + suffix),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: agentId },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 3 focused round-trip test.",
        idempotencyKey: "ecx-b3-grant-" + suffix,
      }),
      NOW,
    );
  }

  function createSession(ledger: HistoryLedger, sessionId: string) {
    ledger.createSession({
      id: assertId("session", sessionId),
      createdAt: NOW,
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
        intent: "round-trip-review",
        task: input.task,
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        responseMode: input.responseMode,
        candidates: [
          {
            agentId: input.recipient,
            capabilities: ["review"],
            estimatedCost: 0,
          },
        ],
        historySessionId: input.sessionId,
      },
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as { packets: unknown[] }).packets[0];
  }

  it("runs delta as child then parent continuation and replays without redispatch", async () => {
    const { ledger, app } = setup();
    const sessionId = "sess_b3delta001";
    createSession(ledger, sessionId);
    await bind(app, "agent:parent-delta", "compose", "parentdelta001");
    await bind(app, "agent:child-delta", "review", "childdelta001");
    grant("agent:parent-delta", "parentdelta001");
    grant("agent:child-delta", "childdelta001");
    const packet = await plan(app, {
      sessionId,
      operationId: "op_b3delta001",
      sender: "agent:parent-delta",
      recipient: "agent:child-delta",
      responseMode: "delta",
      task: "Review the change and produce the final parent answer.",
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, (opts) => {
      const body = JSON.parse(String(opts.body)) as {
        prefix: { systemPrompt: string };
        userMessage: string;
      };
      expect(body.prefix.systemPrompt).toContain(
        "Return only the concise delegated contribution",
      );
      expect(body.userMessage).toContain("Review the change");
      return localCompletion("CHILD_DELTA");
    });
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, (opts) => {
      const body = JSON.parse(String(opts.body)) as {
        operationId: string;
        prefix: { systemPrompt: string };
        dynamicText: string;
      };
      expect(body.operationId).toMatch(/^op_/);
      expect(body.prefix.systemPrompt).toContain("Continue as the sender/parent agent");
      expect(body.dynamicText).toContain("<untrusted_ecx_return>");
      expect(body.dynamicText).toContain("CHILD_DELTA");
      return localCompletion("PARENT_FINAL");
    });
    setGlobalDispatcher(mock);

    const payload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        responseMode: "delta",
        state: "SUCCEEDED",
        replayed: false,
        child: { completion: { reply: "CHILD_DELTA" } },
        handback: {
          parentContinued: true,
          parentTarget: "local",
          finalSource: "sender",
          finalReply: "PARENT_FINAL",
          parentCompletion: { reply: "PARENT_FINAL" },
        },
      });

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toMatchObject({
        replayed: true,
        handback: { finalReply: "PARENT_FINAL" },
      });

      const packetId = (first.json() as { packetId: string }).packetId;
      const status = await app.inject({
        method: "GET",
        url: "/v1/exchange/round-trips/" + packetId + "?workspaceId=ws_personal",
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        state: "SUCCEEDED",
        responseMode: "delta",
        resultAvailable: true,
      });
      const wrongWorkspace = await app.inject({
        method: "GET",
        url: "/v1/exchange/round-trips/" + packetId + "?workspaceId=ws_other",
      });
      expect(wrongWorkspace.statusCode).toBe(404);

      const range = ledger.readRange({
        sessionId: assertId("session", sessionId),
        afterSeq: -1,
        limit: 20,
        grant: {
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: false,
        },
      });
      expect(range.events.map((event) => event.eventType)).toEqual([
        "agent.handoff",
        "agent.execution.started",
        "agent.execution.succeeded",
        "agent.result.returned",
        "agent.continuation.started",
        "agent.continuation.succeeded",
      ]);
      expect(ledger.getSession(assertId("session", sessionId))?.nextSeq).toBe(6);
      expect(JSON.stringify(range.events[3]?.payload)).not.toContain("CHILD_DELTA");
      expect(JSON.stringify(range.events[5]?.payload)).not.toContain("PARENT_FINAL");
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("runs full with one child call and hands the standalone child answer back directly", async () => {
    const { ledger, app } = setup();
    const sessionId = "sess_b3full001";
    createSession(ledger, sessionId);
    await bind(app, "agent:parent-full", "compose", "parentfull001");
    await bind(app, "agent:child-full", "review", "childfull001");
    grant("agent:child-full", "childfull001");
    const packet = await plan(app, {
      sessionId,
      operationId: "op_b3full001",
      sender: "agent:parent-full",
      recipient: "agent:child-full",
      responseMode: "full",
      task: "Return a standalone review.",
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://connect.invalid")
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, (opts) => {
        const body = JSON.parse(String(opts.body)) as {
          prefix: { systemPrompt: string };
        };
        expect(body.prefix.systemPrompt).toContain("Return a standalone complete answer");
        return localCompletion("CHILD_FULL_FINAL");
      });
    setGlobalDispatcher(mock);
    const payload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };
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
        handback: {
          parentContinued: false,
          finalSource: "recipient",
          finalReply: "CHILD_FULL_FINAL",
          parentCompletion: null,
        },
      });
      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toMatchObject({ replayed: true });

      const range = ledger.readRange({
        sessionId: assertId("session", sessionId),
        afterSeq: -1,
        limit: 20,
        grant: {
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: false,
        },
      });
      expect(range.events.map((event) => event.eventType)).toEqual([
        "agent.handoff",
        "agent.execution.started",
        "agent.execution.succeeded",
        "agent.result.returned",
      ]);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("marks ambiguous parent continuation UNCERTAIN and blocks automatic redispatch", async () => {
    const { ledger, app } = setup();
    const sessionId = "sess_b3uncertain001";
    createSession(ledger, sessionId);
    await bind(app, "agent:parent-uncertain", "compose", "parentuncertain001");
    await bind(app, "agent:child-uncertain", "review", "childuncertain001");
    grant("agent:parent-uncertain", "parentuncertain001");
    grant("agent:child-uncertain", "childuncertain001");
    const packet = await plan(app, {
      sessionId,
      operationId: "op_b3uncertain001",
      sender: "agent:parent-uncertain",
      recipient: "agent:child-uncertain",
      responseMode: "delta",
      task: "Trigger an ambiguous parent failure.",
    });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    connect
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, localCompletion("CHILD_OK"));
    connect
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(503, { error: { type: "UPSTREAM", message: "ambiguous parent" } });
    setGlobalDispatcher(mock);
    const payload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(first.statusCode).toBe(502);
      expect(first.body).toContain("ECX_ROUND_TRIP_UNCERTAIN");

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/round-trip",
        payload,
      });
      expect(retry.statusCode).toBe(409);
      expect(retry.body).toContain("ECX_ROUND_TRIP_UNCERTAIN");

      const packetId = (packet as { packetId: string }).packetId;
      const status = await app.inject({
        method: "GET",
        url: "/v1/exchange/round-trips/" + packetId + "?workspaceId=ws_personal",
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        state: "UNCERTAIN",
        resultAvailable: false,
      });

      const range = ledger.readRange({
        sessionId: assertId("session", sessionId),
        afterSeq: -1,
        limit: 20,
        grant: {
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: false,
        },
      });
      expect(range.events.map((event) => event.eventType)).toEqual([
        "agent.handoff",
        "agent.execution.started",
        "agent.execution.succeeded",
        "agent.result.returned",
        "agent.continuation.started",
        "agent.continuation.uncertain",
      ]);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });
});
