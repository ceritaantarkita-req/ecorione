import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { ExactMatchCache } from "./cache.js";
import { complete, type CompleteDeps } from "./complete.js";
import { ProviderResponseError } from "./providers/errors.js";
import { NOW, OPERATION_ID, prefix } from "./test-helpers.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let openrouterPool: ReturnType<MockAgent["get"]>;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  openrouterPool = agent.get("https://openrouter.ai");
});

afterEach(() => setGlobalDispatcher(originalDispatcher));

function input() {
  return {
    target: "hosted" as const,
    prefix: prefix(),
    dynamicText: "full benchmark context",
    userMessage: "extract",
    sensitivity: "INTERNAL" as const,
    operationId: OPERATION_ID,
    now: NOW,
  };
}

function deps(spendBudget: CompleteDeps["spendBudget"]): CompleteDeps {
  return {
    anthropicApiKey: undefined,
    openrouterApiKey: "router-test-key",
    hostedProvider: "openrouter",
    localBaseUrl: "http://127.0.0.1:11434/v1",
    localModelTag: "qwen3:8b-instruct-q4_K_M",
    cache: new ExactMatchCache(),
    hostedCallsEnabled: true,
    spendBudget,
  };
}

describe("provider response settlement", () => {
  it("settles provider-reported billed cost when a HTTP-success completion is rejected", async () => {
    openrouterPool.intercept({ path: "/api/v1/chat/completions", method: "POST" }).reply(200, {
      model: "anthropic/claude-sonnet-4.5",
      choices: [{ finish_reason: "length", message: { content: "" } }],
      usage: { prompt_tokens: 321, completion_tokens: 0, cost: 0.00234 },
    });

    let settled: { reservationId: string; actualUsd: number } | undefined;
    let uncertainId: string | undefined;
    const reservationId = "spend_33333333333333333333333333333333";

    await expect(
      complete(
        deps({
          reserve(reservation) {
            return {
              reservationId,
              operationId: reservation.operationId,
              provider: "openrouter",
              model: reservation.model,
              reservedUsd: reservation.reservedUsd,
              actualUsd: null,
              status: "reserved",
              createdAt: reservation.now,
              settledAt: null,
            };
          },
          settle(id, actualUsd) {
            settled = { reservationId: id, actualUsd };
            return {
              reservationId: id,
              operationId: OPERATION_ID,
              provider: "openrouter",
              model: "claude-sonnet-4-5-20250929",
              reservedUsd: 0.1,
              actualUsd,
              status: "settled",
              createdAt: NOW,
              settledAt: NOW,
            };
          },
          markUncertain(id) {
            uncertainId = id;
            throw new Error("markUncertain must not run when billed cost is authoritative");
          },
        }),
        input(),
      ),
    ).rejects.toBeInstanceOf(ProviderResponseError);

    expect(settled).toEqual({ reservationId, actualUsd: 0.00234 });
    expect(uncertainId).toBeUndefined();
  });

  it("keeps reservation uncertain when billed-cost authority is unavailable", async () => {
    openrouterPool.intercept({ path: "/api/v1/chat/completions", method: "POST" }).reply(200, {
      model: "anthropic/claude-sonnet-4.5",
      choices: [{ finish_reason: "length", message: { content: "" } }],
      usage: { prompt_tokens: 321, completion_tokens: 0 },
    });

    let settled = false;
    let uncertainId: string | undefined;
    const reservationId = "spend_44444444444444444444444444444444";

    await expect(
      complete(
        deps({
          reserve(reservation) {
            return {
              reservationId,
              operationId: reservation.operationId,
              provider: "openrouter",
              model: reservation.model,
              reservedUsd: reservation.reservedUsd,
              actualUsd: null,
              status: "reserved",
              createdAt: reservation.now,
              settledAt: null,
            };
          },
          settle() {
            settled = true;
            throw new Error("settle must not run without billed authority");
          },
          markUncertain(id) {
            uncertainId = id;
            return {
              reservationId: id,
              operationId: OPERATION_ID,
              provider: "openrouter",
              model: "claude-sonnet-4-5-20250929",
              reservedUsd: 0.1,
              actualUsd: null,
              status: "uncertain",
              createdAt: NOW,
              settledAt: null,
            };
          },
        }),
        input(),
      ),
    ).rejects.toThrow("usage.cost");

    expect(settled).toBe(false);
    expect(uncertainId).toBe(reservationId);
  });
});
