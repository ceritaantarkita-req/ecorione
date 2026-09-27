import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";

const dirs: string[] = [];
const NOW = "2026-09-27T00:00:00.000Z";

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Historical Ledger compaction persistence", () => {
  it("reopens archived history, preserves replay, and advances compaction safely", () => {
    const dir = mkdtempSync(join(tmpdir(), "ecorione-ledger-compaction-"));
    dirs.push(dir);
    const path = join(dir, "hub.sqlite");
    const sessionId = assertId("session", "sess_b6_persist");

    const firstDb = openHubDatabase(path);
    const firstLedger = new HistoryLedger(firstDb);
    firstLedger.createSession({
      id: sessionId,
      createdAt: NOW,
      scope: "personal",
      sensitivity: "INTERNAL",
      syncClass: "LOCAL_ONLY",
    });
    for (let index = 0; index < 40; index += 1) {
      firstLedger.append(sessionId, index, {
        id: assertId("event", `evt_b6persist_${String(index).padStart(3, "0")}`),
        recordedAt: NOW,
        eventType: "user.message",
        actor: "user",
        operationId: null,
        parentEventId: null,
        payload: { index, text: "repeatable-ledger-payload-".repeat(20) },
      });
    }

    const firstCompaction = firstLedger.compactSession({
      sessionId,
      retainRecentEvents: 5,
      createdAt: "2026-09-27T00:10:00.000Z",
    });
    expect(firstCompaction).toMatchObject({
      compacted: true,
      archivedEvents: 35,
      archivedThroughSeq: 34,
      hotEvents: 5,
    });
    expect(firstCompaction.compressedBytes).toBeLessThan(firstCompaction.payloadBytes);
    firstDb.close();

    const reopenedDb = openHubDatabase(path);
    try {
      const reopenedLedger = new HistoryLedger(reopenedDb);
      expect(reopenedLedger.verifyAll()).toEqual({ sessions: 1, events: 40 });
      const replay = reopenedLedger.readRange({
        sessionId,
        afterSeq: 32,
        limit: 20,
        grant: {
          scope: "personal",
          maxSensitivity: "INTERNAL",
          hostedEligible: false,
        },
      });
      expect(replay.events.map((event) => event.seq)).toEqual([33, 34, 35, 36, 37, 38, 39]);

      reopenedLedger.append(sessionId, 40, {
        id: assertId("event", "evt_b6persist_040"),
        recordedAt: "2026-09-27T00:20:00.000Z",
        eventType: "agent.message",
        actor: "hub",
        operationId: null,
        parentEventId: null,
        payload: { text: "continued-after-restart" },
      });
      const secondCompaction = reopenedLedger.compactSession({
        sessionId,
        retainRecentEvents: 5,
        createdAt: "2026-09-27T00:21:00.000Z",
      });
      expect(secondCompaction).toMatchObject({
        compacted: true,
        archivedEvents: 1,
        archivedThroughSeq: 35,
        hotEvents: 5,
      });
      expect(reopenedLedger.verifyAll()).toEqual({ sessions: 1, events: 41 });
      expect(
        reopenedDb.raw
          .prepare("SELECT COUNT(*) AS count FROM history_archive_segments WHERE session_id=?")
          .get(sessionId),
      ).toEqual({ count: 2 });
      expect(
        reopenedDb.raw
          .prepare("SELECT COUNT(*) AS count FROM history_events WHERE session_id=?")
          .get(sessionId),
      ).toEqual({ count: 5 });
    } finally {
      reopenedDb.close();
    }
  });
});
