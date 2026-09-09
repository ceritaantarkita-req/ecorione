import {
  MultimodalSemanticResultSchema,
  type MultimodalSemanticResult,
} from "@ecorione/shared-schema";
import { z } from "zod";
import { detectIdEnLanguage } from "./language.js";
import { MultimodalAdapterUnavailableError, MultimodalProviderError } from "./errors.js";
import type {
  MultimodalAdapter,
  MultimodalProcessAdapterInput,
  MultimodalProcessAdapterResult,
  SpeechAdapterInput,
  SpeechAdapterResult,
} from "./types.js";

const ProcessResponseSchema = z
  .object({
    result: MultimodalSemanticResultSchema,
    model: z.string().min(1).optional(),
  })
  .strict();
const SpeechResponseSchema = z
  .object({
    audioBase64: z.string().min(1),
    mimeType: z.string().min(1),
    model: z.string().min(1).optional(),
  })
  .strict();

function assertLoopback(baseUrl: string): URL {
  const url = new URL(baseUrl);
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "[::1]" && hostname !== "::1") {
    throw new MultimodalAdapterUnavailableError(
      `Local multimodal endpoint harus loopback, diterima ${url.origin}.`,
    );
  }
  return url;
}

async function postJson(url: URL, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new MultimodalAdapterUnavailableError(
      `Local multimodal adapter tidak tersedia: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const raw = await response.text();
  if (!response.ok) {
    throw new MultimodalProviderError(
      `Local multimodal adapter membalas ${String(response.status)}: ${raw.slice(0, 512)}`,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new MultimodalProviderError("Respons local multimodal bukan JSON valid.");
  }
}

function normalizeLanguage(result: MultimodalSemanticResult): MultimodalSemanticResult {
  if (result.language !== "unknown") return result;
  return { ...result, language: detectIdEnLanguage(result.text) };
}

export class HttpLocalMultimodalAdapter implements MultimodalAdapter {
  private readonly base: URL;
  constructor(baseUrl: string) {
    this.base = assertLoopback(baseUrl);
  }

  async process(input: MultimodalProcessAdapterInput): Promise<MultimodalProcessAdapterResult> {
    const url = new URL("./v1/process", this.base.href.endsWith("/") ? this.base : `${this.base.href}/`);
    const parsed = ProcessResponseSchema.parse(
      await postJson(url, {
        task: input.task,
        mimeType: input.mimeType,
        contentBase64: input.bytes.toString("base64"),
      }),
    );
    return {
      result: normalizeLanguage(parsed.result),
      provider: "local",
      model: parsed.model ?? "local/multimodal-adapter",
    };
  }

  async speech(input: SpeechAdapterInput): Promise<SpeechAdapterResult> {
    const url = new URL("./v1/speech", this.base.href.endsWith("/") ? this.base : `${this.base.href}/`);
    const parsed = SpeechResponseSchema.parse(
      await postJson(url, {
        text: input.text,
        language: input.language,
        voice: input.voice,
        format: input.format,
      }),
    );
    return {
      bytes: Buffer.from(parsed.audioBase64, "base64"),
      mimeType: parsed.mimeType,
      provider: "local",
      model: parsed.model ?? "local/tts-adapter",
    };
  }
}
