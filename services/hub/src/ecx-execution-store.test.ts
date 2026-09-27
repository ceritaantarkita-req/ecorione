import { assertId } from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { EcxExecutionStore } from "./ecx-execution-store.js";

const NOW = "2026-09-27T06:30:00.000Z";

describe("EcxExecutionStore", () => {
  it("allows exactly one STARTED -> UNCERTAIN dispatch claim", () => {
    const db = openHubDatabase(":memory:");
    try {
      const store = new EcxExecutionStore(db);
      const packetId = assertId("event", "evt_ecxstoreclaim001");
      const begun = store.begin({
        packetId,
        operationId: assertId("operation", "op_ecxstoreclaim001"),
        workspaceId: assertId("workspace", "ws_personal"),
        recipient: "agent:reviewer",
        target: "local",
        historySessionId: null,
        fingerprint: "a".repeat(64),
        hydratedBytes: 0,
        selectedRefIndexes: [],
        now: NOW,
      });
      expect(begun.status.state).toBe("STARTED");
      expect(store.claimDispatch(packetId, NOW)).toBe(true);
      expect(store.claimDispatch(packetId, NOW)).toBe(false);
      expect(store.get(packetId).state).toBe("UNCERTAIN");
    } finally {
      db.close();
    }
  });

  it("rejects a different fingerprint for an existing packet receipt", () => {
    const db = openHubDatabase(":memory:");
    try {
      const store = new EcxExecutionStore(db);
      const packetId = assertId("event", "evt_ecxstoreconflict001");
      const input = {
        packetId,
        operationId: assertId("operation", "op_ecxstoreconflict001"),
        workspaceId: assertId("workspace", "ws_personal"),
        recipient: "agent:reviewer" as const,
        target: "local" as const,
        historySessionId: null,
        hydratedBytes: 0,
        selectedRefIndexes: [] as number[],
        now: NOW,
      };
      store.begin({ ...input, fingerprint: "a".repeat(64) });
      expect(() => store.begin({ ...input, fingerprint: "b".repeat(64) })).toThrow(
        /request berbeda/,
      );
    } finally {
      db.close();
    }
  });
});
