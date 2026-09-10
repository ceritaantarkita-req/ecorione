import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FlowNodeDefinition } from "@ecorione/shared-schema";
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

function definition(kind: "trigger" | "delay"): FlowNodeDefinition {
  return {
    id: `core/${kind}/v1`,
    kind,
    version: 1,
    label: kind === "trigger" ? "Trigger" : "Delay / Schedule",
    category: kind === "trigger" ? "trigger" : "control",
    description: `${kind} test definition`,
    inputPorts: kind === "trigger" ? [] : [{ id: "in", label: "Input", valueType: "any" }],
    outputPorts: [{ id: "out", label: "Output", valueType: "any" }],
    capabilities: [{ capabilityId: "node.execute", permissionIds: ["node.execute"] }],
    policyActionClass: null,
    sideEffect: false,
    secretRefPolicy: "none",
    limits: {
      timeoutMs: 120_000,
      maxOutputBytes: 1_048_576,
      maxIterations: 100,
      maxParallelism: 4,
    },
    retry: {
      maximumAttempts: 1,
      initialIntervalMs: 1_000,
      maximumIntervalMs: 10_000,
    },
    idempotency: "none",
  };
}

async function sync(definitions: FlowNodeDefinition[]) {
  return app.inject({
    method: "POST",
    url: "/v1/authority/nodes/sync",
    payload: { workspaceId: "ws_alpha", definitions },
  });
}

describe("Hub node authority declarations", () => {
  it("syncs declarations without auto-grant and prunes grants for removed core nodes", async () => {
    const firstSync = await sync([definition("trigger")]);
    expect(firstSync.statusCode).toBe(200);
    expect(firstSync.json()).toMatchObject({ workspaceId: "ws_alpha", declared: 1 });

    const authorization = {
      operationId: "op_nodeauthorityauth01",
      workspaceId: "ws_alpha",
      subject: { kind: "node", id: "core/trigger/v1" },
      capabilityId: "node.execute",
      permissionIds: ["node.execute"],
      scope: "personal",
      sensitivity: "INTERNAL",
      autonomy: "L2",
    };
    const beforeGrant = await app.inject({
      method: "POST",
      url: "/v1/authority/authorize",
      payload: authorization,
    });
    expect(beforeGrant.statusCode).toBe(200);
    expect(beforeGrant.json().outcome).toBe("DENY");

    const grant = {
      operationId: "op_nodeauthoritygrant01",
      workspaceId: "ws_alpha",
      subject: { kind: "node", id: "core/trigger/v1" },
      capabilityId: "node.execute",
      permissionIds: ["node.execute"],
      scope: "personal",
      maxSensitivity: "INTERNAL",
      autonomy: "L2",
      reason: "Explicit node execution grant.",
      idempotencyKey: "node-authority-trigger-grant-01",
    };
    const approvalRequired = await app.inject({
      method: "POST",
      url: "/v1/authority/grants",
      payload: grant,
    });
    expect(approvalRequired.statusCode).toBe(409);
    expect(approvalRequired.json().error.type).toBe("AUTHORITY_APPROVAL_REQUIRED");

    const approved = await app.inject({
      method: "POST",
      url: `/v1/approvals/${grant.operationId}/decide`,
      payload: { decision: "APPROVE" },
    });
    expect(approved.statusCode).toBe(200);

    const granted = await app.inject({
      method: "POST",
      url: "/v1/authority/grants",
      payload: grant,
    });
    expect(granted.statusCode).toBe(201);

    const afterGrant = await app.inject({
      method: "POST",
      url: "/v1/authority/authorize",
      payload: authorization,
    });
    expect(afterGrant.json().outcome).toBe("ALLOW");

    const replacement = await sync([definition("delay")]);
    expect(replacement.statusCode).toBe(200);
    const rows = db.raw
      .prepare(
        "SELECT subject_id FROM authority_grants WHERE workspace_id=? AND subject_kind='node' ORDER BY subject_id",
      )
      .all("ws_alpha") as Array<{ subject_id: string }>;
    expect(rows).toEqual([]);

    const afterRemoval = await app.inject({
      method: "POST",
      url: "/v1/authority/authorize",
      payload: authorization,
    });
    expect(afterRemoval.json().outcome).toBe("DENY");
  });
});
