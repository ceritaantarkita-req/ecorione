import { createServer } from "@ecorione/shared-server";
import { afterEach, describe, expect, it } from "vitest";
import { buildConnectServer } from "./http.js";

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(closeables.splice(0).map(async (item) => item.close()));
});

describe("Connect operations telemetry", () => {
  it("menjalankan local provider canary melalui completion boundary dan merekam metrics", async () => {
    const local = createServer({ name: "fake-local" });
    local.post("/v1/chat/completions", async () => ({
      model: "local-test-pinned",
      choices: [{ message: { content: "ECORIONE_CANARY_OK" } }],
      usage: { prompt_tokens: 7, completion_tokens: 3 },
    }));
    await local.listen({ host: "127.0.0.1", port: 0 });
    closeables.push(local);
    const address = local.server.address();
    if (address === null || typeof address === "string")
      throw new Error("fake local address gagal");

    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: `http://127.0.0.1:${String(address.port)}/v1`,
      localModelTag: "local-test-pinned",
      hostedCallsEnabled: false,
    });
    closeables.push(connect);

    const canary = await connect.inject({
      method: "POST",
      url: "/v1/ops/provider-canary",
      headers: { authorization: "Bearer ops-token" },
      payload: {
        target: "local",
        expectedSubstring: "ECORIONE_CANARY_OK",
        minOutputChars: 5,
        maxLatencyMs: 10_000,
      },
    });
    expect(canary.statusCode).toBe(200);
    expect(canary.json()).toMatchObject({
      pass: true,
      provider: "local",
      model: "local/qwen3-8b-instruct-q4_k_m",
      responseModel: "local-test-pinned",
      expectedSubstringMatched: true,
      usage: { inputTokens: 7, outputTokens: 3 },
    });

    const metrics = await connect.inject({
      method: "GET",
      url: "/v1/ops/observability",
      headers: { authorization: "Bearer ops-token" },
    });
    const counters = (metrics.json() as { counters: Array<{ name: string; value: number }> })
      .counters;
    expect(
      counters.some(
        (item) => item.name === "ecorione_provider_canary_total" && item.value === 1,
      ),
    ).toBe(true);
    expect(
      counters.some(
        (item) => item.name === "ecorione_model_input_tokens_total" && item.value === 7,
      ),
    ).toBe(true);
  });

  it("canary quality floor melaporkan pass=false tanpa mengubah provider result", async () => {
    const local = createServer({ name: "fake-local" });
    local.post("/v1/chat/completions", async () => ({
      model: "local-test-pinned",
      choices: [{ message: { content: "wrong response" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }));
    await local.listen({ host: "127.0.0.1", port: 0 });
    closeables.push(local);
    const address = local.server.address();
    if (address === null || typeof address === "string")
      throw new Error("fake local address gagal");
    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: `http://127.0.0.1:${String(address.port)}/v1`,
      localModelTag: "local-test-pinned",
      hostedCallsEnabled: false,
    });
    closeables.push(connect);
    const canary = await connect.inject({
      method: "POST",
      url: "/v1/ops/provider-canary",
      headers: { authorization: "Bearer ops-token" },
      payload: { target: "local", expectedSubstring: "ECORIONE_CANARY_OK" },
    });
    expect(canary.statusCode).toBe(200);
    expect(canary.json()).toMatchObject({ pass: false, expectedSubstringMatched: false });
  });
});
