import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { prefix } from "../test-helpers.js";
import { callOllama, ollamaApiBaseUrl } from "./ollama.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://127.0.0.1:11434");
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

describe("Ollama native local adapter", () => {
  it("uses native /api/chat and disables thinking by default", async () => {
    let body: unknown;
    pool.intercept({ path: "/api/chat", method: "POST" }).reply(200, (options) => {
      body = JSON.parse(options.body as string);
      return {
        model: "qwen3.5:9b",
        message: { content: "OK" },
        prompt_eval_count: 12,
        eval_count: 2,
      };
    });

    const result = await callOllama({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3.5:9b",
      prefix: prefix(),
      dynamicText: "",
      userMessage: "Reply exactly: OK",
    });

    expect(result).toMatchObject({ reply: "OK", model: "qwen3.5:9b" });
    expect(result.usage).toMatchObject({ inputTokens: 12, outputTokens: 2 });
    expect(body).toMatchObject({ model: "qwen3.5:9b", stream: false, think: false });
  });

  it("bounds extraction output and requires native JSON without changing normal chat", async () => {
    let payload: unknown;
    pool.intercept({ path: "/api/chat", method: "POST" }).reply(200, (options) => {
      payload = JSON.parse(options.body as string);
      return {
        model: "qwen3.5:9b",
        message: { content: '{"facts":[],"summaries":[]}' },
        prompt_eval_count: 12,
        eval_count: 13,
      };
    });

    const result = await callOllama({
      baseUrl: "http://127.0.0.1:11434/v1",
      modelTag: "qwen3.5:9b",
      localTask: "memory-extraction",
      prefix: prefix(),
      dynamicText: "",
      userMessage: "Extract durable facts.",
    });

    expect(result.reply).toBe('{"facts":[],"summaries":[]}');
    expect(payload).toMatchObject({
      model: "qwen3.5:9b",
      stream: false,
      think: false,
      format: "json",
      options: { num_predict: 768, temperature: 0 },
    });
  });

  it("maps an OpenAI-compatible base URL to Ollama native root", () => {
    expect(ollamaApiBaseUrl("http://127.0.0.1:11434/v1")).toBe("http://127.0.0.1:11434");
  });
});
