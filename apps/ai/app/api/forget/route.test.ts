import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MockAgent,
  setGlobalDispatcher,
  getGlobalDispatcher,
  type Interceptable,
} from "undici";
import { POST } from "./route";

let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
let pool: Interceptable;
let originalHubUrl: string | undefined;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  pool = agent.get("http://hub.local");
  originalHubUrl = process.env.ECORIONE_HUB_URL;
  process.env.ECORIONE_HUB_URL = "http://hub.local";
});

afterEach(() => {
  setGlobalDispatcher(originalDispatcher);
  if (originalHubUrl === undefined) delete process.env.ECORIONE_HUB_URL;
  else process.env.ECORIONE_HUB_URL = originalHubUrl;
});

describe("POST /api/forget", () => {
  it("body valid → diteruskan ke Hub POST /v1/memory/forget", async () => {
    pool
      .intercept({ path: "/v1/memory/forget", method: "POST" })
      .reply(200, { id: "mem_a", tInvalid: "2026-09-08T10:30:00.000Z" });

    const req = new Request("http://ai.local/api/forget", {
      method: "POST",
      body: JSON.stringify({ factId: "mem_a" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()) as { tInvalid: string }).toMatchObject({
      tInvalid: "2026-09-08T10:30:00.000Z",
    });
  });

  it("factId hilang → 400, tanpa memanggil Hub", async () => {
    const req = new Request("http://ai.local/api/forget", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("Hub menolak (fakta tidak ada) → status Hub diteruskan apa adanya", async () => {
    pool
      .intercept({ path: "/v1/memory/forget", method: "POST" })
      .reply(404, { error: { type: "NOT_FOUND", message: "tidak ada" } });

    const req = new Request("http://ai.local/api/forget", {
      method: "POST",
      body: JSON.stringify({ factId: "mem_nope" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
