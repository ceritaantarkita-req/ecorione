import { describe, expect, it } from "vitest";
import type { CustomOpenAiConfig } from "../runtime-settings.js";
import { callCustomOpenAi, estimateCustomOpenAiReservationUsd } from "./custom-openai.js";

const config: CustomOpenAiConfig = {
  name: "Acme AI",
  baseUrl: "https://api.example.com/v1",
  model: "acme-chat-1",
  inputUsdPerMTok: 1,
  outputUsdPerMTok: 3,
  validatedAt: "2026-10-01T00:00:00.000Z",
};

const prefix = {
  systemPrompt: "Answer briefly.",
  toolDefinitions: [],
  coreMemory: { blocks: [] },
};

describe("custom OpenAI-compatible provider", () => {
  it("dispatches exact configured model without leaking the secret", async () => {
    let seenAuthorization = "";
    let seenModel = "";
    const result = await callCustomOpenAi({
      config,
      apiKey: "synthetic-custom-secret",
      model: config.model,
      prefix,
      dynamicText: "",
      userMessage: "hello",
      transport: async (request) => {
        seenAuthorization = request.headers.authorization ?? "";
        seenModel = String((JSON.parse(request.body) as { model?: unknown }).model ?? "");
        return new Response(
          JSON.stringify({
            model: config.model,
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    expect(seenAuthorization).toBe("Bearer synthetic-custom-secret");
    expect(seenModel).toBe(config.model);
    expect(result).toMatchObject({
      reply: "ok",
      model: config.model,
      providerReportedActualUsd: 0.000016,
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-custom-secret");
  });

  it("rejects a model that differs from the validated configuration", async () => {
    await expect(
      callCustomOpenAi({
        config,
        apiKey: "synthetic-custom-secret",
        model: "other-model",
        prefix,
        dynamicText: "",
        userMessage: "hello",
      }),
    ).rejects.toThrow(/tidak cocok/);
  });

  it("derives a positive bounded pre-dispatch reservation from operator pricing", () => {
    expect(
      estimateCustomOpenAiReservationUsd({
        config,
        model: config.model,
        prefix,
        dynamicText: "",
        userMessage: "hello",
      }),
    ).toBeGreaterThan(0);
  });
});
