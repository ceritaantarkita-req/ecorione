import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

let db: HubDatabase;
let app: FastifyInstance;

beforeEach(() => {
  db = openHubDatabase();
  app = buildHubServer(db, {
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
  });
});
afterEach(async () => {
  await app.close();
  db.close();
});

function grantPayload(workspaceId = "ws_alpha") {
  return {
    operationId: "op_authorityhttpgrant01",
    workspaceId,
    subject: { kind: "mcp-tool", id: "remote/read" },
    capabilityId: "mcp.tool.call",
    permissionIds: ["mcp.tool.read"],
    scope: "personal",
    maxSensitivity: "INTERNAL",
    autonomy: "L1",
    reason: "Explicit MCP read grant.",
    idempotencyKey: `authority-http-grant-${workspaceId}`,
  };
}

async function approve(operationId: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: `/v1/approvals/${operationId}/decide`,
    payload: { decision: "APPROVE" },
  });
  expect(res.statusCode).toBe(200);
}

describe("capability authority HTTP", () => {
  it("lists code-owned capability definitions", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/capabilities" });
    expect(res.statusCode).toBe(200);
    const ids = res.json().capabilities.map((item: { id: string }) => item.id);
    expect(ids).toContain("mcp.tool.call");
    expect(ids).toContain("sandbox.execute");
    expect(ids).toContain("model.invoke.hosted");
    expect(ids).toContain("node.execute");
  });

  it("fails closed, requires POLICY_ADMIN approval for grant, then authorizes exact scope", async () => {
    const authPayload = {
      operationId: "op_authorityhttpauth01",
      workspaceId: "ws_alpha",
      subject: { kind: "mcp-tool", id: "remote/read" },
      capabilityId: "mcp.tool.call",
      permissionIds: ["mcp.tool.read"],
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L1",
    };
    const before = await app.inject({
      method: "POST",
      url: "/v1/authority/authorize",
      payload: authPayload,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().outcome).toBe("DENY");

    const payload = grantPayload();
    const first = await app.inject({ method: "POST", url: "/v1/authority/grants", payload });
    expect(first.statusCode).toBe(409);
    expect(first.json().error.type).toBe("AUTHORITY_APPROVAL_REQUIRED");

    const approvalRow = db.raw
      .prepare("SELECT action_request FROM approvals WHERE operation_id=?")
      .get(payload.operationId) as { action_request: string };
    expect(JSON.parse(approvalRow.action_request).actionClass).toBe("POLICY_ADMIN");

    await approve(payload.operationId);
    const granted = await app.inject({ method: "POST", url: "/v1/authority/grants", payload });
    expect(granted.statusCode).toBe(201);
    expect(granted.json().deduplicated).toBe(false);

    const after = await app.inject({
      method: "POST",
      url: "/v1/authority/authorize",
      payload: authPayload,
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().outcome).toBe("ALLOW");

    const wrongWorkspace = await app.inject({
      method: "POST",
      url: "/v1/authority/authorize",
      payload: {
        ...authPayload,
        workspaceId: "ws_beta",
        operationId: "op_authorityhttpauth02",
      },
    });
    expect(wrongWorkspace.json().outcome).toBe("DENY");
  });

  it("requires approval to revoke and records authority audit events", async () => {
    const payload = grantPayload();
    await app.inject({ method: "POST", url: "/v1/authority/grants", payload });
    await approve(payload.operationId);
    await app.inject({ method: "POST", url: "/v1/authority/grants", payload });

    const revoke = {
      ...payload,
      operationId: "op_authorityhttprevoke1",
      reason: "Operator revokes MCP read.",
      idempotencyKey: "authority-http-revoke-alpha",
    };
    const first = await app.inject({
      method: "POST",
      url: "/v1/authority/revoke",
      payload: revoke,
    });
    expect(first.statusCode).toBe(409);
    await approve(revoke.operationId);
    const done = await app.inject({
      method: "POST",
      url: "/v1/authority/revoke",
      payload: revoke,
    });
    expect(done.statusCode).toBe(200);
    expect(done.json().revoked).toBe(1);

    const events = await app.inject({ method: "GET", url: "/v1/audit" });
    const types = events.json().events.map((event: { type: string }) => event.type);
    expect(types).toContain("CAPABILITY_GRANTED");
    expect(types).toContain("CAPABILITY_REVOKED");
  });
});
