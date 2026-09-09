import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertId,
  type CapabilityAuthorizationResult,
  type PolicyVerdict,
} from "@ecorione/shared-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SandboxControlPlane } from "./clients.js";
import { buildDockerPlan, SandboxBoundaryError, SandboxExecutor } from "./executor.js";
import { SandboxReceiptStore } from "./receipt-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function setup(
  verdict: PolicyVerdict = { outcome: "ALLOW", reason: "ok" },
  authority: CapabilityAuthorizationResult = {
    outcome: "ALLOW",
    reason: "granted",
    grantedPermissionIds: ["sandbox.execute", "filesystem.read"],
  },
) {
  const root = mkdtempSync(join(tmpdir(), "ecorione-sandbox-"));
  roots.push(root);
  const workspace = join(root, "work");
  mkdirSync(workspace);
  const control: SandboxControlPlane = {
    authorize: vi.fn(async () => authority),
    evaluate: vi.fn(async () => verdict),
    trace: vi.fn(async () => undefined),
  };
  const receipts = new SandboxReceiptStore(join(root, "receipts"));
  return { root, workspace, control, executor: new SandboxExecutor(root, control, receipts) };
}

describe("Sandbox boundaries", () => {
  it("Docker plan contains every ADR-10 hardening flag and no docker socket", () => {
    const plan = buildDockerPlan("/tmp/work", "npm test");
    const joined = plan.args.join(" ");
    expect(joined).toContain("--network=none");
    expect(joined).toContain("--read-only");
    expect(joined).toContain("--tmpfs /tmp:rw,noexec,nosuid,size=64m");
    expect(joined).toContain("--cap-drop=ALL");
    expect(joined).toContain("--security-opt=no-new-privileges");
    expect(joined).toContain("--user=65532:65532");
    expect(joined).toContain("--memory=512m");
    expect(joined).toContain("--cpus=1");
    expect(joined).toContain("--pids-limit=128");
    expect(joined.match(/type=bind/g)).toHaveLength(1);
    expect(joined).not.toContain("docker.sock");
  });

  it("rejects workspace escape before authority/policy evaluation", async () => {
    const { root, control, executor } = setup();
    await expect(
      executor.execute({
        operationId: assertId("operation", "op_sbxescape001"),
        tier: "tier0",
        workspace: join(root, ".."),
        command: "pwd",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
        irreversible: false,
        idempotencyKey: "sbx-escape-key",
        scope: "personal",
        sensitivity: "INTERNAL",
      }),
    ).rejects.toThrow(SandboxBoundaryError);
    expect(control.authorize).not.toHaveBeenCalled();
    expect(control.evaluate).not.toHaveBeenCalled();
  });

  it("fails closed on missing sandbox capability before general policy", async () => {
    const { workspace, control, executor } = setup(
      { outcome: "ALLOW", reason: "policy allow" },
      { outcome: "DENY", reason: "grant missing", missingPermissionIds: ["sandbox.execute"] },
    );
    await expect(
      executor.execute({
        operationId: assertId("operation", "op_sbxauthority1"),
        workspaceId: assertId("workspace", "ws_other"),
        tier: "tier0",
        workspace,
        command: "pwd",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
        irreversible: false,
        idempotencyKey: "sbx-authority-deny",
        scope: "personal",
        sensitivity: "INTERNAL",
      }),
    ).rejects.toThrow(/authority ditolak/);
    expect(control.authorize).toHaveBeenCalledTimes(1);
    expect(control.evaluate).not.toHaveBeenCalled();
  });

  it("rejects destructive host command", async () => {
    const { workspace, executor } = setup();
    await expect(
      executor.execute({
        operationId: assertId("operation", "op_sbxdeny00001"),
        tier: "tier0",
        workspace,
        command: "rm file.txt",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
        irreversible: false,
        idempotencyKey: "sbx-deny-command",
        scope: "personal",
        sensitivity: "INTERNAL",
      }),
    ).rejects.toThrow(SandboxBoundaryError);
  });

  it("returns durable idempotent receipt without authorizing/evaluating twice", async () => {
    const { workspace, control, executor } = setup();
    const request = {
      operationId: assertId("operation", "op_sbxidem000001"),
      tier: "tier0" as const,
      workspace,
      command: "pwd",
      wasmBase64: null,
      wasmExport: "run",
      wasmArgs: [],
      irreversible: false,
      idempotencyKey: "sandbox-idempotent-key",
      scope: "personal" as const,
      sensitivity: "INTERNAL" as const,
    };
    const first = await executor.execute(request);
    const second = await executor.execute(request);
    expect(second).toEqual(first);
    expect(control.authorize).toHaveBeenCalledTimes(1);
    expect(control.evaluate).toHaveBeenCalledTimes(1);
  });
});
