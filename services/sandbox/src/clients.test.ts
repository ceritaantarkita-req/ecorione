import { assertId } from "@ecorione/shared-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { createSandboxControlPlane } from "./clients.js";

describe("Sandbox control-plane HTTP bounds", () => {
  let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;
  let agent: MockAgent;

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

  it("membatasi waktu tunggu Hub authority/evaluate", async () => {
    const hub = agent.get("http://hub.local");
    hub.intercept({ path: "/v1/authority/authorize", method: "POST" })
      .reply(200, {
        outcome: "ALLOW",
        reason: "ok",
        grantedPermissionIds: ["sandbox.execute"],
      })
      .delay(250);

    const control = createSandboxControlPlane({
      hubUrl: "http://hub.local",
      rndUrl: "http://rnd.local",
      timeoutMs: 25,
    });

    await expect(
      control.authorize({
        operationId: assertId("operation", "op_sbxtimeout0001"),
        workspaceId: assertId("workspace", "ws_personal"),
        subject: { kind: "sandbox", id: "tier0" },
        capabilityId: "sandbox.execute",
        permissionIds: ["sandbox.execute"],
        scope: "personal",
        sensitivity: "INTERNAL",
        autonomy: "L2",
      }),
    ).rejects.toThrow();
  });

  it("membatasi waktu tunggu RnD trace", async () => {
    const rnd = agent.get("http://rnd.local");
    rnd.intercept({ path: "/v1/traces", method: "POST" })
      .reply(200, { id: "trace-1" })
      .delay(250);

    const control = createSandboxControlPlane({
      hubUrl: "http://hub.local",
      rndUrl: "http://rnd.local",
      timeoutMs: 25,
    });

    await expect(
      control.trace({
        name: "sandbox.execution.requested",
        operationId: assertId("operation", "op_sbxtimeout0002"),
        recordedAt: "2026-09-21T00:00:00.000Z",
        attributes: { tier: "tier0" },
      }),
    ).rejects.toThrow();
  });

  it("menolak timeout configuration di luar bounded range", () => {
    expect(() =>
      createSandboxControlPlane({
        hubUrl: "http://hub.local",
        rndUrl: "http://rnd.local",
        timeoutMs: 0,
      }),
    ).toThrow(/timeout/);
  });
});
