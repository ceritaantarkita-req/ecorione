import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ActionClassSchema,
  WorkspaceIdSchema,
} from "@ecorione/shared-schema";
import { FileCredentialVault } from "./credential-vault.js";
import { nowIso } from "./clock.js";
import { VaultMcpCredentialEditor } from "./mcp-client/credentials.js";
import { FileMcpRegistry } from "./mcp-client/registry.js";
import {
  McpCredentialRefSchema,
  McpServerConfigSchema,
  McpServerIdSchema,
} from "./mcp-client/types.js";

function defaultRegistryPath(): string {
  return resolve(import.meta.dirname, "../../../data/connect-mcp-registry.json");
}

function defaultVaultPath(): string {
  return resolve(import.meta.dirname, "../../../data/connect-credentials.vault.json");
}

function registry(): FileMcpRegistry {
  return new FileMcpRegistry(
    process.env.ECORIONE_MCP_OUTBOUND_REGISTRY_PATH ?? defaultRegistryPath(),
  );
}

function vault(): FileCredentialVault {
  const masterKey = process.env.ECORIONE_CONNECT_VAULT_MASTER_KEY;
  if (masterKey === undefined || masterKey.length === 0) {
    throw new Error("ECORIONE_CONNECT_VAULT_MASTER_KEY wajib untuk operasi credential MCP.");
  }
  return new FileCredentialVault(
    process.env.ECORIONE_CONNECT_VAULT_PATH ?? defaultVaultPath(),
    masterKey,
  );
}

function stdin(): string {
  return readFileSync(0, "utf8").replace(/\r?\n$/, "");
}

async function main(): Promise<void> {
  const [command, a, b, c, d] = process.argv.slice(2);
  if (command === "server:list") {
    const workspaceId = a === undefined ? undefined : WorkspaceIdSchema.parse(a);
    process.stdout.write(`${JSON.stringify(registry().list(workspaceId), null, 2)}\n`);
    return;
  }
  if (command === "server:upsert") {
    const config = McpServerConfigSchema.parse(JSON.parse(stdin()) as unknown);
    process.stdout.write(`${JSON.stringify(registry().upsert(config))}\n`);
    return;
  }
  if (command === "server:remove") {
    const id = McpServerIdSchema.parse(a);
    process.stdout.write(`${JSON.stringify({ removed: registry().remove(id) })}\n`);
    return;
  }
  if (command === "tool:set") {
    const id = McpServerIdSchema.parse(a);
    if (b === undefined || b.length === 0) throw new Error("tool name wajib diisi.");
    if (c !== "true" && c !== "false") throw new Error("enabled wajib true|false.");
    const actionClass = ActionClassSchema.parse(d);
    const server = registry().setToolPolicy(id, {
      name: b,
      enabled: c === "true",
      actionClass,
    });
    process.stdout.write(`${JSON.stringify(server)}\n`);
    return;
  }
  if (command === "credential:list") {
    const editor = new VaultMcpCredentialEditor(vault());
    process.stdout.write(`${JSON.stringify(editor.listRefs(), null, 2)}\n`);
    return;
  }
  if (command === "credential:set") {
    const ref = McpCredentialRefSchema.parse(a);
    new VaultMcpCredentialEditor(vault()).set(ref, stdin(), nowIso());
    process.stdout.write(`${JSON.stringify({ ref, updated: true })}\n`);
    return;
  }
  if (command === "credential:remove") {
    const ref = McpCredentialRefSchema.parse(a);
    const removed = new VaultMcpCredentialEditor(vault()).remove(ref, nowIso());
    process.stdout.write(`${JSON.stringify({ ref, removed })}\n`);
    return;
  }
  throw new Error(
    "Command: server:list [workspaceId] | server:upsert | server:remove <id> | tool:set <serverId> <tool> <true|false> <actionClass> | credential:list | credential:set <ref> | credential:remove <ref>",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
