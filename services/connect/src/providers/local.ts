/**
 * Adapter local — Ollama-compatible (`docs/api-fase1.md` §Connect "Adapter provider").
 * Format OpenAI chat-completions. Tidak ada cache provider di sini — `cacheReadTokens`/
 * `cacheWriteTokens` selalu 0 (Ollama tidak melaporkannya).
 */

import type { StablePrefix } from "@ecorione/context-assembly";
import type { TokenUsage } from "@ecorione/shared-telemetry";
import { ProviderError } from "./errors.js";

export interface LocalCallInput {
  readonly baseUrl: string;
  /** Tag model Ollama sungguhan (`ECORIONE_LOCAL_MODEL`) — bukan identitas biaya pin. */
  readonly modelTag: string;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}

export interface LocalCallResult {
  readonly reply: string;
  readonly usage: TokenUsage;
}

interface OpenAiChatResponseBody {
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string } }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
}

function buildUserContent(dynamicText: string, userMessage: string): string {
  return dynamicText.length > 0 ? `${dynamicText}\n\n${userMessage}` : userMessage;
}

/**
 * Tidak ada server lokal sungguhan dipanggil di test — semua test HTTP di sini mem-mock
 * `${baseUrl}` lewat `undici` `MockAgent` (lihat `local.test.ts`).
 */
export async function callLocal(input: LocalCallInput): Promise<LocalCallResult> {
  const body = {
    model: input.modelTag,
    messages: [
      { role: "system", content: input.prefix.systemPrompt },
      { role: "user", content: buildUserContent(input.dynamicText, input.userMessage) },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`${input.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ProviderError(
      "local",
      `Tidak bisa menghubungi model lokal di ${input.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  let parsed: OpenAiChatResponseBody;
  try {
    parsed = text.length === 0 ? {} : (JSON.parse(text) as OpenAiChatResponseBody);
  } catch {
    throw new ProviderError(
      "local",
      `Respons model lokal bukan JSON valid: ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok) {
    throw new ProviderError(
      "local",
      `Model lokal membalas status ${String(res.status)}: ${text.slice(0, 400)}`,
    );
  }

  const reply = parsed.choices?.[0]?.message?.content ?? "";
  const usage = parsed.usage ?? {};
  return {
    reply,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  };
}
