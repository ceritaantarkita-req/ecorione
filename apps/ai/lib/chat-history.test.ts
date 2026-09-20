import { assertId, type HistoryEvent } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { historyChatTarget, historyEventsToTurns } from "./chat-history";

const SESSION_ID = assertId("session", "sess_history");
const OPERATION_ID = assertId("operation", "op_history");
const USER_EVENT_ID = assertId("event", "evt_user");
const MODEL_EVENT_ID = assertId("event", "evt_model");
const ASSISTANT_EVENT_ID = assertId("event", "evt_assistant");
const TOOL_EVENT_ID = assertId("event", "evt_tool");
const BAD_EVENT_ID = assertId("event", "evt_bad");

const BASE = {
  sessionId: SESSION_ID,
  recordedAt: "2026-09-20T00:00:00.000Z",
  actor: "hub",
  operationId: OPERATION_ID,
  prevHash: null,
  hash: "a".repeat(64),
} as const;

describe("historyEventsToTurns", () => {
  it("replays user + assistant bubbles and reconstructs routing cost", () => {
    const events: HistoryEvent[] = [
      {
        ...BASE,
        id: USER_EVENT_ID,
        sessionId: SESSION_ID,
        seq: 0,
        eventType: "user.message",
        actor: "user",
        parentEventId: null,
        payload: { text: "hello", target: "local" },
      },
      {
        ...BASE,
        id: MODEL_EVENT_ID,
        sessionId: SESSION_ID,
        seq: 1,
        eventType: "model.called",
        parentEventId: USER_EVENT_ID,
        payload: {
          responseModel: "local-test-model-v1",
          cacheHit: true,
          actualUsd: 0.25,
          naiveUsd: 1,
          routeReason: "local-consolidation",
        },
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
      },
      {
        ...BASE,
        id: ASSISTANT_EVENT_ID,
        sessionId: SESSION_ID,
        seq: 2,
        eventType: "agent.message",
        actor: "assistant",
        parentEventId: MODEL_EVENT_ID,
        payload: { text: "hi" },
        prevHash: "b".repeat(64),
        hash: "c".repeat(64),
      },
    ];

    expect(historyChatTarget(events)).toBe("local");
    expect(historyEventsToTurns(events)).toEqual([
      { kind: "user", id: "evt_user", text: "hello" },
      {
        kind: "assistant",
        id: "evt_assistant",
        operationId: "op_history",
        reply: "hi",
        cost: {
          model: "local-test-model-v1",
          cacheHit: true,
          actualUsd: 0.25,
          naiveUsd: 1,
          savedUsd: 0.75,
          savedPct: 75,
          routeReason: "local-consolidation",
        },
      },
    ]);
  });

  it("ignores operational events and malformed message payloads", () => {
    const events: HistoryEvent[] = [
      {
        ...BASE,
        id: TOOL_EVENT_ID,
        sessionId: SESSION_ID,
        seq: 0,
        eventType: "tool.call",
        parentEventId: null,
        payload: { tool: "x" },
      },
      {
        ...BASE,
        id: BAD_EVENT_ID,
        sessionId: SESSION_ID,
        seq: 1,
        eventType: "agent.message",
        parentEventId: null,
        payload: { text: 123 },
      },
    ];
    expect(historyEventsToTurns(events)).toEqual([]);
  });
});
