import { CapabilityGrantRequestSchema, assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { buildHubServer } from "./http.js";

const NOW = "2026-09-09T00:00:00.000Z";

describe("ECX HTTP integration", () => {
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

  it("commits multi-recipient plan provenance atomically and retries idempotently", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxhttp001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "CLOUD_ALLOWED",
    });
    const payload = {
      operationId: assertId("operation", "op_ecxhttp001"),
      requestedAt: NOW,
      sender: "agent:planner",
      intent: "review",
      task: "Review the proposed change.",
      need: ["security"],
      refs: [],
      budget: { maxHydratedBytes: 4096 },
      responseMode: "delta",
      candidates: [
        { agentId: "agent:reviewer-a", capabilities: ["security"], estimatedCost: 1 },
        { agentId: "agent:reviewer-b", capabilities: ["security"], estimatedCost: 2 },
      ],
      maxRecipients: 2,
      historySessionId: sessionId,
    };

    const first = await app.inject({ method: "POST", url: "/v1/exchange/plan", payload });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as {
      packets: Array<{ packetId: string; recipient: string }>;
    };
    expect(firstBody.packets).toHaveLength(2);
    expect(firstBody.packets.map((packet) => packet.recipient)).toEqual([
      "agent:reviewer-a",
      "agent:reviewer-b",
    ]);

    const range = ledger.readRange({
      sessionId,
      afterSeq: -1,
      limit: 10,
      grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: true },
    });
    expect(range.events.map((event) => event.eventType)).toEqual([
      "agent.handoff",
      "agent.handoff",
    ]);
    expect(range.events.map((event) => event.seq)).toEqual([0, 1]);

    const retry = await app.inject({ method: "POST", url: "/v1/exchange/plan", payload });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
    expect(ledger.getSession(sessionId)?.nextSeq).toBe(2);
  });

  it("executes a bound local recipient only after explicit agent authority grant", async () => {
    const { app } = setup();
    const binding = await app.inject({
      method: "PUT",
      url: "/v1/exchange/agents/agent:reviewer",
      payload: {
        operationId: assertId("operation", "op_ecxbinding001"),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: ["review"],
        systemPrompt: "You are the bounded ECX review recipient.",
        enabled: true,
      },
    });
    expect(binding.statusCode).toBe(200);
    expect(binding.json()).toMatchObject({
      agentId: "agent:reviewer",
      target: "local",
      enabled: true,
    });

    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxexecute001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "Reply exactly ECX_EXECUTION_OK.",
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        candidates: [{ agentId: "agent:reviewer", capabilities: ["review"], estimatedCost: 0 }],
      },
    });
    expect(plan.statusCode).toBe(200);
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const denied = await app.inject({
      method: "POST",
      url: "/v1/exchange/execute",
      payload: {
        packet,
        workspaceId: "ws_personal",
        scope: "personal",
        maxSensitivity: "INTERNAL",
        requestedAt: NOW,
      },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.body).toContain("ECX_RECIPIENT_AUTHORITY_DENIED");

    const authority = new CapabilityRegistry(db!);
    authority.grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_ecxgrant001"),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: "agent:reviewer" },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "Focused ECX recipient execution test.",
        idempotencyKey: "ecx-agent-reviewer-local-grant",
      }),
      NOW,
    );

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    const connect = mock.get("http://connect.invalid");
    connect.intercept({ path: "/v1/complete", method: "POST" }).reply(200, {
      reply: "ECX_EXECUTION_OK",
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
        operationId: "op_ecxexecute001",
      },
      routeReason: "local-consolidation",
    });
    setGlobalDispatcher(mock);
    try {
      const executed = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: {
          packet,
          workspaceId: "ws_personal",
          scope: "personal",
          maxSensitivity: "INTERNAL",
          requestedAt: NOW,
        },
      });
      expect(executed.statusCode).toBe(200);
      expect(executed.json()).toMatchObject({
        recipient: "agent:reviewer",
        target: "local",
        hydratedBytes: 0,
        selectedRefIndexes: [],
        completion: {
          reply: "ECX_EXECUTION_OK",
          provider: "local",
          routeReason: "local-consolidation",
        },
      });
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("replays a successful execution without a second provider call and preserves Ledger lifecycle", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxidemsuccess001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "CLOUD_ALLOWED",
    });

    const binding = await app.inject({
      method: "PUT",
      url: "/v1/exchange/agents/agent:idem-reviewer",
      payload: {
        operationId: assertId("operation", "op_ecxidembinding001"),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: ["review"],
        systemPrompt: "Execute the bounded ECX review.",
        enabled: true,
      },
    });
    expect(binding.statusCode).toBe(200);

    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_ecxidemgrant001"),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: "agent:idem-reviewer" },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 2 success replay test.",
        idempotencyKey: "ecx-b2-success-grant",
      }),
      NOW,
    );

    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxidemsuccess001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "Reply exactly ECX_IDEMPOTENT_OK.",
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        candidates: [
          { agentId: "agent:idem-reviewer", capabilities: ["review"], estimatedCost: 0 },
        ],
        historySessionId: sessionId,
      },
    });
    expect(plan.statusCode).toBe(200);
    const packet = (plan.json() as { packets: unknown[] }).packets[0];
    expect(packet).toMatchObject({ historySessionId: sessionId });

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://connect.invalid")
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(200, {
        reply: "ECX_IDEMPOTENT_OK",
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
          operationId: "op_ecxidemsuccess001",
        },
        routeReason: "local-consolidation",
      });
    setGlobalDispatcher(mock);
    const executePayload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: executePayload,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        state: "SUCCEEDED",
        replayed: false,
        recipient: "agent:idem-reviewer",
        history: {
          startedEventId: expect.stringMatching(/^evt_/),
          outcomeEventId: expect.stringMatching(/^evt_/),
        },
        completion: { reply: "ECX_IDEMPOTENT_OK" },
      });

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: executePayload,
      });
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toMatchObject({
        state: "SUCCEEDED",
        replayed: true,
        completion: { reply: "ECX_IDEMPOTENT_OK" },
      });

      const packetId = (first.json() as { packetId: string }).packetId;
      const status = await app.inject({
        method: "GET",
        url: `/v1/exchange/executions/${packetId}?workspaceId=ws_personal`,
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        packetId,
        state: "SUCCEEDED",
        resultAvailable: true,
        historySessionId: sessionId,
      });

      const wrongWorkspace = await app.inject({
        method: "GET",
        url: `/v1/exchange/executions/${packetId}?workspaceId=ws_other`,
      });
      expect(wrongWorkspace.statusCode).toBe(400);

      const range = ledger.readRange({
        sessionId,
        afterSeq: -1,
        limit: 10,
        grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: false },
      });
      expect(range.events.map((event) => event.eventType)).toEqual([
        "agent.handoff",
        "agent.execution.started",
        "agent.execution.succeeded",
      ]);
      expect(ledger.getSession(sessionId)?.nextSeq).toBe(3);

      const mutated = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: { ...executePayload, requestedAt: "2026-09-09T00:00:01.000Z" },
      });
      expect(mutated.statusCode).toBe(409);
      expect(mutated.body).toContain("ECX_EXECUTION_CONFLICT");
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("marks a definitive Connect 4xx as FAILED and blocks automatic redispatch", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxidemfailed001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "CLOUD_ALLOWED",
    });

    await app.inject({
      method: "PUT",
      url: "/v1/exchange/agents/agent:failed-reviewer",
      payload: {
        operationId: assertId("operation", "op_ecxfailedbinding001"),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: ["review"],
        systemPrompt: "Execute the bounded ECX review.",
        enabled: true,
      },
    });
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_ecxfailedgrant001"),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: "agent:failed-reviewer" },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 2 failed-state test.",
        idempotencyKey: "ecx-b2-failed-grant",
      }),
      NOW,
    );
    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxidemfailed001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "This request will be rejected.",
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        candidates: [
          { agentId: "agent:failed-reviewer", capabilities: ["review"], estimatedCost: 0 },
        ],
        historySessionId: sessionId,
      },
    });
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://connect.invalid")
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(400, { error: { type: "BAD_REQUEST", message: "definitive reject" } });
    setGlobalDispatcher(mock);
    const executePayload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: executePayload,
      });
      expect(first.statusCode).toBe(400);
      expect(first.body).toContain("ECX_EXECUTION_FAILED");

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: executePayload,
      });
      expect(retry.statusCode).toBe(409);
      expect(retry.body).toContain("ECX_EXECUTION_FAILED");

      const packetId = (packet as { packetId: string }).packetId;
      const status = await app.inject({
        method: "GET",
        url: `/v1/exchange/executions/${packetId}?workspaceId=ws_personal`,
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        state: "FAILED",
        resultAvailable: false,
      });

      const range = ledger.readRange({
        sessionId,
        afterSeq: -1,
        limit: 10,
        grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: false },
      });
      expect(range.events.map((event) => event.eventType)).toEqual([
        "agent.handoff",
        "agent.execution.started",
        "agent.execution.failed",
      ]);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("marks an ambiguous Connect 5xx as UNCERTAIN and blocks automatic redispatch", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxidemuncertain001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "CLOUD_ALLOWED",
    });

    await app.inject({
      method: "PUT",
      url: "/v1/exchange/agents/agent:uncertain-reviewer",
      payload: {
        operationId: assertId("operation", "op_ecxuncertainbinding001"),
        workspaceId: "ws_personal",
        target: "local",
        capabilities: ["review"],
        systemPrompt: "Execute the bounded ECX review.",
        enabled: true,
      },
    });
    new CapabilityRegistry(db!).grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_ecxuncertaingrant001"),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: "agent:uncertain-reviewer" },
        capabilityId: "model.invoke.local",
        permissionIds: ["model.invoke", "execution.local"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "ECX Batch 2 uncertain-state test.",
        idempotencyKey: "ecx-b2-uncertain-grant",
      }),
      NOW,
    );
    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxidemuncertain001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "This request will become ambiguous.",
        need: ["review"],
        refs: [],
        budget: { maxHydratedBytes: 4096 },
        candidates: [
          {
            agentId: "agent:uncertain-reviewer",
            capabilities: ["review"],
            estimatedCost: 0,
          },
        ],
        historySessionId: sessionId,
      },
    });
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const original = getGlobalDispatcher();
    const mock = new MockAgent();
    mock.disableNetConnect();
    mock
      .get("http://connect.invalid")
      .intercept({ path: "/v1/complete", method: "POST" })
      .reply(503, { error: { type: "PROVIDER_UNREACHABLE", message: "ambiguous upstream" } });
    setGlobalDispatcher(mock);
    const executePayload = {
      packet,
      workspaceId: "ws_personal",
      scope: "personal",
      maxSensitivity: "INTERNAL",
      requestedAt: NOW,
    };
    try {
      const first = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: executePayload,
      });
      expect(first.statusCode).toBe(502);
      expect(first.body).toContain("ECX_EXECUTION_UNCERTAIN");

      const retry = await app.inject({
        method: "POST",
        url: "/v1/exchange/execute",
        payload: executePayload,
      });
      expect(retry.statusCode).toBe(409);
      expect(retry.body).toContain("ECX_EXECUTION_UNCERTAIN");

      const packetId = (packet as { packetId: string }).packetId;
      const status = await app.inject({
        method: "GET",
        url: `/v1/exchange/executions/${packetId}?workspaceId=ws_personal`,
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        state: "UNCERTAIN",
        resultAvailable: false,
      });

      const range = ledger.readRange({
        sessionId,
        afterSeq: -1,
        limit: 10,
        grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: false },
      });
      expect(range.events.map((event) => event.eventType)).toEqual([
        "agent.handoff",
        "agent.execution.started",
        "agent.execution.uncertain",
      ]);
    } finally {
      setGlobalDispatcher(original);
      await mock.close();
    }
  });

  it("derives hosted eligibility from the recipient binding and rejects LOCAL_ONLY refs", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxexecutelocal001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    });
    ledger.append(sessionId, 0, {
      id: assertId("event", "evt_ecxexecutelocal001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "LOCAL_ONLY secret context" },
    });

    const binding = await app.inject({
      method: "PUT",
      url: "/v1/exchange/agents/agent:hosted-reviewer",
      payload: {
        operationId: assertId("operation", "op_ecxbindinghosted001"),
        workspaceId: "ws_personal",
        target: "hosted",
        capabilities: ["review"],
        systemPrompt: "You are the hosted ECX review recipient.",
        enabled: true,
      },
    });
    expect(binding.statusCode).toBe(200);

    const authority = new CapabilityRegistry(db!);
    authority.grant(
      CapabilityGrantRequestSchema.parse({
        operationId: assertId("operation", "op_ecxgranthosted001"),
        workspaceId: "ws_personal",
        subject: { kind: "agent", id: "agent:hosted-reviewer" },
        capabilityId: "model.invoke.hosted",
        permissionIds: ["model.invoke", "network.connect", "provider.spend"],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        autonomy: "L1",
        reason: "Focused hosted ECX recipient test.",
        idempotencyKey: "ecx-agent-hosted-reviewer-grant",
      }),
      NOW,
    );

    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxexecutehosted001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "Review local-only context.",
        need: ["review"],
        refs: [{ kind: "history", sessionId, afterSeq: -1, throughSeq: 0 }],
        budget: { maxHydratedBytes: 4096 },
        candidates: [
          {
            agentId: "agent:hosted-reviewer",
            capabilities: ["review"],
            estimatedCost: 1,
          },
        ],
      },
    });
    expect(plan.statusCode).toBe(200);
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const executed = await app.inject({
      method: "POST",
      url: "/v1/exchange/execute",
      payload: {
        packet,
        workspaceId: "ws_personal",
        selection: { mode: "semantic-v1", maxRefs: 1 },
        scope: "personal",
        maxSensitivity: "INTERNAL",
        requestedAt: NOW,
      },
    });
    expect(executed.statusCode).toBe(404);
    expect(executed.body).toContain("History reference tidak tersedia");
  });

  it("automatically selects a relevant history reference before hydration", async () => {
    const { ledger, app } = setup();
    const legacySessionId = assertId("session", "sess_ecxselectorlegacy001");
    const currentSessionId = assertId("session", "sess_ecxselectorcurrent001");

    for (const sessionId of [legacySessionId, currentSessionId]) {
      ledger.createSession({
        id: sessionId,
        createdAt: NOW,
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "CLOUD_ALLOWED",
      });
    }
    ledger.append(legacySessionId, 0, {
      id: assertId("event", "evt_ecxselectorlegacy001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: {
        text: "Archived legacy training notes describe unrelated closed incidents.",
      },
    });
    ledger.append(currentSessionId, 0, {
      id: assertId("event", "evt_ecxselectorcurrent001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: {
        text: "CURRENT INCIDENT. Incident ID INC-7421. Current severity SEV-2.",
      },
    });

    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxselector001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "incident-review",
        task: "Return the incidentId and severity from the current incident record.",
        need: ["incident", "verification"],
        refs: [
          {
            kind: "history",
            sessionId: legacySessionId,
            afterSeq: -1,
            throughSeq: 0,
          },
          {
            kind: "history",
            sessionId: currentSessionId,
            afterSeq: -1,
            throughSeq: 0,
          },
        ],
        budget: { maxHydratedBytes: 4096 },
        candidates: [
          {
            agentId: "agent:reviewer",
            capabilities: ["incident", "verification"],
            estimatedCost: 1,
          },
        ],
      },
    });
    expect(plan.statusCode).toBe(200);
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const hydrated = await app.inject({
      method: "POST",
      url: "/v1/exchange/hydrate",
      payload: {
        packet,
        selection: { mode: "semantic-v1", maxRefs: 1 },
        scope: "personal",
        maxSensitivity: "INTERNAL",
        hostedEligible: false,
      },
    });
    expect(hydrated.statusCode).toBe(200);
    const body = hydrated.json() as {
      items: Array<{ index: number; contentBase64: string }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.index).toBe(1);
    expect(Buffer.from(body.items[0]!.contentBase64, "base64").toString("utf8")).toContain(
      "INC-7421",
    );
  });

  it("fails closed when hosted hydration points at LOCAL_ONLY history", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxlocal001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    });
    ledger.append(sessionId, 0, {
      id: assertId("event", "evt_ecxlocal001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "local only" },
    });

    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxlocal001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "Review local context.",
        need: ["review"],
        refs: [{ kind: "history", sessionId, afterSeq: -1, throughSeq: 0 }],
        budget: { maxHydratedBytes: 4096 },
        candidates: [{ agentId: "agent:reviewer", capabilities: ["review"], estimatedCost: 1 }],
      },
    });
    expect(plan.statusCode).toBe(200);
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const hydrated = await app.inject({
      method: "POST",
      url: "/v1/exchange/hydrate",
      payload: {
        packet,
        refIndexes: [0],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        hostedEligible: true,
      },
    });
    expect(hydrated.statusCode).toBe(404);
  });

  it("enforces hard hydration byte budget for history refs", async () => {
    const { ledger, app } = setup();
    const sessionId = assertId("session", "sess_ecxbudget001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "CLOUD_ALLOWED",
    });
    ledger.append(sessionId, 0, {
      id: assertId("event", "evt_ecxbudget001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "x".repeat(2000) },
    });

    const plan = await app.inject({
      method: "POST",
      url: "/v1/exchange/plan",
      payload: {
        operationId: assertId("operation", "op_ecxbudget001"),
        requestedAt: NOW,
        sender: "agent:planner",
        intent: "review",
        task: "Review bounded context.",
        need: ["review"],
        refs: [{ kind: "history", sessionId, afterSeq: -1, throughSeq: 0 }],
        budget: { maxHydratedBytes: 256 },
        candidates: [{ agentId: "agent:reviewer", capabilities: ["review"], estimatedCost: 1 }],
      },
    });
    expect(plan.statusCode).toBe(200);
    const packet = (plan.json() as { packets: unknown[] }).packets[0];

    const hydrated = await app.inject({
      method: "POST",
      url: "/v1/exchange/hydrate",
      payload: {
        packet,
        refIndexes: [0],
        scope: "personal",
        maxSensitivity: "INTERNAL",
        hostedEligible: true,
      },
    });
    expect(hydrated.statusCode).toBe(413);
    expect(hydrated.body).toContain("ECX_HYDRATION_BUDGET_EXCEEDED");
  });
});
