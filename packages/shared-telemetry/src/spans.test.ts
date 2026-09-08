import { describe, it, expect } from "vitest";
import { JsonlTraceSink, buildGenAiSpan, type GenAiSpan } from "./spans.js";
import { recordCall, tokenUsage } from "./cost.js";

const SONNET = "claude-sonnet-4-5-20250929";

function sampleSpan(): GenAiSpan {
  const cost = recordCall({
    model: SONNET,
    usage: tokenUsage({
      inputTokens: 1_000,
      outputTokens: 200,
      cacheReadTokens: 8_000,
      cacheWriteTokens: 0,
    }),
    routeReason: "prefix-hit",
    policyVersion: "2026.09.1",
    optimizerOverheadMs: 7,
  });

  return buildGenAiSpan({
    operation: "chat",
    provider: "anthropic",
    responseModel: SONNET,
    finishReasons: ["stop"],
    conversationId: "conv-1",
    cost,
  });
}

describe("buildGenAiSpan", () => {
  /**
   * Test yang mem-pin string atributnya secara harfiah. Atribut `gen_ai.*` masih berstatus
   * Development dan sudah pernah rename breaking; kalau pemetaan kita ikut bergeser, itu
   * harus jadi keputusan sadar yang mengubah test ini — bukan dashboard yang diam-diam
   * kosong.
   */
  it("memakai nama atribut persis seperti konvensi", () => {
    const span = sampleSpan();
    expect(Object.keys(span.attributes).sort()).toEqual([
      "ecorione.cost.actual_usd",
      "ecorione.cost.naive_usd",
      "ecorione.cost.saved_usd",
      "ecorione.optimizer.overhead_ms",
      "ecorione.route.reason",
      "ecorione.usage.cache_read_tokens",
      "ecorione.usage.cache_write_tokens",
      "gen_ai.conversation.id",
      "gen_ai.operation.name",
      "gen_ai.provider.name",
      "gen_ai.request.model",
      "gen_ai.response.finish_reasons",
      "gen_ai.response.model",
      "gen_ai.usage.input_tokens",
      "gen_ai.usage.output_tokens",
    ]);
  });

  it("mengisi atribut wajib walau tidak ada usage maupun cost", () => {
    const span = buildGenAiSpan({ operation: "embeddings", provider: "ollama" });
    expect(span.attributes["gen_ai.operation.name"]).toBe("embeddings");
    expect(span.attributes["gen_ai.provider.name"]).toBe("ollama");
    expect(span.name).toBe("embeddings");
  });

  it("nama span mengikuti pola `{operation} {request model}`", () => {
    expect(sampleSpan().name).toBe(`chat ${SONNET}`);
  });

  it("token ter-cache masuk namespace ecorione, bukan gen_ai", () => {
    // Konvensi OTel belum memodelkan token ter-cache sama sekali (research.md §2.6).
    const a = sampleSpan().attributes;
    expect(a["gen_ai.usage.input_tokens"]).toBe(1_000);
    expect(a["gen_ai.usage.output_tokens"]).toBe(200);
    expect(a["ecorione.usage.cache_read_tokens"]).toBe(8_000);
    expect(a["ecorione.usage.cache_write_tokens"]).toBe(0);
    expect(a["gen_ai.usage.cache_read_tokens"]).toBeUndefined();
  });

  it("biaya dan overhead optimizer ikut, karena tidak ada atribut biaya standar", () => {
    const a = sampleSpan().attributes;
    const actual = (1_000 * 3 + 8_000 * 0.3 + 200 * 15) / 1e6;
    expect(a["ecorione.cost.actual_usd"]).toBeCloseTo(actual, 12);
    expect(a["ecorione.cost.naive_usd"]).toBeCloseTo((9_000 * 3 + 200 * 15) / 1e6, 12);
    expect(a["ecorione.cost.saved_usd"]).toBeGreaterThan(0);
    expect(a["ecorione.optimizer.overhead_ms"]).toBe(7);
    expect(a["ecorione.route.reason"]).toBe("prefix-hit");
  });

  it("field opsional yang kosong tidak muncul sebagai atribut undefined", () => {
    const span = buildGenAiSpan({ operation: "chat", provider: "openai" });
    for (const [key, value] of Object.entries(span.attributes)) {
      expect(value, key).not.toBeUndefined();
    }
    expect("error.type" in span.attributes).toBe(false);
    expect("gen_ai.request.model" in span.attributes).toBe(false);
  });

  it("error.type diisi hanya saat panggilan gagal", () => {
    const span = buildGenAiSpan({
      operation: "chat",
      provider: "anthropic",
      requestModel: SONNET,
      errorType: "overloaded_error",
    });
    expect(span.attributes["error.type"]).toBe("overloaded_error");
  });

  it("finish reasons disalin, bukan direferensikan", () => {
    const reasons = ["stop"];
    const span = buildGenAiSpan({
      operation: "chat",
      provider: "anthropic",
      requestModel: SONNET,
      finishReasons: reasons,
    });
    reasons.push("length");
    expect(span.attributes["gen_ai.response.finish_reasons"]).toEqual(["stop"]);
  });
});

describe("JsonlTraceSink", () => {
  it("menulis satu objek JSON per baris tanpa newline di dalamnya", () => {
    const lines: string[] = [];
    const sink = new JsonlTraceSink((line) => lines.push(line));
    sink.emit(sampleSpan());
    sink.emit(buildGenAiSpan({ operation: "chat", provider: "openai" }));

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).not.toContain("\n");
      expect(() => JSON.parse(line)).not.toThrow();
    }
    const parsed = JSON.parse(lines[0] ?? "") as GenAiSpan;
    expect(parsed.name).toBe(`chat ${SONNET}`);
    expect(parsed.attributes["gen_ai.provider.name"]).toBe("anthropic");
  });
});
