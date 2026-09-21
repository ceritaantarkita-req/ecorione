import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildConnectServer } from "./http.js";
import { deriveWebhookToken } from "./webhook-http.js";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let agent: MockAgent;

const ROOT_SECRET = "webhook-root-secret-for-tests";
const HOOK_ID = "hook_ecorione_001";

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});

afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  await agent.close();
});

function build(webhookForwardTimeoutMs?: number) {
  return buildConnectServer({
    token: "internal-secret",
    localBaseUrl: "http://local-model.invalid/v1",
    localModelTag: "qwen3:8b-instruct-q4_K_M",
    flowUrl: "http://flow.local",
    ...(webhookForwardTimeoutMs === undefined ? {} : { webhookForwardTimeoutMs }),
    credentialVault: {
      get(provider, purpose) {
        return provider === "webhook" && purpose === "tokens" ? ROOT_SECRET : undefined;
      },
    },
  });
}

describe("PE-05 Connect webhook ingress", () => {
  it("derives per-hook token only behind the normal internal bearer boundary", async () => {
    const app = build();

    const unauthorized = await app.inject({
      method: "GET",
      url: `/v1/settings/webhooks/${HOOK_ID}/token`,
    });
    expect(unauthorized.statusCode).toBe(401);

    const authorized = await app.inject({
      method: "GET",
      url: `/v1/settings/webhooks/${HOOK_ID}/token`,
      headers: { authorization: "Bearer internal-secret" },
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toEqual({
      hookId: HOOK_ID,
      token: deriveWebhookToken(ROOT_SECRET, HOOK_ID),
    });
    await app.close();
  });

  it("rejects missing or wrong per-hook token before Flow", async () => {
    const app = build();

    const missing = await app.inject({
      method: "POST",
      url: `/v1/webhooks/${HOOK_ID}`,
      payload: { deliveryId: "delivery-001", payload: { ok: true } },
    });
    expect(missing.statusCode).toBe(401);

    const wrong = await app.inject({
      method: "POST",
      url: `/v1/webhooks/${HOOK_ID}`,
      headers: { "x-ecorione-webhook-token": "wrong-token" },
      payload: { deliveryId: "delivery-001", payload: { ok: true } },
    });
    expect(wrong.statusCode).toBe(401);
    await app.close();
  });

  it("membatasi waktu tunggu Flow dan memetakan timeout sebagai 502 tanpa diagnostic internal", async () => {
    agent
      .get("http://flow.local")
      .intercept({
        path: `/v1/webhooks/${HOOK_ID}`,
        method: "POST",
      })
      .reply(200, {
        triggerId: "trg_webhook001",
        graphId: "fg_webhook001",
        graphVersion: 1,
        workflowId: "wf_webhook001",
        operationId: "op_webhook001",
        deduplicated: false,
      })
      .delay(250);

    const app = build(25);
    const response = await app.inject({
      method: "POST",
      url: `/v1/webhooks/${HOOK_ID}`,
      headers: { "x-ecorione-webhook-token": deriveWebhookToken(ROOT_SECRET, HOOK_ID) },
      payload: { deliveryId: "delivery-timeout-001", payload: { ok: true } },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toMatchObject({
      type: "UPSTREAM_UNAVAILABLE",
      message: "Flow webhook ingress tidak tersedia.",
    });
    expect(response.body).not.toContain("flow.local");
    await app.close();
  });

  it("derives a hook-scoped token and forwards only verified delivery with internal auth", async () => {
    let sawAuthorization: string | undefined;
    let sawBody: unknown;
    agent
      .get("http://flow.local")
      .intercept({
        path: `/v1/webhooks/${HOOK_ID}`,
        method: "POST",
      })
      .reply(200, (opts) => {
        sawAuthorization = (opts.headers as Record<string, string> | undefined)?.authorization;
        sawBody = JSON.parse(String(opts.body));
        return {
          triggerId: "trg_webhook001",
          graphId: "fg_webhook001",
          graphVersion: 1,
          workflowId: "wf_webhook001",
          operationId: "op_webhook001",
          deduplicated: false,
        };
      });

    const app = build();
    const token = deriveWebhookToken(ROOT_SECRET, HOOK_ID);
    expect(token).not.toBe(deriveWebhookToken(ROOT_SECRET, "hook_ecorione_002"));

    const response = await app.inject({
      method: "POST",
      url: `/v1/webhooks/${HOOK_ID}`,
      headers: { "x-ecorione-webhook-token": token },
      payload: {
        deliveryId: "delivery-002",
        occurredAt: "2026-09-19T10:20:00.000Z",
        payload: { action: "opened" },
        metadata: { provider: "test" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      triggerId: "trg_webhook001",
      operationId: "op_webhook001",
    });
    expect(sawAuthorization).toBe("Bearer internal-secret");
    expect(sawBody).toEqual({
      deliveryId: "delivery-002",
      occurredAt: "2026-09-19T10:20:00.000Z",
      payload: { action: "opened" },
      metadata: { provider: "test" },
    });
    await app.close();
  });
});
