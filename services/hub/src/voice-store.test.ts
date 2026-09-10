import {
  TimestampSchema,
  VoiceAudioChunkRequestSchema,
  VoiceSessionCreateRequestSchema,
} from "@ecorione/shared-schema";
import { describe, expect, it } from "vitest";
import { openHubDatabase } from "./db.js";
import { VoiceChunkConflictError, VoiceSessionStore } from "./voice-store.js";

const T0 = TimestampSchema.parse("2026-09-10T00:00:00.000Z");
const T1 = TimestampSchema.parse("2026-09-10T00:00:01.000Z");

function createRequest() {
  return VoiceSessionCreateRequestSchema.parse({
    operationId: "op_voicecreate01",
    sessionId: "sess_voice01",
    workspaceId: "ws_personal",
    route: { preferred: "local", allowHostedFallback: false },
    syncClass: "LOCAL_ONLY",
    languageMode: "auto",
  });
}

function chunk(sequence: number, contentBase64 = "UklGRg==") {
  return VoiceAudioChunkRequestSchema.parse({
    operationId: `op_voicechunk${String(sequence).padStart(2, "0")}`,
    sessionId: "sess_voice01",
    clientSequence: sequence,
    mimeType: "audio/wav",
    contentBase64,
    speech: true,
    endOfUtterance: false,
    rms: 0.2,
  });
}

describe("VoiceSessionStore", () => {
  it("keeps session creation idempotent and voice events append-only", () => {
    const db = openHubDatabase();
    const store = new VoiceSessionStore(db);
    const first = store.create(createRequest(), T0);
    const second = store.create(
      VoiceSessionCreateRequestSchema.parse({
        ...createRequest(),
        operationId: "op_voicecreate02",
      }),
      T1,
    );
    expect(first.sessionId).toBe(second.sessionId);
    expect(store.listEvents(first.sessionId, -1).map((event) => event.type)).toEqual([
      "session.started",
    ]);
    db.close();
  });

  it("enforces monotonic chunk sequence and exact replay semantics", () => {
    const db = openHubDatabase();
    const store = new VoiceSessionStore(db);
    store.create(createRequest(), T0);
    expect(store.beginChunk(chunk(0), T0).replay).toBeNull();
    const ack = {
      sessionId: createRequest().sessionId,
      clientSequence: 0,
      state: "LISTENING" as const,
      generation: 0,
      replayed: false,
    };
    store.completeChunk(ack, T1);
    expect(store.beginChunk(chunk(0), T1).replay).toEqual(ack);
    expect(() => store.beginChunk(chunk(0, "RklGRg=="), T1)).toThrow(VoiceChunkConflictError);
    expect(() => store.beginChunk(chunk(2), T1)).toThrow(/expected 1/);
    db.close();
  });

  it("invalidates live generations on interruption and fails old live sessions on restart", () => {
    const db = openHubDatabase();
    const store = new VoiceSessionStore(db);
    const session = store.create(createRequest(), T0);
    const interrupted = store.interrupt(session.sessionId, T1);
    expect(interrupted.generation).toBe(1);
    expect(interrupted.bargeInCount).toBe(1);
    expect(store.recoverOpenSessions(T1)).toBe(1);
    expect(store.get(session.sessionId).state).toBe("FAILED");
    expect(store.listEvents(session.sessionId, -1).at(-1)?.data).toMatchObject({
      reason: "process-restart",
    });
    db.close();
  });
});
