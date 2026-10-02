import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getGlobalDispatcher,
  MockAgent,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { proxyToConnectSettings } from "./settings-proxy";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalConnectUrl: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://connect.local");

  originalConnectUrl = process.env.ECORIONE_CONNECT_URL;
  originalToken = process.env.ECORIONE_INTERNAL_TOKEN;
  process.env.ECORIONE_CONNECT_URL = "http://connect.local";
  process.env.ECORIONE_INTERNAL_TOKEN = "test-token";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalConnectUrl === undefined) delete process.env.ECORIONE_CONNECT_URL;
  else process.env.ECORIONE_CONNECT_URL = originalConnectUrl;
  if (originalToken === undefined) delete process.env.ECORIONE_INTERNAL_TOKEN;
  else process.env.ECORIONE_INTERNAL_TOKEN = originalToken;
});

function request(method: string, body?: string): Request {
  return new Request("http://ai.local/api/settings/x", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body,
  });
}

describe("proxyToConnectSettings", () => {
  it("meneruskan provider catalog metadata dari Connect", async () => {
    pool.intercept({ path: "/v1/settings/providers", method: "GET" }).reply(200, {
      providers: [
        {
          id: "anthropic",
          displayName: "Claude / Anthropic",
          category: "ai",
          credentialPurpose: "messages",
          credentialReady: true,
          routingReady: true,
          connectionTestReady: true,
        },
      ],
    });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/providers",
      "GET",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      providers: [expect.objectContaining({ id: "anthropic", routingReady: true })],
    });
  });

  it("meneruskan query discovery OpenRouter yang dibatasi allowlist", async () => {
    pool
      .intercept({
        path: "/v1/settings/providers/openrouter/models?q=qwen&sourceProvider=qwen&limit=20&refresh=1",
        method: "GET",
      })
      .reply(200, {
        source: "openrouter:/api/v1/models",
        families: [
          { id: "gpt", displayName: "GPT" },
          { id: "gemini", displayName: "Gemini" },
          { id: "qwen", displayName: "Qwen" },
          { id: "deepseek", displayName: "DeepSeek" },
          { id: "kimi", displayName: "Kimi" },
          { id: "glm", displayName: "GLM" },
        ],
        cache: "refreshed",
        stale: false,
        fetchedAt: "2026-09-28T10:00:00.000Z",
        expiresAt: "2026-09-28T10:10:00.000Z",
        total: 1,
        returned: 1,
        models: [
          {
            id: "qwen/qwen3.8-max",
            displayName: "Qwen: Qwen3.8 Max",
            sourceProvider: "qwen",
            family: "qwen",
            admission: "verified-selectable",
            selectable: true,
            executable: false,
            selectionId: "qwen/qwen3.8-max",
            unavailableReason: null,
          },
        ],
      });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/providers/openrouter/models?q=qwen&sourceProvider=qwen&limit=20&refresh=1",
      "GET",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      families: expect.arrayContaining([
        { id: "gpt", displayName: "GPT" },
        { id: "gemini", displayName: "Gemini" },
        { id: "qwen", displayName: "Qwen" },
        { id: "deepseek", displayName: "DeepSeek" },
        { id: "kimi", displayName: "Kimi" },
        { id: "glm", displayName: "GLM" },
      ]),
      cache: "refreshed",
      models: [
        expect.objectContaining({
          id: "qwen/qwen3.8-max",
          family: "qwen",
          admission: "verified-selectable",
          selectable: true,
          executable: false,
          selectionId: "qwen/qwen3.8-max",
          unavailableReason: null,
        }),
      ],
    });
  });

  it("meneruskan mutation OpenRouter model selection hanya ke endpoint admission", async () => {
    let sawBody = "";
    pool
      .intercept({
        path: "/v1/settings/providers/openrouter/model-selection",
        method: "PUT",
      })
      .reply(200, (opts) => {
        sawBody = String(opts.body ?? "");
        return {
          runtime: {
            revision: 2,
            settings: {
              hostedProvider: "openrouter",
              hostedModel: "governed",
              openRouterModelSelection: "qwen/qwen3.8-max",
              hostedCallsEnabled: false,
              defaultChatTarget: "local",
            },
          },
          selection: {
            id: "qwen/qwen3.8-max",
            admission: "verified-selectable",
            executable: false,
            active: false,
            unavailableReason: null,
          },
        };
      });

    const response = await proxyToConnectSettings(
      request("PUT", JSON.stringify({ selectionId: "qwen/qwen3.8-max" })),
      "/v1/settings/providers/openrouter/model-selection",
      "PUT",
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(sawBody)).toEqual({ selectionId: "qwen/qwen3.8-max" });
    expect(await response.json()).toMatchObject({
      selection: { executable: false, active: false },
    });

    const get = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/providers/openrouter/model-selection",
      "GET",
    );
    expect(get.status).toBe(400);

    const query = await proxyToConnectSettings(
      request("PUT", JSON.stringify({ selectionId: "qwen/qwen3.8-max" })),
      "/v1/settings/providers/openrouter/model-selection?admin=true",
      "PUT",
    );
    expect(query.status).toBe(400);
  });

  it("menolak query discovery OpenRouter yang tidak diizinkan", async () => {
    const unknown = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/providers/openrouter/models?admin=true",
      "GET",
    );
    expect(unknown.status).toBe(400);

    const duplicate = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/providers/openrouter/models?q=qwen&q=glm",
      "GET",
    );
    expect(duplicate.status).toBe(400);

    const invalidLimit = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/providers/openrouter/models?limit=500",
      "GET",
    );
    expect(invalidLimit.status).toBe(400);
  });

  it("meneruskan GET token webhook terderivasi dan menolak method/query lain", async () => {
    const hookId = "hook_pcs06_webhook_0001";
    let sawAuth: string | undefined;
    pool
      .intercept({
        path: `/v1/settings/webhooks/${hookId}/token`,
        method: "GET",
      })
      .reply(200, (opts) => {
        sawAuth = (opts.headers as Record<string, string> | undefined)?.authorization;
        return { hookId, token: "derived-hook-token" };
      });

    const response = await proxyToConnectSettings(
      request("GET"),
      `/v1/settings/webhooks/${hookId}/token`,
      "GET",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hookId, token: "derived-hook-token" });
    expect(sawAuth).toBe("Bearer test-token");

    const post = await proxyToConnectSettings(
      request("POST", "{}"),
      `/v1/settings/webhooks/${hookId}/token`,
      "POST",
    );
    expect(post.status).toBe(400);

    const query = await proxyToConnectSettings(
      request("GET"),
      `/v1/settings/webhooks/${hookId}/token?admin=true`,
      "GET",
    );
    expect(query.status).toBe(400);
  });

  it("meneruskan status Local AI tanpa membuka path Connect lain", async () => {
    pool.intercept({ path: "/v1/settings/local-runtime/status", method: "GET" }).reply(200, {
      runtime: "openai-compatible",
      state: "unreachable",
      reachable: false,
      ready: false,
      configuredModel: "local-model",
      models: [],
      message: "Local AI · Not connected.",
    });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/local-runtime/status",
      "GET",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: "unreachable",
      ready: false,
    });
  });

  it("meneruskan GET MCP workspace query valid yang didukung Connect", async () => {
    let sawAuth: string | undefined;
    pool
      .intercept({
        path: "/v1/settings/mcp/servers?workspaceId=ws_personal",
        method: "GET",
      })
      .reply(200, (opts) => {
        sawAuth = (opts.headers as Record<string, string> | undefined)?.authorization;
        return { servers: [] };
      });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=ws_personal",
      "GET",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ servers: [] });
    expect(sawAuth).toBe("Bearer test-token");
  });

  it.each([
    "anthropic",
    "openai",
    "openrouter",
    "nvidia",
    "kimi",
    "gemini",
    "qwen",
    "glm",
    "custom-openai",
    "mcp",
  ])(
    "mengizinkan mutation credential provider %s yang termasuk kontrak Connect",
    async (provider) => {
      pool
        .intercept({ path: `/v1/settings/credentials/${provider}`, method: "PUT" })
        .reply(200, { provider });

      const response = await proxyToConnectSettings(
        request("PUT", JSON.stringify({ secret: "test-secret" })),
        `/v1/settings/credentials/${provider}`,
        "PUT",
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ provider });
    },
  );

  it("meneruskan transient credential test tanpa mengubah secret body", async () => {
    let sawAuth: string | undefined;
    let sawBody = "";
    pool
      .intercept({ path: "/v1/settings/credentials/openai/test", method: "POST" })
      .reply(200, (opts) => {
        sawAuth = (opts.headers as Record<string, string> | undefined)?.authorization;
        sawBody = String(opts.body ?? "");
        return { pass: true, persisted: false, provider: "openai" };
      });

    const response = await proxyToConnectSettings(
      request("POST", JSON.stringify({ secret: "transient-secret" })),
      "/v1/settings/credentials/openai/test",
      "POST",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pass: true, persisted: false, provider: "openai" });
    expect(sawAuth).toBe("Bearer test-token");
    expect(JSON.parse(sawBody)).toEqual({ secret: "transient-secret" });
  });

  it("meneruskan add/update/remove AI Connection dengan method yang tepat", async () => {
    let addBody = "";
    pool
      .intercept({
        path: "/v1/settings/credentials/openrouter/connections",
        method: "POST",
      })
      .reply(200, (opts) => {
        addBody = String(opts.body ?? "");
        return {
          provider: "openrouter",
          connectionId: "conn_second",
          label: "Secondary",
          enabled: true,
          priority: 200,
        };
      });

    const added = await proxyToConnectSettings(
      request("POST", JSON.stringify({ secret: "second-key", label: "Secondary" })),
      "/v1/settings/credentials/openrouter/connections",
      "POST",
    );
    expect(added.status).toBe(200);
    expect(JSON.parse(addBody)).toEqual({ secret: "second-key", label: "Secondary" });

    let patchBody = "";
    pool
      .intercept({
        path: "/v1/settings/credentials/openrouter/connections/conn_second",
        method: "PATCH",
      })
      .reply(200, (opts) => {
        patchBody = String(opts.body ?? "");
        return {
          provider: "openrouter",
          connectionId: "conn_second",
          label: "Secondary",
          enabled: false,
          priority: 200,
        };
      });

    const patched = await proxyToConnectSettings(
      request("PATCH", JSON.stringify({ enabled: false })),
      "/v1/settings/credentials/openrouter/connections/conn_second",
      "PATCH",
    );
    expect(patched.status).toBe(200);
    expect(JSON.parse(patchBody)).toEqual({ enabled: false });

    pool
      .intercept({
        path: "/v1/settings/credentials/openrouter/connections/conn_second",
        method: "DELETE",
      })
      .reply(200, { removed: true });

    const removed = await proxyToConnectSettings(
      request("DELETE"),
      "/v1/settings/credentials/openrouter/connections/conn_second",
      "DELETE",
    );
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ removed: true });
  });

  it("menolak method/path AI Connection di luar kontrak", async () => {
    expect(
      (
        await proxyToConnectSettings(
          request("GET"),
          "/v1/settings/credentials/openrouter/connections",
          "GET",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await proxyToConnectSettings(
          request("PUT", JSON.stringify({ enabled: false })),
          "/v1/settings/credentials/openrouter/connections/conn_second",
          "PUT",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await proxyToConnectSettings(
          request("PATCH", JSON.stringify({ enabled: false })),
          "/v1/settings/credentials/openrouter/connections/../ops",
          "PATCH",
        )
      ).status,
    ).toBe(400);
  });

  it("membatasi path credential ke namespace aman dan membiarkan Connect memvalidasi provider id", async () => {
    pool
      .intercept({ path: "/v1/settings/credentials/unknown-provider", method: "PUT" })
      .reply(400, {
        error: { type: "BAD_REQUEST", message: "provider tidak dikenal" },
      });

    const response = await proxyToConnectSettings(
      request("PUT", JSON.stringify({ secret: "test-secret" })),
      "/v1/settings/credentials/unknown-provider",
      "PUT",
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "BAD_REQUEST",
    );
  });

  it("tetap menolak credential path yang tidak memenuhi namespace id aman", async () => {
    const response = await proxyToConnectSettings(
      request("PUT", JSON.stringify({ secret: "test-secret" })),
      "/v1/settings/credentials/../../ops/provider-canary",
      "PUT",
    );
    expect(response.status).toBe(400);
  });

  it("menolak MCP workspace id yang tidak memenuhi shared workspace contract", async () => {
    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=workspace-default",
      "GET",
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "BAD_REQUEST",
    );
  });

  it("menolak query Settings yang tidak termasuk kontrak allowlist", async () => {
    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/runtime?workspaceId=unexpected",
      "GET",
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "BAD_REQUEST",
    );
  });

  it("menolak duplicate dan unknown MCP workspace query", async () => {
    const duplicate = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=ws_personal&workspaceId=ws_other",
      "GET",
    );
    expect(duplicate.status).toBe(400);

    const unknown = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/mcp/servers?workspaceId=ws_personal&admin=true",
      "GET",
    );
    expect(unknown.status).toBe(400);
  });

  it("menolak dot-segment sebelum URL owner dibentuk", async () => {
    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/../ops/provider-canary",
      "GET",
    );
    expect(response.status).toBe(400);
  });

  it("body mutasi yang bukan JSON valid → 400 tanpa memanggil Connect", async () => {
    const response = await proxyToConnectSettings(
      request("PUT", "bukan json {{{"),
      "/v1/settings/runtime",
      "PUT",
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "BAD_REQUEST",
    );
  });

  it("kegagalan jaringan Connect → 502 eksplisit", async () => {
    pool
      .intercept({ path: "/v1/settings/runtime", method: "GET" })
      .replyWithError(new Error("down"));

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/runtime",
      "GET",
    );
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { type: string } }).error.type).toBe(
      "UPSTREAM_UNAVAILABLE",
    );
  });

  it("redirect owner tidak diikuti sambil membawa bearer token", async () => {
    pool
      .intercept({ path: "/v1/settings/runtime", method: "GET" })
      .reply(302, "", { headers: { location: "/v1/settings/credentials" } });

    const response = await proxyToConnectSettings(
      request("GET"),
      "/v1/settings/runtime",
      "GET",
    );
    expect(response.status).toBe(502);
  });
});
