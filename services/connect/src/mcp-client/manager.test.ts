import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { McpGovernance } from "./governance.js";
import { FileMcpInvocationStore } from "./invocation-store.js";
import {
  McpManager,
  McpRemoteOutcomeUncertainError,
  McpToolDisabledError,
} from "./manager.js";
import { FileMcpRegistry } from "./registry.js";
import {
  McpDiscoverRequestSchema,
  McpServerConfigSchema,
  McpToolCallRequestSchema,
  type McpClientFacade,
  type McpClientFactory,
  type McpGovernanceRequest,
  type McpServerConfig,
  type McpToolCallResult,
} from "./types.js";

const dirs: string[] = [];
function tempPaths(): { registry: string; invocation: string } {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-mcp-manager-"));
  dirs.push(dir);
  return { registry: join(dir, "registry.json"), invocation: join(dir, "invocations.json") };
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

class FakeClient implements McpClientFacade {
  readonly protocolEra = "modern" as const;
  callCount = 0;
  closeCount = 0;
  failCall = false;
  failResources = false;

  async listTools() {
    return [{ name: "read" }, { name: "write" }];
  }
  async listResources() {
    if (this.failResources) throw new Error("resources unsupported");
    return [{ uri: "file:///doc", name: "doc" }];
  }
  async callTool(name: string): Promise<McpToolCallResult> {
    this.callCount += 1;
    if (this.failCall) throw new Error("socket closed");
    return { content: [{ type: "text", text: `${name}:ok` }] };
  }
  async close(): Promise<void> {
    this.closeCount += 1;
  }
}

class FakeFactory implements McpClientFactory {
  readonly byWorkspace = new Map<string, FakeClient>();
  connectCount = 0;
  async connect(_config: McpServerConfig, workspaceId: string): Promise<McpClientFacade> {
    this.connectCount += 1;
    const client = new FakeClient();
    this.byWorkspace.set(workspaceId, client);
    return client;
  }
}

class FakeGovernance implements McpGovernance {
  readonly authorized: McpGovernanceRequest[] = [];
  successCount = 0;
  failureCount = 0;
  failAudit = false;
  async authorize(request: McpGovernanceRequest): Promise<void> {
    this.authorized.push(request);
  }
  async auditSuccess(): Promise<void> {
    this.successCount += 1;
    if (this.failAudit) throw new Error("audit down");
  }
  async auditFailure(): Promise<void> {
    this.failureCount += 1;
    if (this.failAudit) throw new Error("audit down");
  }
}

function config(): McpServerConfig {
  return McpServerConfigSchema.parse({
    id: "remote",
    displayName: "Remote",
    workspaceIds: ["ws_a", "ws_b"],
    transport: { type: "streamable-http", url: "https://mcp.example.test/mcp" },
    toolPolicies: [
      { name: "read", enabled: true, actionClass: "READ" },
      { name: "write", enabled: true, actionClass: "REVERSIBLE_WRITE" },
    ],
  });
}

function setup() {
  const paths = tempPaths();
  const registry = new FileMcpRegistry(paths.registry);
  registry.upsert(config());
  const factory = new FakeFactory();
  const governance = new FakeGovernance();
  const manager = new McpManager(
    registry,
    factory,
    governance,
    new FileMcpInvocationStore(paths.invocation),
  );
  return { registry, factory, governance, manager };
}

const discoverRequest = McpDiscoverRequestSchema.parse({
  workspaceId: "ws_a",
  operationId: "op_discover",
  scope: "personal",
  sensitivity: "INTERNAL",
  autonomy: "L1",
  now: "2026-09-09T12:00:00.000Z",
});
function callRequest(operationId = "op_call") {
  return McpToolCallRequestSchema.parse({
    workspaceId: "ws_a",
    operationId,
    scope: "personal",
    sensitivity: "INTERNAL",
    autonomy: "L1",
    now: "2026-09-09T12:00:00.000Z",
    arguments: { value: 1 },
  });
}

describe("McpManager", () => {
  it("discovers tools and isolates a resource-surface failure", async () => {
    const { manager, factory } = setup();
    await manager.discover("remote", discoverRequest);
    factory.byWorkspace.get("ws_a")!.failResources = true;
    const result = await manager.discover("remote", {
      ...discoverRequest,
      operationId: "op_discover2",
    });
    expect(result.tools.map((tool) => [tool.name, tool.enabled])).toEqual([
      ["read", true],
      ["write", true],
    ]);
    expect(result.resources).toEqual([]);
    expect(result.errors.resources).toContain("resources unsupported");
  });

  it("refuses tools that are not explicitly enabled before remote dispatch", async () => {
    const { manager, registry, factory } = setup();
    registry.setToolPolicy("remote", { name: "write", enabled: false, actionClass: "REVERSIBLE_WRITE" });
    await expect(manager.callTool("remote", "write", callRequest())).rejects.toBeInstanceOf(
      McpToolDisabledError,
    );
    expect(factory.connectCount).toBe(0);
  });

  it("settles a side effect once and returns the durable result on duplicate request", async () => {
    const { manager, factory, governance } = setup();
    const first = await manager.callTool("remote", "write", callRequest("op_first"));
    const second = await manager.callTool("remote", "write", callRequest("op_second"));
    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(factory.byWorkspace.get("ws_a")!.callCount).toBe(1);
    expect(governance.successCount).toBe(2);
  });

  it("marks a failed dispatched side effect uncertain and blocks retry", async () => {
    const { manager, factory } = setup();
    await manager.discover("remote", discoverRequest);
    factory.byWorkspace.get("ws_a")!.failCall = true;
    await expect(manager.callTool("remote", "write", callRequest("op_first"))).rejects.toBeInstanceOf(
      McpRemoteOutcomeUncertainError,
    );
    const calls = factory.byWorkspace.get("ws_a")!.callCount;
    await expect(manager.callTool("remote", "write", callRequest("op_second"))).rejects.toThrow(
      /redispatch otomatis ditolak/,
    );
    expect(factory.byWorkspace.get("ws_a")!.callCount).toBe(calls);
  });

  it("does not make a successful remote result retryable when audit fails", async () => {
    const { manager, governance, factory } = setup();
    governance.failAudit = true;
    const result = await manager.callTool("remote", "read", callRequest("op_read"));
    expect(result.audit).toBe("degraded");
    expect(factory.byWorkspace.get("ws_a")!.callCount).toBe(1);
  });

  it("keeps connections isolated per workspace", async () => {
    const { manager, factory } = setup();
    await manager.discover("remote", discoverRequest);
    await manager.discover("remote", { ...discoverRequest, workspaceId: "ws_b", operationId: "op_b" });
    expect(factory.connectCount).toBe(2);
    expect(manager.status("remote", "ws_a").connected).toBe(true);
    expect(manager.status("remote", "ws_b").connected).toBe(true);
  });
});
