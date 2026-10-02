import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 11 MCP Action product convergence", () => {
  const flow = readFileSync("apps/ai/app/flow/page.tsx", "utf8");
  const sections = readFileSync("apps/ai/app/flow/FlowPageSections.tsx", "utf8");
  const catalog = readFileSync("apps/ai/app/flow/useMcpActionCatalog.ts", "utf8");
  const proxy = readFileSync("apps/ai/lib/mcp-action-proxy.ts", "utf8");
  const activities = readFileSync("services/flow/src/graph-activities.ts", "utf8");
  const control = readFileSync("services/flow/src/graph-control.ts", "utf8");
  const adr = readFileSync("docs/adr/0040-mcp-action-flow-connect-boundary.md", "utf8");

  it("uses configured Connect MCP servers and explicit discovery instead of raw provider adapters", () => {
    expect(flow).toContain("useMcpActionCatalog");
    expect(catalog).toContain("/api/mcp-actions/servers?workspaceId=");
    expect(catalog).toContain("/api/mcp-actions/servers/");
    expect(sections).toContain('aria-label="MCP action server"');
    expect(sections).toContain('aria-label="MCP action tool"');
    expect(sections).toContain("Discover tools");
    expect(sections).not.toContain("gmail.googleapis.com");
    expect(sections).not.toContain("api.telegram.org");
  });

  it("keeps browser discovery read-only and unable to mint execution authority", () => {
    expect(proxy).toContain('autonomy: "L0"');
    expect(proxy).toContain('operationId: makeId("operation")');
    expect(proxy).toContain("/v1/mcp-outbound/servers/");
    expect(proxy).toContain("/discover");
    expect(proxy).not.toContain("/tools/");
    expect(proxy).not.toContain("/call");
    expect(proxy).not.toContain("autonomy: parsed.data");
  });

  it("resolves bounded structured templates before Connect sees MCP arguments", () => {
    expect(activities).toContain("renderGraphValueTemplates(cfg.arguments, input)");
    expect(control).toContain("MAX_GRAPH_TEMPLATE_DEPTH = 16");
    expect(control).toContain("MAX_GRAPH_TEMPLATE_ENTRIES = 1024");
    expect(control).toContain("EXACT_GRAPH_TEMPLATE");
    expect(control).not.toContain("eval(");
    expect(control).not.toContain("new Function(");
  });

  it("keeps Connect governance and provider-specific adapters outside this product slice", () => {
    expect(adr).toContain(
      "Connect tetap satu-satunya outbound MCP runtime/credential boundary",
    );
    expect(adr).toContain("actual resolved arguments");
    expect(adr).toContain("Provider-specific Gmail/Telegram adapter");
    expect(adr).toContain("tidak:");
    expect(adr).toContain("L4 / AutoClick");
  });
});
