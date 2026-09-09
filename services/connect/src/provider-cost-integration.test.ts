import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { ExactMatchCache } from "./cache.js";
import { complete } from "./complete.js";
import { NOW, OPERATION_ID, prefix } from "./test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

describe("OpenRouter provider-reported cost integration", () => {
  it("settles durable budget dengan usage.cost provider, bukan price-table estimate", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const openrouter = agent.get("https://openrouter.ai");
    setGlobalDispatcher(agent);
    openrouter.intercept({ path: "/api/v1/chat/completions", method: "POST" }).reply(200, {
      model: "anthropic/claude-sonnet-4.5",
      choices: [{ message: { content: "router billed" } }],
      usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0042 },
    });

    let settledActualUsd: number | undefined;
    const result = await complete(
      {
        hostedProvider: "openrouter",
        anthropicApiKey: undefined,
        openrouterApiKey: "router-test-key",
        localBaseUrl: "http://127.0.0.1:11434/v1",
        localModelTag: "qwen3:8b-instruct-q4_K_M",
        cache: new ExactMatchCache(),
        hostedCallsEnabled: true,
        spendBudget: {
          reserve(input) {
            expect(input.provider).toBe("openrouter");
            return {
              reservationId: "spend_33333333333333333333333333333333",
              operationId: input.operationId,
              provider: input.provider,
              model: input.model,
              reservedUsd: input.reservedUsd,
              actualUsd: null,
              status: "reserved",
              createdAt: input.now,
              settledAt: null,
            };
          },
          settle(reservationId, actualUsd, now) {
            settledActualUsd = actualUsd;
            return {
              reservationId,
              operationId: OPERATION_ID,
              provider: "openrouter",
              model: "claude-sonnet-4-5-20250929",
              reservedUsd: 1,
              actualUsd,
              status: "settled",
              createdAt: NOW,
              settledAt: now,
            };
          },
          markUncertain() {
            throw new Error("markUncertain must not run on provider success");
          },
        },
      },
      {
        target: "hosted",
        prefix: prefix(),
        dynamicText: "",
        userMessage: "cost truth",
        sensitivity: "INTERNAL",
        operationId: OPERATION_ID,
        now: NOW,
      },
    );

    expect(result.provider).toBe("openrouter");
    expect(result.cost.actualUsd).toBe(0.0042);
    expect(result.budget?.actualUsd).toBe(0.0042);
    expect(settledActualUsd).toBe(0.0042);
  });
});
