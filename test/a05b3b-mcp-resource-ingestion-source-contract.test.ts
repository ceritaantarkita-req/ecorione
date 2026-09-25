import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-05b.3b Project MCP resource ingestion contract", () => {
  const sdk = readFileSync("services/connect/src/mcp-client/sdk-client.ts", "utf8");
  const manager = readFileSync("services/connect/src/mcp-client/manager.ts", "utf8");
  const governance = readFileSync("services/connect/src/mcp-client/governance.ts", "utf8");
  const source = readFileSync("services/connect/src/mcp-resource-source.ts", "utf8");
  const hub = readFileSync("services/hub/src/project-source-http.ts", "utf8");
  const ui = readFileSync("apps/ai/app/projects/ProjectSources.tsx", "utf8");

  it("reads only advertised MCP resources through explicit READ governance", () => {
    expect(sdk).toContain("client.readResource");
    expect(manager).toContain("client.listResources");
    expect(manager).toContain("McpResourceNotAdvertisedError");
    expect(manager).toContain('toolName: "resources.read"');
    expect(governance).toContain('"mcp.resource.read"');
    expect(governance).toContain('"mcp.read"');
    expect(governance).toContain('"MCP_RESOURCE_READ"');
  });

  it("normalizes bounded connector content before Artifact ownership", () => {
    expect(source).toContain("DEFAULT_EXTERNAL_SOURCE_MAX_BYTES");
    expect(source).toContain("strictBase64");
    expect(source).toContain("multipart campuran");
    expect(hub).toContain('"/v1/projects/:id/sources/ingest-mcp-resource"');
    expect(hub).toContain('candidate.resourceType === "mcp-server"');
    expect(hub).toContain("`${options.artifactUrl}/v1/artifacts`");
    expect(hub).toContain('sensitivity: "RESTRICTED"');
    expect(hub).toContain('syncClass: "LOCAL_ONLY"');
  });

  it("keeps chat/history and extraction out of connector snapshot ingestion", () => {
    expect(hub).not.toContain("sessionId");
    expect(hub).not.toContain("history.append");
    expect(hub).toContain('sourceType: "mcp-resource"');
    expect(ui).toContain("`${endpoint}/mcp-resources");
    expect(ui).toContain("`${endpoint}/ingest-mcp-resource`");
    expect(ui).toContain('"Browse resources"');
    expect(ui).toContain("Gunakan Extract pada Artifact");
  });
});
