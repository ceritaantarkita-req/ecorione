import { EventEmitter } from "node:events";
import {
  MultimodalAdapterResultSchema,
  VoiceChunkAckSchema,
  VoiceEventBatchSchema,
  makeId,
  voiceLanguageFromDetected,
  type ChatRequest,
  type ChatResponse,
  type MultimodalAdapterResult,
  type MultimodalInferRequest,
  type OperationId,
  type SessionId,
  type Timestamp,
  type VoiceAudioChunkRequest,
  type VoiceChunkAck,
  type VoiceCloseRequest,
  type VoiceEvent,
  type VoiceEventBatch,
  type VoiceInterruptRequest,
  type VoiceSessionCreateRequest,
  type VoiceSessionSnapshot,
} from "@ecorione/shared-schema";
import type { CapabilityRegistry } from "./capability-registry.js";
import type { HistoryLedger } from "./history-ledger.js";
import { authorizeInference, requestedRoutes } from "./multimodal-http.js";
import type { HubRepository } from "./repository.js";
import type { VoiceSessionStore } from "./voice-store.js";

export interface VoiceRuntimeDeps {
  readonly store: VoiceSessionStore;
  readonly authority: CapabilityRegistry;
  readonly repo: HubRepository;
  readonly history: HistoryLedger;
  readonly now: () => Timestamp;
  readonly infer: (
    input: MultimodalInferRequest,
    signal?: AbortSignal,
  ) => Promise<MultimodalAdapterResult>;
  readonly chat: (
    input: ChatRequest,
    options: {
      readonly target: "local" | "hosted";
      readonly syncClass: VoiceSessionSnapshot["syncClass"];
      readonly signal?: AbortSignal;
    },
  ) => Promise<ChatResponse>;
}

interface TransientSession {
  transcriptParts: string[];
  currentGeneration: AbortController | null;
  speechOpen: boolean;
  liveAudio: Map<number, Readonly<Record<string, unknown>>>;
}

