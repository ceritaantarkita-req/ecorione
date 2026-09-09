import type {
  DetectedLanguage,
  MultimodalSemanticResult,
  MultimodalTask,
} from "@ecorione/shared-schema";

export interface MultimodalBinaryInput {
  readonly bytes: Buffer;
  readonly mimeType: string;
  readonly filename: string;
}

export interface MultimodalProcessAdapterInput extends MultimodalBinaryInput {
  readonly task: Exclude<MultimodalTask, "tts">;
}

export interface MultimodalProcessAdapterResult {
  readonly result: MultimodalSemanticResult;
  readonly provider: string;
  readonly model: string;
}

export interface SpeechAdapterInput {
  readonly text: string;
  readonly language: DetectedLanguage;
  readonly voice: string;
  readonly format: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}

export interface SpeechAdapterResult {
  readonly bytes: Buffer;
  readonly mimeType: string;
  readonly provider: string;
  readonly model: string;
}

export interface MultimodalAdapter {
  process(input: MultimodalProcessAdapterInput): Promise<MultimodalProcessAdapterResult>;
  speech(input: SpeechAdapterInput): Promise<SpeechAdapterResult>;
}
