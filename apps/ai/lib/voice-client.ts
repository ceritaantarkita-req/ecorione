import type {
  MultimodalRouteRequest,
  Scope,
  Sensitivity,
  SyncClass,
  VoiceEvent,
  VoiceLanguageMode,
  VoiceSessionSnapshot,
  VoiceVadConfig,
} from "@ecorione/shared-schema";

export interface VoiceClientOptions {
  readonly sessionId: string;
  readonly workspaceId?: string | undefined;
  readonly scope?: Scope | undefined;
  readonly maxSensitivity?: Sensitivity | undefined;
  readonly syncClass?: SyncClass | undefined;
  readonly route?: MultimodalRouteRequest | undefined;
  readonly languageMode?: VoiceLanguageMode | undefined;
  readonly voice?: string | undefined;
  readonly vad?: Partial<VoiceVadConfig> | undefined;
  readonly onEvent?: ((event: VoiceEvent) => void) | undefined;
  readonly onError?: ((error: Error) => void) | undefined;
}

const DEFAULT_VAD: VoiceVadConfig = { threshold: 0.02, silenceMs: 700, chunkMs: 800 };

function operationId(): string {
  return `op_${globalThis.crypto.randomUUID()}`;
}

function concatSamples(chunks: readonly Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Uint8Array(buffer);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const block = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return btoa(binary);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function jsonRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => undefined)) as
    { error?: { message?: string } } | T | undefined;
  if (!response.ok) {
    const message =
      payload !== undefined &&
      payload !== null &&
      typeof payload === "object" &&
      "error" in payload
        ? payload.error?.message
        : undefined;
    throw new Error(message ?? `Voice API membalas HTTP ${String(response.status)}.`);
  }
  return payload as T;
}

export class RealtimeVoiceClient {
  private readonly vad: VoiceVadConfig;
  private mediaStream: MediaStream | null = null;
  private inputContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private events: EventSource | null = null;
  private pendingSamples: Float32Array[] = [];
  private pendingCount = 0;
  private pendingMaxRms = 0;
  private silenceSamples = 0;
  private speechOpen = false;
  private clientSequence = 0;
  private serverState: VoiceSessionSnapshot["state"] = "LISTENING";
  private sendChain: Promise<void> = Promise.resolve();
  private playbackChain: Promise<void> = Promise.resolve();
  private activePlayback: AudioBufferSourceNode | null = null;
  private outputContext: AudioContext | null = null;
  private lastEventSequence = -1;
  private stopped = true;

  constructor(private readonly options: VoiceClientOptions) {
    this.vad = { ...DEFAULT_VAD, ...options.vad };
  }

  async start(): Promise<VoiceSessionSnapshot> {
    if (!this.stopped) throw new Error("Voice client sudah berjalan.");
    this.stopped = false;
    const session = await jsonRequest<VoiceSessionSnapshot>("/api/voice/session", {
      operationId: operationId(),
      sessionId: this.options.sessionId,
      ...(this.options.workspaceId === undefined
        ? {}
        : { workspaceId: this.options.workspaceId }),
      ...(this.options.scope === undefined ? {} : { scope: this.options.scope }),
      ...(this.options.maxSensitivity === undefined
        ? {}
        : { maxSensitivity: this.options.maxSensitivity }),
      ...(this.options.syncClass === undefined ? {} : { syncClass: this.options.syncClass }),
      ...(this.options.route === undefined ? {} : { route: this.options.route }),
      ...(this.options.languageMode === undefined
        ? {}
        : { languageMode: this.options.languageMode }),
      ...(this.options.voice === undefined ? {} : { voice: this.options.voice }),
      vad: this.vad,
    });
    this.serverState = session.state;
    this.openEventStream();
    await this.openMicrophone();
    return session;
  }

