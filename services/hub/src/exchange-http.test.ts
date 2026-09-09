import { assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
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
