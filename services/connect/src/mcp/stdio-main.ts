/** MCP stdio entrypoint for local clients (Claude Code/Cursor/VS Code). */
import { createInterface } from "node:readline";
import { ScopeSchema, SensitivitySchema } from "@ecorione/shared-schema";
import { z } from "zod";
import { epochMs } from "./clock.js";
import { parseHandleKey } from "./handle.js";
import { dispatchMcpRequest } from "./server.js";

const scopes = z.array(ScopeSchema).min(1).parse(
  (process.env.ECORIONE_MCP_SCOPES ?? "personal")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const maxSensitivity = SensitivitySchema.parse(process.env.ECORIONE_MCP_MAX_SENSITIVITY ?? "RESTRICTED");
const handleKey = parseHandleKey(process.env.ECORIONE_MCP_HANDLE_KEY);
const hubUrl = process.env.ECORIONE_HUB_URL ?? "http://127.0.0.1:17024";
const internalToken = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const principalId = process.env.ECORIONE_MCP_PRINCIPAL ?? "local-user";

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });

for await (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.length === 0) continue;
  try {
    const raw = JSON.parse(trimmed) as unknown;
    const response = await dispatchMcpRequest(raw, {
      hubUrl,
      internalToken,
      handleKey,
      principalId,
      allowedScopes: scopes,
      maxSensitivity,
      delivery: "local",
      sourceApp: "mcp-stdio",
      nowMs: epochMs(),
    });
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stderr.write(`ecorione MCP stdio parse/dispatch error: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
