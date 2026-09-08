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

describe("POST /api/chat", () => {
  it("body valid → diteruskan ke Hub POST /v1/chat, respons diteruskan apa adanya", async () => {
    pool.intercept({ path: "/v1/chat", method: "POST" }).reply(200, {
      operationId: "op_a",
      sessionId: "sess_abc",
      reply: "halo!",
      memoryUsed: { coreMemoryBlocks: [], recalledFacts: [], episodicSummaries: [] },
      cost: {
        model: "claude-sonnet-4-5-20250929",
        cacheHit: false,
        actualUsd: 0,
        naiveUsd: 0,
        savedUsd: 0,
        savedPct: 0,
        routeReason: "default-hosted",
      },
      policy: { outcome: "ALLOW", reason: "ok", ruleId: "read-always-allowed" },
    });

    const req = new Request("http://ai.local/api/chat", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess_abc", message: "halo" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()) as { reply: string }).toMatchObject({ reply: "halo!" });
  });

  it("body tidak cocok ChatRequestSchema (sessionId salah format) → 400, tanpa memanggil Hub", async () => {
    const req = new Request("http://ai.local/api/chat", {
      method: "POST",
      body: JSON.stringify({ sessionId: "bukan-session-id", message: "halo" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