const MAX_LIVE_AUDIO_EVENTS = 48;
const ASSISTANT_DELTA_MAX_CHARS = 240;

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function replyChunks(text: string): string[] {
  const normalized = text.trim();
  if (normalized.length === 0) return [];
  const sentences = normalized.match(/[^.!?\n]+[.!?]?|\n+/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (sentence.length === 0) continue;
    if (
      current.length > 0 &&
      current.length + 1 + sentence.length > ASSISTANT_DELTA_MAX_CHARS
    ) {
      chunks.push(current);
      current = "";
    }
    if (sentence.length <= ASSISTANT_DELTA_MAX_CHARS) {
      current = current.length === 0 ? sentence : `${current} ${sentence}`;
      continue;
    }
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
    for (let offset = 0; offset < sentence.length; offset += ASSISTANT_DELTA_MAX_CHARS) {
      chunks.push(sentence.slice(offset, offset + ASSISTANT_DELTA_MAX_CHARS));
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export class RealtimeVoiceRuntime {
  private readonly emitter = new EventEmitter();
  private readonly transient = new Map<SessionId, TransientSession>();

  constructor(private readonly deps: VoiceRuntimeDeps) {
    this.deps.store.recoverOpenSessions(this.deps.now());
  }

  create(input: VoiceSessionCreateRequest): VoiceSessionSnapshot {
    const now = this.deps.now();
    const workspaceId =
      input.workspaceId ?? ("ws_personal" as VoiceSessionSnapshot["workspaceId"]);
    authorizeInference({
      authority: this.deps.authority,
      repo: this.deps.repo,
      workspaceId,
      operationId: input.operationId,
      routes: requestedRoutes(input.route),
      scope: input.scope,
      sensitivity: input.maxSensitivity,
      syncClass: input.syncClass,
      now,
    });
    this.deps.history.ensureSession({
      id: input.sessionId,
      createdAt: now,
      scope: input.scope,
      sensitivity: input.maxSensitivity,
      syncClass: input.syncClass,
    });
    const snapshot = this.deps.store.create(input, now);
    this.ensureTransient(input.sessionId);
    this.deps.repo.recordAuditEvent({
      type: "ACTION_EXECUTED",
      operationId: input.operationId,
      module: "Hub",
      detail: {
        tool: "voice.session.start",
        sessionId: input.sessionId,
        route: input.route,
        languageMode: input.languageMode,
      },
      now,
    });
    return snapshot;
  }

  get(sessionId: SessionId): VoiceSessionSnapshot {
    return this.deps.store.get(sessionId);
  }

  events(sessionId: SessionId, after: number): VoiceEventBatch {
    const session = this.deps.store.get(sessionId);
    const liveAudio = this.transient.get(sessionId)?.liveAudio;
    const events = this.deps.store.listEvents(sessionId, after).map((event) => {
      const payload = liveAudio?.get(event.sequence);
      return payload === undefined ? event : { ...event, data: payload };
    });
    return VoiceEventBatchSchema.parse({ session, events });
  }

  subscribe(sessionId: SessionId, listener: (event: VoiceEvent) => void): () => void {
    this.deps.store.get(sessionId);
    const key = this.eventKey(sessionId);
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }

  async acceptChunk(input: VoiceAudioChunkRequest): Promise<VoiceChunkAck> {
    const now = this.deps.now();
    const begun = this.deps.store.beginChunk(input, now);
    if (begun.replay !== null) return { ...begun.replay, replayed: true };

    try {
      let session = this.deps.store.get(input.sessionId);
      const transient = this.ensureTransient(input.sessionId);
      if (input.speech && (session.state === "THINKING" || session.state === "SPEAKING")) {
        session = this.interruptInternal(
          input.sessionId,
          input.operationId,
          "user-barge-in",
          now,
        );
      }

      if (input.speech) {
        if (!transient.speechOpen) {
          transient.speechOpen = true;
          this.emitStored(
            this.deps.store.appendEvent(
              input.sessionId,
              "speech.started",
              session.generation,
              { clientSequence: input.clientSequence, rms: input.rms ?? null },
              now,
            ),
          );
        }
        const partialStart = performance.now();
        const inferred = MultimodalAdapterResultSchema.parse(
          await this.deps.infer({
            operationId: input.operationId,
            task: "transcribe",
            route: session.route,
            syncClass: session.syncClass,
            mimeType: input.mimeType,
            contentBase64: input.contentBase64,
          }),
        );
        const partial = inferred.text.trim();
        if (partial.length > 0) {
          transient.transcriptParts.push(partial);
          const nextLanguage = voiceLanguageFromDetected(
            session.languageMode,
            inferred.language,
            session.activeLanguage,
          );
          if (nextLanguage !== session.activeLanguage) {
            session = this.deps.store.setLanguage(input.sessionId, nextLanguage, now);
            this.emitStored(
              this.deps.store.appendEvent(
                input.sessionId,
                "language.changed",
                session.generation,
                { language: nextLanguage, detected: inferred.language },
                now,
              ),
            );
          }
          this.emitStored(
            this.deps.store.appendEvent(
              input.sessionId,
              "transcript.partial",
              session.generation,
              {
                text: partial,
                language: inferred.language,
                routeUsed: inferred.routeUsed,
                clientSequence: input.clientSequence,
                sttMs: performance.now() - partialStart,
              },
              now,
            ),
          );
        }
      }

      if (input.endOfUtterance) {
        transient.speechOpen = false;
        const transcript = transient.transcriptParts.join(" ").trim();
        transient.transcriptParts = [];
        if (transcript.length > 0) {
          session = this.deps.store.setState(input.sessionId, "THINKING", now);
          this.emitStored(
            this.deps.store.appendEvent(
              input.sessionId,
              "transcript.final",
              session.generation,
              { text: transcript, language: session.activeLanguage },
              now,
            ),
          );
          this.emitStored(
            this.deps.store.appendEvent(
              input.sessionId,
              "session.state",
              session.generation,
              { state: "THINKING" },
              now,
            ),
          );
          this.startGeneration(session, transcript);
        }
      }

      const latest = this.deps.store.get(input.sessionId);
      const ack = VoiceChunkAckSchema.parse({
        sessionId: input.sessionId,
        clientSequence: input.clientSequence,
        state: latest.state,
        generation: latest.generation,
        replayed: false,
      });
      this.deps.store.completeChunk(ack, now);
      return ack;
    } catch (error) {
      this.deps.store.failChunk(
        input.sessionId,
        input.clientSequence,
        error instanceof Error ? error.message : String(error),
        now,
      );
      throw error;
    }
  }

  interrupt(input: VoiceInterruptRequest): VoiceSessionSnapshot {
    return this.interruptInternal(
      input.sessionId,
      input.operationId,
      input.reason,
      this.deps.now(),
    );
  }

  close(input: VoiceCloseRequest): VoiceSessionSnapshot {
    const now = this.deps.now();
    const transient = this.transient.get(input.sessionId);
    transient?.currentGeneration?.abort();
    const before = this.deps.store.get(input.sessionId);
    this.emitStored(
      this.deps.store.appendEvent(
        input.sessionId,
        "session.closed",
        before.generation,
        { operationId: input.operationId, reason: input.reason },
        now,
      ),
    );
    const closed = this.deps.store.close(input.sessionId, now);
    this.transient.delete(input.sessionId);
    this.deps.repo.recordAuditEvent({
      type: "ACTION_EXECUTED",
      operationId: input.operationId,
      module: "Hub",
      detail: { tool: "voice.session.close", sessionId: input.sessionId, reason: input.reason },
      now,
    });
    return closed;
  }

  private startGeneration(session: VoiceSessionSnapshot, transcript: string): void {
    const transient = this.ensureTransient(session.sessionId);
    transient.currentGeneration?.abort();
    const controller = new AbortController();
    transient.currentGeneration = controller;
    const generation = session.generation;
    const started = performance.now();
    void this.generate(session, transcript, generation, controller, started);
  }

  private async generate(
    sessionAtStart: VoiceSessionSnapshot,
    transcript: string,
    generation: number,
    controller: AbortController,
    started: number,
  ): Promise<void> {
    const modelStarted = performance.now();
    try {
      const chat = await this.deps.chat(
        {
          sessionId: sessionAtStart.sessionId,
          workspaceId: sessionAtStart.workspaceId,
          message: transcript,
          scope: sessionAtStart.scope,
          maxSensitivity: sessionAtStart.maxSensitivity,
          autonomy: "L1",
        },
        {
          target: sessionAtStart.route.preferred,
          syncClass: sessionAtStart.syncClass,
          signal: controller.signal,
        },
      );
      const modelMs = performance.now() - modelStarted;
      if (!this.isCurrent(sessionAtStart.sessionId, generation, controller)) return;

      let session = this.deps.store.setState(
        sessionAtStart.sessionId,
        "SPEAKING",
        this.deps.now(),
      );
      this.emitStored(
        this.deps.store.appendEvent(
          session.sessionId,
          "session.state",
          generation,
          { state: "SPEAKING" },
          this.deps.now(),
        ),
      );

      let firstTtsMs: number | null = null;
      const deltas = replyChunks(chat.reply);
      for (const [index, delta] of deltas.entries()) {
        if (!this.isCurrent(session.sessionId, generation, controller)) return;
        this.emitStored(
          this.deps.store.appendEvent(
            session.sessionId,
            "assistant.delta",
            generation,
            { index, text: delta, operationId: chat.operationId },
            this.deps.now(),
          ),
        );
        const ttsStarted = performance.now();
        const audio = MultimodalAdapterResultSchema.parse(
          await this.deps.infer(
            {
              operationId: makeId("operation"),
              task: "synthesize",
              route: session.route,
              syncClass: session.syncClass,
              text: delta,
              language: session.activeLanguage,
              ...(session.voice === null ? {} : { voice: session.voice }),
            },
            controller.signal,
          ),
        );
        if (!this.isCurrent(session.sessionId, generation, controller)) return;
        if (audio.audioBase64 === undefined || audio.audioMimeType === undefined) {
          throw new Error(
            "Realtime TTS adapter tidak mengembalikan audioBase64 + audioMimeType.",
          );
        }
        if (firstTtsMs === null) firstTtsMs = performance.now() - ttsStarted;
        this.emitLiveAudio(session.sessionId, generation, {
          index,
          audioBase64: audio.audioBase64,
          audioMimeType: audio.audioMimeType,
          routeUsed: audio.routeUsed,
          provider: audio.provider,
          model: audio.model,
        });
      }

      if (!this.isCurrent(session.sessionId, generation, controller)) return;
      this.emitStored(
        this.deps.store.appendEvent(
          session.sessionId,
          "assistant.done",
          generation,
          { operationId: chat.operationId, chars: chat.reply.length, chunks: deltas.length },
          this.deps.now(),
        ),
      );
      session = this.deps.store.setState(session.sessionId, "LISTENING", this.deps.now());
      this.emitStored(
        this.deps.store.appendEvent(
          session.sessionId,
          "session.state",
          generation,
          { state: "LISTENING" },
          this.deps.now(),
        ),
      );
      this.emitStored(
        this.deps.store.appendEvent(
          session.sessionId,
          "latency",
          generation,
          {
            modelMs,
            ttsFirstChunkMs: firstTtsMs,
            endToEndMs: performance.now() - started,
            bargeInCount: session.bargeInCount,
          },
          this.deps.now(),
        ),
      );
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      const now = this.deps.now();
      const current = this.deps.store.get(sessionAtStart.sessionId);
      if (current.generation !== generation) return;
      this.emitStored(
        this.deps.store.appendEvent(
          current.sessionId,
          "error",
          generation,
          {
            message: error instanceof Error ? error.message : String(error),
            recoverable: true,
          },
          now,
        ),
      );
      this.deps.store.setState(current.sessionId, "LISTENING", now, null);
    } finally {
      const transient = this.transient.get(sessionAtStart.sessionId);
      if (transient?.currentGeneration === controller) transient.currentGeneration = null;
    }
  }

  private interruptInternal(
    sessionId: SessionId,
    operationId: OperationId,
    reason: string,
    now: Timestamp,
  ): VoiceSessionSnapshot {
    const transient = this.ensureTransient(sessionId);
    transient.currentGeneration?.abort();
    transient.currentGeneration = null;
    const interrupted = this.deps.store.interrupt(sessionId, now);
    this.emitStored(
      this.deps.store.appendEvent(
        sessionId,
        "assistant.interrupted",
        interrupted.generation,
        { operationId, reason },
        now,
      ),
    );
    const listening = this.deps.store.setState(sessionId, "LISTENING", now);
    this.emitStored(
      this.deps.store.appendEvent(
        sessionId,
        "session.state",
        listening.generation,
        { state: "LISTENING", reason },
        now,
      ),
    );
    return listening;
  }

  private isCurrent(
    sessionId: SessionId,
    generation: number,
    controller: AbortController,
  ): boolean {
    if (controller.signal.aborted) return false;
    const session = this.deps.store.get(sessionId);
    return (
      session.generation === generation &&
      session.state !== "CLOSED" &&
      session.state !== "FAILED"
    );
  }

  private ensureTransient(sessionId: SessionId): TransientSession {
    const existing = this.transient.get(sessionId);
    if (existing !== undefined) return existing;
    const created: TransientSession = {
      transcriptParts: [],
      currentGeneration: null,
      speechOpen: false,
      liveAudio: new Map(),
    };
    this.transient.set(sessionId, created);
    return created;
  }

  private emitStored(event: VoiceEvent): void {
    this.emitter.emit(this.eventKey(event.sessionId), event);
  }

  private emitLiveAudio(
    sessionId: SessionId,
    generation: number,
    data: Readonly<Record<string, unknown>>,
  ): void {
    const at = this.deps.now();
    const stored = this.deps.store.appendEvent(
      sessionId,
      "assistant.audio",
      generation,
      {
        index: data.index,
        audioMimeType: data.audioMimeType,
        routeUsed: data.routeUsed,
        provider: data.provider,
        model: data.model,
        transient: true,
      },
      at,
    );
    const transient = this.ensureTransient(sessionId);
    transient.liveAudio.set(stored.sequence, data);
    while (transient.liveAudio.size > MAX_LIVE_AUDIO_EVENTS) {
      const oldest = transient.liveAudio.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      transient.liveAudio.delete(oldest);
    }
    this.emitter.emit(this.eventKey(sessionId), { ...stored, data });
  }

  private eventKey(sessionId: SessionId): string {
    return `voice:${sessionId}`;
  }
}
