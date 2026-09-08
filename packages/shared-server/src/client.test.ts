import { describe, expect, it } from "vitest";
import { MockAgent, setGlobalDispatcher, type Interceptable } from "undici";
import { httpJson } from "./client.js";
import type { RemoteServiceError } from "./errors.js";

function mockAgentFor(baseUrl: string): Interceptable {
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  return agent.get(baseUrl);
}

describe("httpJson", () => {
  it("mengirim POST dengan body JSON dan Authorization bearer, mem-parse respons JSON", async () => {
    const pool = mockAgentFor("http://svc.local");
    pool
      .intercept({
        path: "/v1/echo",
        method: "POST",
        headers: { authorization: "Bearer tok-123" },
        body: JSON.stringify({ hello: "world" }),
      })
      .reply(200, { ok: true }, { headers: { "content-type": "application/json" } });

    const result = await httpJson<{ ok: boolean }>("http://svc.local/v1/echo", {
      body: { hello: "world" },
      token: "tok-123",
    });
    expect(result).toEqual({ ok: true });
  });

  it("default ke GET saat tidak ada body", async () => {
    const pool = mockAgentFor("http://svc.local");
    pool.intercept({ path: "/v1/items", method: "GET" }).reply(200, { items: [] });

    const result = await httpJson<{ items: unknown[] }>("http://svc.local/v1/items");
    expect(result).toEqual({ items: [] });
  });

  it("melempar RemoteServiceError berisi status dan body saat respons bukan 2xx", async () => {
    const pool = mockAgentFor("http://svc.local");
    pool
      .intercept({ path: "/v1/fail", method: "GET" })
      .reply(404, { error: { type: "NOT_FOUND", message: "tidak ada" } });

    await expect(httpJson("http://svc.local/v1/fail")).rejects.toMatchObject({
      statusCode: 404,
      body: { error: { type: "NOT_FOUND", message: "tidak ada" } },
    } satisfies Partial<RemoteServiceError>);
  });

  it("menangani respons body kosong (mis. 204) tanpa melempar saat parsing JSON", async () => {
    const pool = mockAgentFor("http://svc.local");
    pool.intercept({ path: "/v1/empty", method: "DELETE" }).reply(204, "");

    const result = await httpJson<undefined>("http://svc.local/v1/empty", { method: "DELETE" });
    expect(result).toBeUndefined();
  });
});
