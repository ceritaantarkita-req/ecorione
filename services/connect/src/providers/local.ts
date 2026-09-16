/** OpenAI-compatible local adapter. */
import { renderCoreMemoryData, type StablePrefix } from "@ecorione/context-assembly";
import type { TokenUsage } from "@ecorione/shared-telemetry";
import { ProviderError } from "./errors.js";

const LIVE_REQUEST_NOTE =
  "The final user message is the live request. Follow it directly. If it asks for an exact string, return exactly that string and nothing else.";
const LOCAL_REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "max"]);

export interface LocalCallInput {
  readonly baseUrl: string;
  readonly modelTag: string;
  readonly prefix: StablePrefix;
  readonly dynamicText: string;
  readonly userMessage: string;
}
export interface LocalCallResult {
  readonly reply: string;
  readonly model: string;
  readonly usage: TokenUsage;
}
interface OpenAiChatResponseBody {
  readonly model?: string;
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string } }>;
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

export interface LocalGenerationControls {
  readonly reasoning_effort?: "none" | "low" | "medium" | "high" | "max";
  readonly max_tokens?: number;
  readonly temperature?: number;
}

/**
 * Optional operator controls for OpenAI-compatible local runtimes.
 *
 * These are intentionally opt-in: runtimes that do not implement the corresponding
 * OpenAI-compatible fields keep the old request shape when the variables are unset.
 * The W17 extraction benchmark can use them to bound thinking/output without changing
 * the model alias or immutable digest being measured.
 */
export function localGenerationControls(
  env: NodeJS.ProcessEnv = process.env,
): LocalGenerationControls {
  const controls: {
    reasoning_effort?: "none" | "low" | "medium" | "high" | "max";
    max_tokens?: number;
    temperature?: number;
  } = {};

  const reasoning = env.ECORIONE_LOCAL_REASONING_EFFORT?.trim().toLowerCase();
  if (reasoning) {
    if (!LOCAL_REASONING_EFFORTS.has(reasoning)) {
      throw new Error(
        "ECORIONE_LOCAL_REASONING_EFFORT harus salah satu none|low|medium|high|max",
      );
    }
    controls.reasoning_effort = reasoning as LocalGenerationControls["reasoning_effort"];
  }

  const maxTokensRaw = env.ECORIONE_LOCAL_MAX_TOKENS?.trim();
  if (maxTokensRaw) {
    const maxTokens = Number(maxTokensRaw);
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 32_768) {
      throw new Error("ECORIONE_LOCAL_MAX_TOKENS harus integer 1..32768");
    }
    controls.max_tokens = maxTokens;
  }

  const temperatureRaw = env.ECORIONE_LOCAL_TEMPERATURE?.trim();
  if (temperatureRaw) {
    const temperature = Number(temperatureRaw);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error("ECORIONE_LOCAL_TEMPERATURE harus angka 0..2");
    }
    controls.temperature = temperature;
  }

  return controls;
}

function buildContextContent(input: LocalCallInput): string {
  const parts: string[] = [];
  if (input.prefix.coreMemory.blocks.length > 0)
    parts.push(renderCoreMemoryData(input.prefix.coreMemory));
  if (input.dynamicText.length > 0) parts.push(input.dynamicText);
  return parts.join("\n\n");
}
export async function callLocal(
  input: LocalCallInput,
  signal?: AbortSignal,
): Promise<LocalCallResult> {
  const contextContent = buildContextContent(input);
  const body = {
    model: input.modelTag,
    messages: [
      { role: "system", content: `${input.prefix.systemPrompt} ${LIVE_REQUEST_NOTE}` },
      ...(contextContent.length === 0 ? [] : [{ role: "user", content: contextContent }]),
      { role: "user", content: input.userMessage },
    ],
    ...localGenerationControls(),
  };
  let res: Response;
  try {
    res = await fetch(`${input.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (err) {
    throw new ProviderError(
      "local",
      `Tidak bisa menghubungi model lokal di ${input.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      "unreachable",
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
  if (!res.ok)
    throw new ProviderError(
      "local",
      `Model lokal membalas status ${String(res.status)}: ${text.slice(0, 400)}`,
    );
  const usage = parsed.usage ?? {};
  return {
    reply: parsed.choices?.[0]?.message?.content ?? "",
    model: parsed.model ?? input.modelTag,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  };
}
