import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceIdSchema } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import { FileMcpRegistry, McpRegistryBusyError, McpServerNotFoundError } from "./registry.js";
import { McpServerConfigSchema } from "./types.js";

const dirs: string[] = [];
function pathForTest(): string {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-mcp-registry-"));
  dirs.push(dir);
  return join(dir, "registry.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function httpServer(id = "docs") {
  return McpServerConfigSchema.parse({
    id,
    displayName: "Docs",
    workspaceIds: ["ws_alpha"],
    transport: { type: "streamable-http", url: "https://mcp.example.test/mcp" },
    toolPolicies: [{ name: "search", enabled: true, actionClass: "READ" }],
  });
}

describe("FileMcpRegistry", () => {
  it("isolates server visibility by workspace and persists across reload", () => {
    const path = pathForTest();
    const registry = new FileMcpRegistry(path);
    registry.upsert(httpServer());
    expect(registry.list(WorkspaceIdSchema.parse("ws_alpha"))).toHaveLength(1);
    expect(registry.list(WorkspaceIdSchema.parse("ws_beta"))).toHaveLength(0);
    expect(() =>
      new FileMcpRegistry(path).get("docs", WorkspaceIdSchema.parse("ws_beta")),
    ).toThrow(McpServerNotFoundError);
    expect(new FileMcpRegistry(path).get("docs", WorkspaceIdSchema.parse("ws_alpha")).id).toBe(
      "docs",
    );
  });

  it("requires HTTPS except explicitly allowed loopback HTTP", () => {
    expect(() =>
      McpServerConfigSchema.parse({
        ...httpServer(),
        transport: { type: "streamable-http", url: "http://mcp.example.test/mcp" },
      }),
    ).toThrow();
    expect(
      McpServerConfigSchema.parse({
        ...httpServer(),
        transport: {
          type: "streamable-http",
          url: "http://127.0.0.1:9999/mcp",
          allowInsecureLoopback: true,
        },
      }).transport.type,
    ).toBe("streamable-http");
  });

  it("rejects plaintext secret-looking stdio env and duplicate tool policy", () => {
    expect(() =>
      McpServerConfigSchema.parse({
        ...httpServer(),
        transport: { type: "stdio", command: "node", env: { API_TOKEN: "plaintext" } },
      }),
    ).toThrow();
    expect(() =>
      McpServerConfigSchema.parse({
        ...httpServer(),
        toolPolicies: [
          { name: "search", enabled: true, actionClass: "READ" },
          { name: "search", enabled: false, actionClass: "READ" },
        ],
      }),
    ).toThrow();
  });

  it("fails closed when its exclusive lock is already held", () => {
    const path = pathForTest();
    writeFileSync(`${path}.lock`, "held\n", { mode: 0o600 });
    expect(() => new FileMcpRegistry(path).upsert(httpServer())).toThrow(McpRegistryBusyError);
  });

  it("updates per-tool enablement without duplicating policy", () => {
    const path = pathForTest();
    const registry = new FileMcpRegistry(path);
    registry.upsert(httpServer());
    const next = registry.setToolPolicy("docs", {
      name: "search",
      enabled: false,
      actionClass: "READ",
    });
    expect(next.toolPolicies).toEqual([
      { name: "search", enabled: false, actionClass: "READ" },
    ]);
  });
});
