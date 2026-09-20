import { createServer } from "@ecorione/shared-server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildConnectServer } from "./http.js";

const closeables: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(closeables.splice(0).map(async (item) => item.close()));
});

describe("Connect operations telemetry", () => {
  it("discovers configured local model without running an inference canary", async () => {
    let seenUrl = "";
    let seenMethod = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        seenUrl = String(input);
        seenMethod = init?.method ?? "GET";
        return new Response(
          JSON.stringify({
            data: [
              { id: "local-test-pinned" },
              { id: "another-local-model" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "local-test-pinned",
      hostedCallsEnabled: false,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const status = await connect.inject({
      method: "GET",
      url: "/v1/settings/local-runtime/status",
      headers: { authorization: "Bearer ops-token" },
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      state: "connected",
      reachable: true,
      ready: true,
      configuredModel: "local-test-pinned",
      models: ["local-test-pinned", "another-local-model"],
    });
    expect(seenUrl).toBe("http://127.0.0.1:11434/v1/models");
    expect(seenMethod).toBe("GET");
  });

  it("discovers a transient local candidate without persisting runtime settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/v1/models")) {
          return new Response(JSON.stringify({ data: [{ id: "candidate-model" }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("not supported", { status: 404 });
      }),
    );

    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "saved-model",
      hostedCallsEnabled: false,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const status = await connect.inject({
      method: "POST",
      url: "/v1/settings/local-runtime/status",
      headers: { authorization: "Bearer ops-token" },
      payload: {
        localRuntime: "openai-compatible",
        localBaseUrl: "http://127.0.0.1:1234/v1",
        localModelTag: "candidate-model",
      },
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      state: "connected",
      ready: true,
      configuredModel: "candidate-model",
    });

    const saved = await connect.inject({
      method: "GET",
      url: "/v1/settings/local-runtime/status",
      headers: { authorization: "Bearer ops-token" },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      state: "model-missing",
      configuredModel: "saved-model",
    });
  });

  it("rejects public local discovery targets before network access", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModelTag: "saved-model",
      hostedCallsEnabled: false,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const status = await connect.inject({
      method: "POST",
      url: "/v1/settings/local-runtime/status",
      headers: { authorization: "Bearer ops-token" },
      payload: {
        localRuntime: "openai-compatible",
        localBaseUrl: "https://example.com/v1",
        localModelTag: "candidate-model",
      },
    });

    expect(status.statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("menjalankan local provider canary fresh tanpa exact-cache reuse", async () => {
    let providerCalls = 0;
    const local = createServer({ name: "fake-local" });
    local.post("/v1/chat/completions", async () => {
      providerCalls += 1;
      return {
        model: "local-test-pinned",
        choices: [{ message: { content: "ECORIONE_CANARY_OK" } }],
        usage: { prompt_tokens: 7, completion_tokens: 3 },
      };
    });
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
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    for (let index = 0; index < 2; index += 1) {
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
        model: "local-test-pinned",
        pricingModel: "local/provider-token-zero",
        responseModel: "local-test-pinned",
        cacheHit: false,
        expectedSubstringMatched: true,
        usage: { inputTokens: 7, outputTokens: 3 },
      });
    }
    expect(providerCalls).toBe(2);

    const metrics = await connect.inject({
      method: "GET",
      url: "/v1/ops/observability",
      headers: { authorization: "Bearer ops-token" },
    });
    const counters = (metrics.json() as { counters: Array<{ name: string; value: number }> })
      .counters;
    expect(
      counters.some(
        (item) => item.name === "ecorione_provider_canary_total" && item.value === 2,
      ),
    ).toBe(true);
    expect(
      counters.some(
        (item) => item.name === "ecorione_model_input_tokens_total" && item.value === 14,
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
      hostedSpendUnlimited: true,
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

  it("hosted canary membedakan credential yang belum tersedia", async () => {
    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: "http://127.0.0.1:1/v1",
      localModelTag: "unused",
      hostedCallsEnabled: true,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const canary = await connect.inject({
      method: "POST",
      url: "/v1/ops/provider-canary",
      headers: { authorization: "Bearer ops-token" },
      payload: { target: "hosted" },
    });
    expect(canary.statusCode).toBe(502);
    expect(canary.json().error.type).toBe("PROVIDER_CREDENTIAL_MISSING");
  });

  it("menguji credential hosted secara transient tanpa menyimpannya ke Vault", async () => {
    let authorization: string | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        expect(input).toBe("https://api.openai.com/v1/chat/completions");
        authorization = new Headers(init?.headers).get("authorization");
        return new Response(
          JSON.stringify({
            model: "gpt-5.6-terra",
            choices: [{ message: { content: "ECORIONE_CREDENTIAL_OK" } }],
            usage: { prompt_tokens: 5, completion_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const connect = buildConnectServer({
      token: "ops-token",
      hostedProvider: "openai",
      localBaseUrl: "http://127.0.0.1:1/v1",
      localModelTag: "unused",
      hostedCallsEnabled: true,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const probe = await connect.inject({
      method: "POST",
      url: "/v1/settings/credentials/openai/test",
      headers: { authorization: "Bearer ops-token" },
      payload: { secret: "transient-secret" },
    });
    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toMatchObject({
      pass: true,
      persisted: false,
      provider: "openai",
      model: "gpt-5.6-terra",
      responseModel: "gpt-5.6-terra",
      cacheHit: false,
    });
    expect(authorization).toBe("Bearer transient-secret");

    const metadata = await connect.inject({
      method: "GET",
      url: "/v1/settings/credentials",
      headers: { authorization: "Bearer ops-token" },
    });
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toEqual({ available: false, credentials: [] });
  });

  it("menguji key sebelum durable hosted route diaktifkan saat operator gate terbuka", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              model: "gpt-5.6-terra",
              choices: [{ message: { content: "ECORIONE_CREDENTIAL_OK" } }],
              usage: { prompt_tokens: 4, completion_tokens: 2 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const runtimeSettings = {
      get: () => ({
        revision: 0,
        settings: {
          hostedProvider: "openai" as const,
          hostedModel: "governed" as const,
          localRuntime: "openai-compatible" as const,
          localBaseUrl: "http://127.0.0.1:1/v1",
          localModelTag: "unused",
          localModelDigest: null,
          hostedCallsEnabled: false,
          defaultChatTarget: "local" as const,
        },
      }),
      update: () => {
        throw new Error("not used");
      },
    };

    const connect = buildConnectServer({
      token: "ops-token",
      runtimeSettings,
      hostedProvider: "openai",
      localBaseUrl: "http://127.0.0.1:1/v1",
      localModelTag: "unused",
      hostedCallsEnabled: true,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const probe = await connect.inject({
      method: "POST",
      url: "/v1/settings/credentials/openai/test",
      headers: { authorization: "Bearer ops-token" },
      payload: { secret: "transient-secret" },
    });

    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toMatchObject({
      pass: true,
      persisted: false,
      provider: "openai",
      model: "gpt-5.6-terra",
    });
    expect(runtimeSettings.get().settings.hostedCallsEnabled).toBe(false);
  });

  it("menolak transient credential test untuk provider yang belum routing-ready", async () => {
    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: "http://127.0.0.1:1/v1",
      localModelTag: "unused",
      hostedCallsEnabled: true,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const probe = await connect.inject({
      method: "POST",
      url: "/v1/settings/credentials/kimi/test",
      headers: { authorization: "Bearer ops-token" },
      payload: { secret: "not-used" },
    });
    expect(probe.statusCode).toBe(400);
  });

  it("local canary membedakan runtime provider yang tidak bisa dihubungi", async () => {
    const connect = buildConnectServer({
      token: "ops-token",
      localBaseUrl: "http://127.0.0.1:1/v1",
      localModelTag: "local-test-pinned",
      hostedCallsEnabled: false,
      hostedSpendUnlimited: true,
    });
    closeables.push(connect);

    const canary = await connect.inject({
      method: "POST",
      url: "/v1/ops/provider-canary",
      headers: { authorization: "Bearer ops-token" },
      payload: { target: "local" },
    });
    expect(canary.statusCode).toBe(503);
    expect(canary.json().error.type).toBe("PROVIDER_UNREACHABLE");
  });
});