  async stop(reason = "user-close"): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.events?.close();
    this.events = null;
    this.stopPlayback();
    if (this.processor !== null) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
    }
    this.source?.disconnect();
    for (const track of this.mediaStream?.getTracks() ?? []) track.stop();
    this.mediaStream = null;
    this.source = null;
    this.processor = null;
    await this.inputContext?.close().catch(() => undefined);
    this.inputContext = null;
    await this.outputContext?.close().catch(() => undefined);
    this.outputContext = null;
    await jsonRequest("/api/voice/close", {
      operationId: operationId(),
      sessionId: this.options.sessionId,
      reason,
    }).catch((error: unknown) => this.report(error));
  }

  private async openMicrophone(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (this.stopped) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    this.mediaStream = stream;
    const context = new AudioContext();
    await context.resume();
    this.inputContext = context;
    this.source = context.createMediaStreamSource(stream);
    this.processor = context.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) =>
      this.handleAudio(event.inputBuffer.getChannelData(0));
    this.source.connect(this.processor);
    this.processor.connect(context.destination);
  }

  private handleAudio(frame: Float32Array): void {
    if (this.stopped || this.inputContext === null) return;
    const copy = new Float32Array(frame);
    const level = rms(copy);
    const frameSpeech = level >= this.vad.threshold;
    if (frameSpeech) {
      if (!this.speechOpen) {
        this.speechOpen = true;
        if (this.serverState === "THINKING" || this.serverState === "SPEAKING") {
          this.stopPlayback();
          this.sendChain = this.sendChain
            .then(() =>
              jsonRequest("/api/voice/interrupt", {
                operationId: operationId(),
                sessionId: this.options.sessionId,
                reason: "client-vad-barge-in",
              }).then(() => undefined),
            )
            .catch((error: unknown) => this.report(error));
        }
      }
      this.silenceSamples = 0;
    } else if (this.speechOpen) {
      this.silenceSamples += copy.length;
    }

    this.pendingSamples.push(copy);
    this.pendingCount += copy.length;
    this.pendingMaxRms = Math.max(this.pendingMaxRms, level);
    const chunkSamples = Math.max(
      1,
      Math.floor((this.inputContext.sampleRate * this.vad.chunkMs) / 1000),
    );
    const silenceLimit = Math.max(
      1,
      Math.floor((this.inputContext.sampleRate * this.vad.silenceMs) / 1000),
    );
    const endOfUtterance = this.speechOpen && this.silenceSamples >= silenceLimit;
    if (this.pendingCount >= chunkSamples || endOfUtterance) this.flushChunk(endOfUtterance);
    if (endOfUtterance) {
      this.speechOpen = false;
      this.silenceSamples = 0;
    }
  }

  private flushChunk(endOfUtterance: boolean): void {
    if (this.inputContext === null || this.pendingCount === 0) return;
    const samples = concatSamples(this.pendingSamples);
    this.pendingSamples = [];
    this.pendingCount = 0;
    const chunkRms = this.pendingMaxRms;
    this.pendingMaxRms = 0;
    const hadSpeech = chunkRms >= this.vad.threshold;
    const sequence = this.clientSequence;
    this.clientSequence += 1;
    const payload = {
      operationId: operationId(),
      sessionId: this.options.sessionId,
      clientSequence: sequence,
      mimeType: "audio/wav",
      contentBase64: base64(encodePcm16Wav(samples, this.inputContext.sampleRate)),
      speech: hadSpeech,
      endOfUtterance,
      rms: Math.min(1, chunkRms),
    };
    this.sendChain = this.sendChain
      .then(() => jsonRequest("/api/voice/chunk", payload).then(() => undefined))
      .catch((error: unknown) => this.report(error));
  }

  private openEventStream(): void {
    const stream = new EventSource(
      `/api/voice/stream?sessionId=${encodeURIComponent(this.options.sessionId)}&after=${String(this.lastEventSequence)}`,
    );
    this.events = stream;
    stream.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as VoiceEvent;
        if (event.sequence <= this.lastEventSequence) return;
        this.lastEventSequence = event.sequence;
        this.handleEvent(event);
      } catch (error) {
        this.report(error);
      }
    };
    stream.onerror = () => {
      if (!this.stopped)
        this.options.onError?.(
          new Error("Voice event stream terputus; browser akan mencoba reconnect."),
        );
    };
  }

  private handleEvent(event: VoiceEvent): void {
    if (event.type === "session.state" && typeof event.data.state === "string") {
      this.serverState = event.data.state as VoiceSessionSnapshot["state"];
    }
    if (event.type === "assistant.interrupted") this.stopPlayback();
    if (event.type === "assistant.audio") {
      const encoded = event.data.audioBase64;
      if (typeof encoded === "string") this.queuePlayback(encoded);
    }
    this.options.onEvent?.(event);
  }

  private queuePlayback(encoded: string): void {
    this.playbackChain = this.playbackChain
      .then(async () => {
        if (this.stopped) return;
        const context = this.outputContext ?? new AudioContext();
        this.outputContext = context;
        await context.resume();
        const audio = await context.decodeAudioData(decodeBase64(encoded).slice(0));
        if (this.stopped) return;
        await new Promise<void>((resolve) => {
          const source = context.createBufferSource();
          source.buffer = audio;
          source.connect(context.destination);
          this.activePlayback = source;
          source.onended = () => {
            if (this.activePlayback === source) this.activePlayback = null;
            resolve();
          };
          source.start();
        });
      })
      .catch((error: unknown) => this.report(error));
  }

  private stopPlayback(): void {
    try {
      this.activePlayback?.stop();
    } catch {
      // already stopped
    }
    this.activePlayback = null;
    this.playbackChain = Promise.resolve();
  }

  private report(error: unknown): void {
    this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}
