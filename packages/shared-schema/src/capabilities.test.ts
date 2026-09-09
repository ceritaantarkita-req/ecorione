import { describe, expect, it } from "vitest";
import { CapabilityDefinitionSchema, CapabilityGrantRequestSchema } from "./capabilities.js";

const baseGrant = {
  operationId: "op_authoritygrant001",
  workspaceId: "ws_alpha",
  subject: { kind: "mcp-tool", id: "server/tool" },
  capabilityId: "mcp.tool.call",
  permissionIds: ["mcp.tool.read"],
  scope: "personal",
  maxSensitivity: "INTERNAL",
  autonomy: "L1",
  reason: "Allow explicit read tool.",
  idempotencyKey: "authority-grant-001",
} as const;

describe("capability authority schemas", () => {
  it("accepts a strict workspace-scoped grant", () => {
    const parsed = CapabilityGrantRequestSchema.parse(baseGrant);
    expect(parsed.subject.kind).toBe("mcp-tool");
    expect(parsed.permissionIds).toEqual(["mcp.tool.read"]);
  });

  it("rejects duplicate permission ids", () => {
    expect(() =>
      CapabilityGrantRequestSchema.parse({
        ...baseGrant,
        permissionIds: ["mcp.tool.read", "mcp.tool.read"],
      }),
    ).toThrow(/duplikat/);
  });

  it("rejects duplicate permission definitions", () => {
    const permission = {
      id: "tool.read",
      actionClass: "READ",
      resource: "system",
      access: "read",
      sideEffect: false,
      description: "Read.",
    } as const;
    expect(() =>
      CapabilityDefinitionSchema.parse({
        id: "tool.invoke",
        description: "Tool",
        permissions: [permission, permission],
      }),
    ).toThrow(/duplikat/);
  });
});
