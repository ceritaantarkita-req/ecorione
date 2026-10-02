import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MockAgent,
  getGlobalDispatcher,
  setGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalConnectUrl: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://connect.local");

  originalConnectUrl = process.env.ECORIONE_CONNECT_URL;
  process.env.ECORIONE_CONNECT_URL = "http://connect.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalConnectUrl === undefined) delete process.env.ECORIONE_CONNECT_URL;
  else process.env.ECORIONE_CONNECT_URL = originalConnectUrl;
});

describe("POST /api/webhooks/:hookId", () => {
  it("forwards the caller token to private Connect without internal authorization", async () => {
    let sawHeaders: Record<string, string> | undefined;
    pool
      .intercept({
        path: "/v1/webhooks/hook_pcs06_webhook_0001",
        method: "POST",
      })
      .reply(202, (opts) => {
        sawHeaders = opts.headers as Record<string, string> | undefined;
        return { accepted: true, duplicate: false };
      });

    const response = await POST(
      new Request("http://ai.local/api/webhooks/hook_pcs06_webhook_0001", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ecorione-webhook-token": "derived-hook-token",
        },
        body: JSON.stringify({
          deliveryId: "delivery_123",
          occurredAt: "2026-10-02T01:00:00.000Z",
          payload: { action: "push" },
        }),
      }),
      { params: Promise.resolve({ hookId: "hook_pcs06_webhook_0001" }) },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, duplicate: false });
    expect(sawHeaders?.["x-ecorione-webhook-token"]).toBe("derived-hook-token");
    expect(sawHeaders?.authorization).toBeUndefined();
  });

  it("rejects an invalid hook id before Connect egress", async () => {
    const response = await POST(
      new Request("http://ai.local/api/webhooks/bad", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ hookId: "bad" }) },
    );
    expect(response.status).toBe(404);
  });

  it("rejects an oversized declared payload before Connect egress", async () => {
    const response = await POST(
      new Request("http://ai.local/api/webhooks/hook_pcs06_webhook_0001", {
        method: "POST",
        headers: {
          "content-length": String(96 * 1024 + 1),
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ hookId: "hook_pcs06_webhook_0001" }) },
    );

    expect(response.status).toBe(413);
    expect((await response.json()) as { error: { type: string } }).toMatchObject({
      error: { type: "PAYLOAD_TOO_LARGE" },
    });
  });
});
