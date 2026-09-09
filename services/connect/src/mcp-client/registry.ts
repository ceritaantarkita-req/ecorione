import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { WorkspaceId } from "@ecorione/shared-schema";
import { z } from "zod";
import {
  McpServerConfigSchema,
  type McpServerConfig,
  type McpServerId,
  type McpToolPolicy,
} from "./types.js";

const RegistryFileSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  servers: z.array(McpServerConfigSchema),
});
type RegistryFile = z.infer<typeof RegistryFileSchema>;

const EMPTY_REGISTRY: RegistryFile = { version: 1, revision: 0, servers: [] };

export class McpRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpRegistryError";
  }
}

export class McpRegistryBusyError extends McpRegistryError {
  constructor(path: string) {
    super(`MCP registry lock sedang aktif: ${path}.`);
    this.name = "McpRegistryBusyError";
  }
}

export class McpServerNotFoundError extends McpRegistryError {
  constructor(id: string) {
    super(`MCP server tidak ditemukan atau tidak terlihat di workspace ini: ${id}.`);
    this.name = "McpServerNotFoundError";
  }
}

function parseRegistry(raw: unknown): RegistryFile {
  try {
    const state = RegistryFileSchema.parse(raw);
    const ids = new Set<string>();
    for (const server of state.servers) {
      if (ids.has(server.id)) throw new McpRegistryError(`MCP server id duplikat: ${server.id}.`);
      ids.add(server.id);
    }
    return state;
  } catch (error) {
    if (error instanceof McpRegistryError) throw error;
    throw new McpRegistryError(
      `MCP registry tidak valid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readRegistry(path: string): RegistryFile {
  if (!existsSync(path)) return { ...EMPTY_REGISTRY, servers: [] };
  try {
    return parseRegistry(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof McpRegistryError) throw error;
    throw new McpRegistryError(
      `MCP registry gagal dibaca: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function writeRegistry(path: string, state: RegistryFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${String(process.pid)}`;
  writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tmpPath, path);
  chmodSync(path, 0o600);
}

function withRegistryLock<T>(path: string, fn: () => T): T {
  mkdirSync(dirname(path), { recursive: true });
  const lockPath = `${path}.lock`;
  let fd: number;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "EEXIST"
    ) {
      throw new McpRegistryBusyError(lockPath);
    }
    throw error;
  }
  try {
    writeFileSync(fd, "locked\n", "utf8");
    return fn();
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

function visibleIn(server: McpServerConfig, workspaceId: WorkspaceId): boolean {
  return server.workspaceIds.includes(workspaceId);
}

export class FileMcpRegistry {
  constructor(private readonly path: string) {}

  list(workspaceId?: WorkspaceId): readonly McpServerConfig[] {
    const servers = readRegistry(this.path).servers;
    return workspaceId === undefined ? servers : servers.filter((server) => visibleIn(server, workspaceId));
  }

  get(id: McpServerId, workspaceId: WorkspaceId): McpServerConfig {
    const server = readRegistry(this.path).servers.find(
      (candidate) => candidate.id === id && visibleIn(candidate, workspaceId),
    );
    if (server === undefined) throw new McpServerNotFoundError(id);
    return server;
  }

  upsert(input: McpServerConfig): McpServerConfig {
    const server = McpServerConfigSchema.parse(input);
    return withRegistryLock(this.path, () => {
      const state = readRegistry(this.path);
      const servers = state.servers
        .filter((candidate) => candidate.id !== server.id)
        .concat(server)
        .sort((a, b) => a.id.localeCompare(b.id));
      writeRegistry(this.path, { version: 1, revision: state.revision + 1, servers });
      return server;
    });
  }

  remove(id: McpServerId): boolean {
    return withRegistryLock(this.path, () => {
      const state = readRegistry(this.path);
      const servers = state.servers.filter((candidate) => candidate.id !== id);
      if (servers.length === state.servers.length) return false;
      writeRegistry(this.path, { version: 1, revision: state.revision + 1, servers });
      return true;
    });
  }

  setToolPolicy(serverId: McpServerId, policy: McpToolPolicy): McpServerConfig {
    return withRegistryLock(this.path, () => {
      const state = readRegistry(this.path);
      const index = state.servers.findIndex((candidate) => candidate.id === serverId);
      if (index < 0) throw new McpServerNotFoundError(serverId);
      const prior = state.servers[index]!;
      const server = McpServerConfigSchema.parse({
        ...prior,
        toolPolicies: prior.toolPolicies
          .filter((candidate) => candidate.name !== policy.name)
          .concat(policy)
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
      const servers = [...state.servers];
      servers[index] = server;
      writeRegistry(this.path, { version: 1, revision: state.revision + 1, servers });
      return server;
    });
  }
}
