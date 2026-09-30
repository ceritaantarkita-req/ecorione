/** Explicit native Ollama adapter. Keeps OpenAI-compatible runtimes separate. */
import type { TokenUsage } from "@ecorione/shared-telemetry";
import { ProviderError } from "./errors.js";
import {
  localChatMessages,
  localGenerationControls,
  type LocalCallInput,
  type LocalCallResult,
} from "./local.js";

interface OllamaChatResponse {
  readonly model?: string;
  readonly message?: { readonly content?: string };
  readonly prompt_eval_count?: number;
  readonly eval_count?: number;
}

export function ollamaApiBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const path = url.pathname.replace(/\/+$/u, "");
  url.pathname = path.endsWith("/v1") ? path.slice(0, -"/v1".length) : path;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/u, "");
}

export async function callOllama(
  input: LocalCallInput,
  signal?: AbortSignal,
): Promise<LocalCallResult> {
  const controls = localGenerationControls();
  const body = {
    model: input.modelTag,
    messages: localChatMessages(input),
    stream: false,
    // Native Ollama supports this control for thinking models. Keep Local chat responsive.
    think: controls.reasoning_effort !== undefined && controls.reasoning_effort !== "none",
    ...(controls.max_tokens === undefined && controls.temperature === undefined
      ? {}
      : {
          options: {
            ...(controls.max_tokens === undefined ? {} : { num_predict: controls.max_tokens }),
            ...(controls.temperature === undefined
              ? {}
              : { temperature: controls.temperature }),
          },
        }),
  };
  let response: Response;
  try {
    response = await fetch(`${ollamaApiBaseUrl(input.baseUrl)}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      redirect: "error",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    throw new ProviderError(
      "local",
      `Tidak bisa menghubungi Ollama di ${input.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      "unreachable",
    );
  }
  const text = await response.text();
  let parsed: OllamaChatResponse;
  try {
    parsed = text.length === 0 ? {} : (JSON.parse(text) as OllamaChatResponse);
  } catch {
    throw new ProviderError("local", `Respons Ollama bukan JSON valid: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new ProviderError(
      "local",
      `Ollama membalas status ${String(response.status)}: ${text.slice(0, 400)}`,
    );
  }
  const reply = parsed.message?.content?.trim();
  if (!reply) throw new ProviderError("local", "Ollama tidak mengembalikan isi balasan.");
  const usage: TokenUsage = {
    inputTokens: parsed.prompt_eval_count ?? 0,
    outputTokens: parsed.eval_count ?? 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  return { reply, model: parsed.model ?? input.modelTag, usage };
}
