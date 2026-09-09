import { assertId, type HistoryEventDraft } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { openHubDatabase, type HubDatabase } from "./db.js";
import {
  HistoryEventConflictError,
  HistoryIntegrityError,
  HistoryLedger,
  HistorySequenceConflictError,
} from "./history-ledger.js";

const NOW = "2026-09-09T00:00:00.000Z";

describe("Historical Ledger", () => {
  let db: HubDatabase | null = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  function setup() {
    db = openHubDatabase(":memory:");
    const ledger = new HistoryLedger(db);
    const sessionId = assertId("session", "sess_history001");
    ledger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    });
    return { ledger, sessionId };
  }

  it("appends contiguous events and returns suffix + watermark", () => {
    const { ledger, sessionId } = setup();
    ledger.append(sessionId, 0, {
      id: assertId("event", "evt_history001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "hello" },
    });
    ledger.append(sessionId, 1, {
      id: assertId("event", "evt_history002"),
      recordedAt: NOW,
      eventType: "agent.message",
      actor: "hub",
      operationId: null,
      parentEventId: assertId("event", "evt_history001"),
      payload: { text: "hi" },
    });

    const range = ledger.readRange({
      sessionId,
      afterSeq: 0,
      throughSeq: 1,
      limit: 100,
      grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: false },
    });
    expect(range.events.map((event) => event.seq)).toEqual([1]);
    expect(range.throughSeq).toBe(1);
    expect(range.nextSeq).toBe(2);
    expect(range.events[0]?.prevHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects sequence gaps", () => {
    const { ledger, sessionId } = setup();
    expect(() =>
      ledger.append(sessionId, 1, {
        id: assertId("event", "evt_gap001"),
        recordedAt: NOW,
        eventType: "user.message",
        actor: "user",
        operationId: null,
        parentEventId: null,
        payload: { text: "gap" },
      }),
    ).toThrow(HistorySequenceConflictError);
  });

  it("deduplicates an identical event id but rejects a changed retry", () => {
    const { ledger, sessionId } = setup();
    const event = {
      id: assertId("event", "evt_retry001"),
      recordedAt: NOW,
      eventType: "agent.handoff" as const,
      actor: "hub:exchange",
      operationId: null,
      parentEventId: null,
      payload: { recipient: "agent:reviewer" },
    };
    expect(ledger.append(sessionId, 0, event).deduplicated).toBe(false);
    expect(ledger.append(sessionId, 0, event).deduplicated).toBe(true);
    expect(() =>
      ledger.append(sessionId, 0, { ...event, payload: { recipient: "agent:other" } }),
    ).toThrow(HistoryEventConflictError);
  });

  it("commits a batch atomically and makes a committed retry idempotent", () => {
    const { ledger, sessionId } = setup();
    const drafts: HistoryEventDraft[] = [
      {
        id: assertId("event", "evt_batch001"),
        recordedAt: NOW,
        eventType: "agent.handoff",
        actor: "hub:exchange",
        operationId: null,
        parentEventId: null,
        payload: { recipient: "agent:one" },
      },
      {
        id: assertId("event", "evt_batch002"),
        recordedAt: NOW,
        eventType: "agent.handoff",
        actor: "hub:exchange",
        operationId: null,
        parentEventId: null,
        payload: { recipient: "agent:two" },
      },
    ];

    const first = ledger.appendBatch(sessionId, drafts);
    expect(first.map((entry) => entry.deduplicated)).toEqual([false, false]);
    expect(first.map((entry) => entry.event.seq)).toEqual([0, 1]);

    const retry = ledger.appendBatch(sessionId, drafts);
    expect(retry.map((entry) => entry.deduplicated)).toEqual([true, true]);
    expect(ledger.getSession(sessionId)?.nextSeq).toBe(2);
  });

  it("rolls back the whole batch when a later event conflicts", () => {
    const { ledger, sessionId } = setup();
    const eventId = assertId("event", "evt_batchconflict001");
    const drafts: HistoryEventDraft[] = [
      {
        id: eventId,
        recordedAt: NOW,
        eventType: "agent.handoff",
        actor: "hub:exchange",
        operationId: null,
        parentEventId: null,
        payload: { recipient: "agent:one" },
      },
      {
        id: eventId,
        recordedAt: NOW,
        eventType: "agent.handoff",
        actor: "hub:exchange",
        operationId: null,
        parentEventId: null,
        payload: { recipient: "agent:two" },
      },
    ];

    expect(() => ledger.appendBatch(sessionId, drafts)).toThrow(HistoryEventConflictError);
    expect(ledger.getSession(sessionId)).toMatchObject({ nextSeq: 0, headHash: null });
    expect(
      ledger.readRange({
        sessionId,
        afterSeq: -1,
        limit: 10,
        grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: false },
      }).events,
    ).toEqual([]);
  });

  it("enforces append-only rows at the database boundary", () => {
    const { ledger, sessionId } = setup();
    ledger.append(sessionId, 0, {
      id: assertId("event", "evt_appendonly001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "immutable" },
    });
    expect(() =>
      db?.raw.prepare("UPDATE history_events SET payload_json='{}' WHERE seq=0").run(),
    ).toThrow(/append-only/);
    expect(() => db?.raw.prepare("DELETE FROM history_events WHERE seq=0").run()).toThrow(
      /append-only/,
    );
  });

  it("fails closed when a committed hash-chain row is tampered", () => {
    const { ledger, sessionId } = setup();
    ledger.append(sessionId, 0, {
      id: assertId("event", "evt_tamper001"),
      recordedAt: NOW,
      eventType: "user.message",
      actor: "user",
      operationId: null,
      parentEventId: null,
      payload: { text: "original" },
    });
    db?.raw.exec("DROP TRIGGER history_events_no_update");
    db?.raw
      .prepare("UPDATE history_events SET payload_json=? WHERE session_id=? AND seq=0")
      .run('{"text":"tampered"}', sessionId);
    expect(() =>
      ledger.readRange({
        sessionId,
        afterSeq: -1,
        limit: 10,
        grant: { scope: "personal", maxSensitivity: "INTERNAL", hostedEligible: false },
      }),
    ).toThrow(HistoryIntegrityError);
  });

  it("does not expose LOCAL_ONLY history as hosted-eligible", () => {
    const { ledger, sessionId } = setup();
    expect(() =>
      ledger.readRange({
        sessionId,
        afterSeq: -1,
        limit: 10,
        grant: { scope: "personal", maxSensitivity: "RESTRICTED", hostedEligible: true },
      }),
    ).toThrow(/tidak tersedia/);
  });
});
