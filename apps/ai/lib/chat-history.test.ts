import type { HistoryEvent } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { historyEventsToTurns } from "./chat-history";

const BASE = {
  sessionId: "sess_history",
  recordedAt: "2026-09-20T00:00:00.000Z",
  actor: "hub",
  operationId: "op_history",
  prevHash: null,
  hash: "a".repeat(64),
} as const;

describe("historyEventsToTurns", () => {
  it("replays user + assistant bubbles and reconstructs routing cost", () => {
    const events: HistoryEvent[] = [
      {
        ...BASE,
        id: "evt_user" as never,
        sessionId: "sess_history" as never,
        seq: 0,
        eventType: "user.message",
        actor: "user",
        parentEventId: null,
        payload: { text: "hello", target: "local" },
      },
      {
        ...BASE,
        id: "evt_model" as never,
        sessionId: "sess_history" as never,
        seq: 1,
        eventType: "model.called",
        parentEventId: "evt_user" as never,
        payload: {
          responseModel: "gemma4:latest",
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
        id: "evt_assistant" as never,
        sessionId: "sess_history" as never,
        seq: 2,
        eventType: "agent.message",
        actor: "assistant",
        parentEventId: "evt_model" as never,
        payload: { text: "hi" },
        prevHash: "b".repeat(64),
        hash: "c".repeat(64),
      },
    ];

    expect(historyEventsToTurns(events)).toEqual([
      { kind: "user", id: "evt_user", text: "hello" },
      {
        kind: "assistant",
        id: "evt_assistant",
        operationId: "op_history",
        reply: "hi",
        cost: {
          model: "gemma4:latest",
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
        id: "evt_tool" as never,
        sessionId: "sess_history" as never,
        seq: 0,
        eventType: "tool.call",
        parentEventId: null,
        payload: { tool: "x" },
      },
      {
        ...BASE,
        id: "evt_bad" as never,
        sessionId: "sess_history" as never,
        seq: 1,
        eventType: "agent.message",
        parentEventId: null,
        payload: { text: 123 },
      },
    ];
    expect(historyEventsToTurns(events)).toEqual([]);
  });
});
