import { assertId } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockAgent, setGlobalDispatcher } from "undici";
import { buildFlowServer } from "./http.js";
import type { FlowTemporalClient } from "./temporal-client.js";

function temporalStub(overrides: Partial<FlowTemporalClient> = {}): FlowTemporalClient {
  return {
    start: vi.fn(async () => undefined),
    signal: vi.fn(async () => undefined),
    operationId: vi.fn(async () => assertId("operation", "op_flowapproval001")),
    describe: vi.fn(async () => ({ status: "RUNNING" as const })),
    ...overrides,
  };
}

const apps: Array<ReturnType<typeof buildFlowServer>> = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

const startPayload = {
  scope: "personal",
  sensitivity: "INTERNAL",
  inputText: "  hello   flow  ",
  delayMs: 0,
  approvalPrompt: "Setujui eksekusi?",
  aiTarget: "local",
  aiMessage: "Ringkas input.",
  execution: {
    tier: "tier0",
    workspace: "/tmp/work",
    command: "pwd",
    wasmBase64: null,
    wasmExport: "run",
    wasmArgs: [],
  },
};

describe("Flow HTTP", () => {
  it("starts a Temporal workflow with canonical workflow/operation ids", async () => {
    const temporal = temporalStub();
    const app = buildFlowServer(temporal, { hubUrl: "http://hub.local" });
    apps.push(app);
    const res = await app.inject({ method: "POST", url: "/v1/flows", payload: startPayload });
    expect(res.statusCode).toBe(202);
    const body = res.json() as {
      flowId: string;
      operationId: string;
      temporalWorkflowId: string;
    };
    expect(body.flowId).toMatch(/^wf_/);
    expect(body.operationId).toMatch(/^op_/);
    expect(body.temporalWorkflowId).toBe(body.flowId);
    expect(temporal.start).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: body.flowId, operationId: body.operationId }),
    );
  });

  it("resolves durable Hub approval, records decision, then signals Temporal", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const hub = agent.get("http://hub.local");
    hub
      .intercept({
        path: "/v1/approvals/by-idempotency-key?idempotencyKey=wf_runtime001%3Ahuman-approval",
        method: "GET",
      })
      .reply(200, { operationId: "op_flowapproval001", status: "PENDING" });
    hub
      .intercept({
        path: "/v1/approvals/op_flowapproval001/decide",
        method: "POST",
        body: JSON.stringify({ decision: "APPROVE", note: "ok" }),
      })
      .reply(200, { status: "APPROVE" });

    const temporal = temporalStub();
    const app = buildFlowServer(temporal, { hubUrl: "http://hub.local" });
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/v1/flows/wf_runtime001/decision",
      payload: { decision: "APPROVE", note: "ok" },
    });
    expect(res.statusCode).toBe(200);
    expect(temporal.operationId).not.toHaveBeenCalled();
    expect(temporal.signal).toHaveBeenCalledWith("wf_runtime001", {
      decision: "APPROVE",
      note: "ok",
    });
  });

  it("does not signal Temporal when durable Hub approval cannot be resolved", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    agent
      .get("http://hub.local")
      .intercept({
        path: "/v1/approvals/by-idempotency-key?idempotencyKey=wf_runtime002%3Ahuman-approval",
        method: "GET",
      })
      .reply(404, { error: { type: "NOT_FOUND", message: "approval missing" } });

    const temporal = temporalStub();
    const app = buildFlowServer(temporal, { hubUrl: "http://hub.local" });
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/v1/flows/wf_runtime002/decision",
      payload: { decision: "REJECT" },
    });
    expect(res.statusCode).toBe(500);
    expect(temporal.operationId).not.toHaveBeenCalled();
    expect(temporal.signal).not.toHaveBeenCalled();
  });

  it("does not signal Temporal when Hub refuses the durable decision", async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const hub = agent.get("http://hub.local");
    hub
      .intercept({
        path: "/v1/approvals/by-idempotency-key?idempotencyKey=wf_runtime003%3Ahuman-approval",
        method: "GET",
      })
      .reply(200, { operationId: "op_flowapproval001", status: "PENDING" });
    hub
      .intercept({ path: "/v1/approvals/op_flowapproval001/decide", method: "POST" })
      .reply(409, { error: { type: "CONFLICT", message: "already decided" } });

    const temporal = temporalStub();
    const app = buildFlowServer(temporal, { hubUrl: "http://hub.local" });
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/v1/flows/wf_runtime003/decision",
      payload: { decision: "REJECT" },
    });
    expect(res.statusCode).toBe(500);
    expect(temporal.signal).not.toHaveBeenCalled();
  });
});
