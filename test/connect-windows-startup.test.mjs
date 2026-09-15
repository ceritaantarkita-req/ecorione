import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(cwd(), "services/connect/src/mcp-client/sdk-client.ts"),
  "utf8",
);

describe("Connect Windows startup boundary", () => {
  it("keeps MCP runtime transports out of the eager Connect module graph", () => {
    expect(source).not.toMatch(
      /import\s*\{[\s\S]*?\}\s*from\s*["']@modelcontextprotocol\/client(?:\/stdio)?["'];/,
    );
    expect(source).toContain('loadClient: () => import("@modelcontextprotocol/client")');
    expect(source).toContain('loadStdio: () => import("@modelcontextprotocol/client/stdio")');
  });
});
