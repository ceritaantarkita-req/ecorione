import { assertId } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { EcxRoundTripStore } from "./ecx-round-trip-store.js";

const NOW = "2026-09-27T07:30:00.000Z";

describe("EcxRoundTripStore", () => {
  function input() {
    return {
      packetId: assertId("event", "evt_b3store001"),
      operationId: assertId("operation", "op_b3store001"),
      continuationOperationId: assertId("operation", "op_b3continuation001"),
      workspaceId: assertId("workspace", "ws_personal"),
      sender: "agent:parent" as const,
      recipient: "agent:child" as const,
      responseMode: "delta" as const,
      parentTarget: "local" as const,
      historySessionId: null,
      fingerprint: "a".repeat(64),
      now: NOW,
    };
  }

  it("allows exactly one parent continuation dispatch claim", () => {
    const db = openHubDatabase(":memory:");
    try {
      const store = new EcxRoundTripStore(db);
      const begun = store.begin(input());
      expect(begun.status.state).toBe("STARTED");
      expect(store.claimContinuation(input().packetId, NOW)).toBe(true);
      expect(store.claimContinuation(input().packetId, NOW)).toBe(false);
      expect(store.get(input().packetId).state).toBe("UNCERTAIN");
    } finally {
      db.close();
    }
  });

  it("rejects changed round-trip identity for the same packet", () => {
    const db = openHubDatabase(":memory:");
    try {
      const store = new EcxRoundTripStore(db);
      store.begin(input());
      expect(() => store.begin({ ...input(), fingerprint: "b".repeat(64) })).toThrow(
        /request berbeda/,
      );
    } finally {
      db.close();
    }
  });
});
