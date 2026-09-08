/**
 * Span OTel GenAI — `prd.md` §8 (Observability), `research.md` §2.6.
 *
 * Paket ini **tidak** menarik SDK OpenTelemetry: yang dihasilkan objek terstruktur biasa
 * yang bisa diserahkan ke exporter apa pun (atau ditulis apa adanya ke trace store RnD).
 * Alasannya bukan alergi dependensi — status standarnya masih bergerak, jadi biaya
 * mengikat diri ke satu SDK lebih besar daripada manfaatnya di v1.
 *
 * **Peringatan stabilitas:** seluruh atribut `gen_ai.*` masih berstatus *Development* dan
 * sudah pernah rename breaking (`gen_ai.system` → `gen_ai.provider.name`, `prompt_tokens`
 * → `input_tokens`). Pemetaan di bawah **diharapkan bermigrasi**; itu sebabnya nama
 * atribut dikonstankan di sini dan tidak ditulis inline di seluruh repo.
 */

import type { CallCostRecord, TokenUsage } from "./cost.js";

/**
 * Atribut standar. Dua yang pertama wajib; sisanya recommended.
 */
export const GEN_AI_ATTR = {
  operationName: "gen_ai.operation.name",
  providerName: "gen_ai.provider.name",
  requestModel: "gen_ai.request.model",
  responseModel: "gen_ai.response.model",
  finishReasons: "gen_ai.response.finish_reasons",
  conversationId: "gen_ai.conversation.id",
  errorType: "error.type",
  inputTokens: "gen_ai.usage.input_tokens",
  outputTokens: "gen_ai.usage.output_tokens",
} as const;

/**
 * Namespace sendiri untuk dua lubang di konvensi: **tidak ada atribut biaya standar**, dan
 * konvensi belum memodelkan token ter-cache sama sekali. Prefiks `ecorione.` dipakai supaya
 * jelas mana yang standar dan mana yang milik kita saat standarnya nanti berubah.
 */
export const ECORIONE_ATTR = {
  costActualUsd: "ecorione.cost.actual_usd",
  costNaiveUsd: "ecorione.cost.naive_usd",
  costSavedUsd: "ecorione.cost.saved_usd",
  cacheReadTokens: "ecorione.usage.cache_read_tokens",
  cacheWriteTokens: "ecorione.usage.cache_write_tokens",
  optimizerOverheadMs: "ecorione.optimizer.overhead_ms",
  routeReason: "ecorione.route.reason",
} as const;

export const GEN_AI_OPERATIONS = [
  "chat",
  "generate_content",
  "embeddings",
  "execute_tool",
  "invoke_agent",
] as const;
export type GenAiOperation = (typeof GEN_AI_OPERATIONS)[number];

/**
 * Nilai well-known `gen_ai.provider.name`. Bukan enum tertutup — provider lokal (`ollama`,
 * `llama.cpp`) tidak ada di daftar standar tapi tetap harus bisa ditulis.
 */
export const GEN_AI_PROVIDERS = [
  "anthropic",
  "openai",
  "azure.ai.openai",
  "gcp.gemini",
  "deepseek",
  "ollama",
] as const;

export type SpanAttributeValue = string | number | boolean | readonly string[];

export interface GenAiSpan {
  readonly name: string;
  readonly attributes: Readonly<Record<string, SpanAttributeValue>>;
}

export interface GenAiSpanInput {
  readonly operation: GenAiOperation;
  readonly provider: string;
  readonly requestModel?: string;
  readonly responseModel?: string;
  readonly finishReasons?: readonly string[];
  readonly conversationId?: string;
  /** Diisi hanya kalau panggilan gagal; nilainya tipe error, bukan pesannya. */
  readonly errorType?: string;
  /** Dipakai kalau `cost` tidak ada — mis. panggilan yang belum lewat cost ledger. */
  readonly usage?: TokenUsage;
  readonly cost?: CallCostRecord;
}

/**
 * Nama span mengikuti konvensi `{operation} {request model}`. Model masuk ke nama, bukan
 * cuma ke atribut, supaya trace bisa dibaca tanpa membuka atributnya satu per satu.
 */
export function buildGenAiSpan(input: GenAiSpanInput): GenAiSpan {
  const requestModel = input.requestModel ?? input.cost?.model;
  const usage = input.cost?.usage ?? input.usage;

  // Atribut bernilai `undefined` tidak boleh ikut: sebagian exporter menuliskannya sebagai
  // string "undefined" dan mencemari query di backend trace.
  const attributes: Record<string, SpanAttributeValue> = {
    [GEN_AI_ATTR.operationName]: input.operation,
    [GEN_AI_ATTR.providerName]: input.provider,
  };

  if (requestModel !== undefined) attributes[GEN_AI_ATTR.requestModel] = requestModel;
  if (input.responseModel !== undefined) {
    attributes[GEN_AI_ATTR.responseModel] = input.responseModel;
  }
  if (input.finishReasons !== undefined) {
    attributes[GEN_AI_ATTR.finishReasons] = [...input.finishReasons];
  }
  if (input.conversationId !== undefined) {
    attributes[GEN_AI_ATTR.conversationId] = input.conversationId;
  }
  if (input.errorType !== undefined) attributes[GEN_AI_ATTR.errorType] = input.errorType;

  if (usage !== undefined) {
    attributes[GEN_AI_ATTR.inputTokens] = usage.inputTokens;
    attributes[GEN_AI_ATTR.outputTokens] = usage.outputTokens;
    attributes[ECORIONE_ATTR.cacheReadTokens] = usage.cacheReadTokens;
    attributes[ECORIONE_ATTR.cacheWriteTokens] = usage.cacheWriteTokens;
  }

  const cost = input.cost;
  if (cost !== undefined) {
    attributes[ECORIONE_ATTR.costActualUsd] = cost.actualUsd;
    attributes[ECORIONE_ATTR.costNaiveUsd] = cost.naiveUsd;
    attributes[ECORIONE_ATTR.costSavedUsd] = cost.savedUsd;
    attributes[ECORIONE_ATTR.optimizerOverheadMs] = cost.optimizerOverheadMs;
    attributes[ECORIONE_ATTR.routeReason] = cost.routeReason;
  }

  const name =
    requestModel === undefined ? input.operation : `${input.operation} ${requestModel}`;
  return { name, attributes };
}

export interface TraceSink {
  emit(span: GenAiSpan): void;
}

/**
 * JSON Lines: satu objek JSON per baris. I/O sengaja diinjeksikan lewat `write` — paket ini
 * tidak menyentuh `fs`, jadi sink yang sama bisa menulis ke file, stdout, atau array di test.
 */
export class JsonlTraceSink implements TraceSink {
  readonly #write: (line: string) => void;

  constructor(write: (line: string) => void) {
    this.#write = write;
  }

  /** Baris diserahkan **tanpa terminator**; pemanggil yang menambahkan newline. */
  emit(span: GenAiSpan): void {
    this.#write(JSON.stringify({ name: span.name, attributes: span.attributes }));
  }
}
