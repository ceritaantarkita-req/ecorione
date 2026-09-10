import {
  ChatResponseSchema,
  MultimodalAdapterResultSchema,
  TimestampSchema,
  VoiceAudioChunkRequestSchema,
  VoiceSessionCreateRequestSchema,
  type MultimodalInferRequest,
} from "@ecorione/shared-schema";
import { describe, expect, it, vi } from "vitest";
import { CapabilityRegistry } from "./capability-registry.js";
import { openHubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { HubRepository } from "./repository.js";
import { RealtimeVoiceRuntime } from "./voice-runtime.js";
import { VoiceSessionStore } from "./voice-store.js";

const NOW = TimestampSchema.parse("2026-09-10T00:00:00.000Z");

function sessionRequest() {
  return VoiceSessionCreateRequestSchema.parse({
    operationId: "op_voicertcreate01",
    sessionId: "sess_voicert01",
    workspaceId: "ws_personal",
    route: { preferred: "local", allowHostedFallback: false },
    syncClass: "LOCAL_ONLY",
    languageMode: "auto",
  });
}

function audio(sequence: number, endOfUtterance: boolean, speech = true) {
  return VoiceAudioChunkRequestSchema.parse({
    operationId: `op_voicertchunk${String(sequence).padStart(2, "0")}`,
    sessionId: "sess_voicert01",
    clientSequence: sequence,
    mimeType: "audio/wav",
    contentBase64: "UklGRg==",
    speech,
    endOfUtterance,
    rms: speech ? 0.3 : 0,
  });
}

function inference(input: MultimodalInferRequest) {
  if (input.task === "transcribe") {
    return MultimodalAdapterResultSchema.parse({
      routeUsed: "local",
      adapter: "test-stt",
      provider: "local",
      model: "stt-id-en-v1",
      language: "en",
      text: "hello there",
      segments: [{ text: "hello there", startMs: 0, endMs: 600, language: "en" }],
      actualUsd: 0,
      naiveUsd: 0,
    });
  }
  return MultimodalAdapterResultSchema.parse({
    routeUsed: "local",
    adapter: "test-tts",
    provider: "local",
    model: "tts-id-en-v1",
    language: input.language ?? "en",
    text: input.text ?? "",
    segments: [],
    audioBase64: "UklGRg==",
    audioMimeType: "audio/wav",
    actualUsd: 0,
    naiveUsd: 0,
  });
}

function chatResult() {
  return ChatResponseSchema.parse({
    operationId: "op_voicechat01",
    sessionId: "sess_voicert01",
    reply: "Hi there. How can I help?",
    memoryUsed: { coreMemoryBlocks: [], recalledFacts: [], episodicSummaries: [] },
    cost: {
      model: "local-test-v1",
      cacheHit: false,
      actualUsd: 0,
      naiveUsd: 0,
      savedUsd: 0,
      savedPct: 0,
      routeReason: "local-consolidation",
    },
    policy: { outcome: "ALLOW", reason: "test", ruleId: "test" },
  });
}

function setup() {
  const db = openHubDatabase();
  const store = new VoiceSessionStore(db);
  const runtime = new RealtimeVoiceRuntime({
    store,
    authority: new CapabilityRegistry(db),
    repo: new HubRepository(db),
    history: new HistoryLedger(db),
    now: () => NOW,
    infer: async (input) => inference(input),
    chat: async () => chatResult(),
  });
  return { db, store, runtime };
}

describe("RealtimeVoiceRuntime", () => {
  it("streams partial/final transcript, language switch, assistant deltas, transient TTS and latency", async () => {
    const { db, store, runtime } = setup();
    runtime.create(sessionRequest());
    await runtime.acceptChunk(audio(0, false));
    await runtime.acceptChunk(audio(1, true, false));

    await vi.waitFor(() => {
      expect(runtime.get(sessionRequest().sessionId).state).toBe("LISTENING");
      expect(
        runtime
          .events(sessionRequest().sessionId, -1)
          .events.some((event) => event.type === "assistant.done"),
      ).toBe(true);
    });

    const events = runtime.events(sessionRequest().sessionId, -1).events;
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "speech.started",
        "language.changed",
        "transcript.partial",
        "transcript.final",
        "assistant.delta",
        "assistant.audio",
        "assistant.done",
        "latency",
      ]),
    );
    const liveAudio = events.find((event) => event.type === "assistant.audio");
    expect(liveAudio?.data.audioBase64).toBe("UklGRg==");
    const durableAudio = store
      .listEvents(sessionRequest().sessionId, -1)
      .find((event) => event.type === "assistant.audio");
    expect(durableAudio?.data.audioBase64).toBeUndefined();
    expect(durableAudio?.data.transient).toBe(true);
    expect(runtime.get(sessionRequest().sessionId).activeLanguage).toBe("en");
    db.close();
  });

  it("aborts stale generation on barge-in and increments generation before accepting new speech", async () => {
    const db = openHubDatabase();
    const store = new VoiceSessionStore(db);
    let aborted = false;
    const runtime = new RealtimeVoiceRuntime({
      store,
      authority: new CapabilityRegistry(db),
      repo: new HubRepository(db),
      history: new HistoryLedger(db),
      now: () => NOW,
      infer: async (input) => inference(input),
      chat: async (_input, options) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        }),
    });
    runtime.create(sessionRequest());
    await runtime.acceptChunk(audio(0, true));
    expect(runtime.get(sessionRequest().sessionId).state).toBe("THINKING");
    await runtime.acceptChunk(audio(1, false));
    expect(aborted).toBe(true);
    expect(runtime.get(sessionRequest().sessionId)).toMatchObject({
      state: "LISTENING",
      generation: 1,
      bargeInCount: 1,
    });
    expect(
      runtime
        .events(sessionRequest().sessionId, -1)
        .events.some((event) => event.type === "assistant.interrupted"),
    ).toBe(true);
    db.close();
  });
});
