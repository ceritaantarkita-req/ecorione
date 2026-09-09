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
import { OperationIdSchema, TimestampSchema, type OperationId, type Timestamp } from "@ecorione/shared-schema";
import { z } from "zod";
import { McpServerIdSchema, type McpServerId } from "./types.js";

const InvocationStatusSchema = z.enum(["reserved", "uncertain", "settled"]);
const InvocationEntrySchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  operationId: OperationIdSchema,
  serverId: McpServerIdSchema,
  toolName: z.string().min(1).max(128),
  argsDigest: z.string().regex(/^[a-f0-9]{64}$/),
  status: InvocationStatusSchema,
  result: z.unknown().nullable(),
  createdAt: TimestampSchema,
  settledAt: TimestampSchema.nullable(),
});
export type McpInvocationEntry = z.infer<typeof InvocationEntrySchema>;

const InvocationFileSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  entries: z.array(InvocationEntrySchema),
});
type InvocationFile = z.infer<typeof InvocationFileSchema>;

export interface McpInvocationReservationInput {
  readonly idempotencyKey: string;
  readonly operationId: OperationId;
  readonly serverId: McpServerId;
  readonly toolName: string;
  readonly argsDigest: string;
  readonly now: Timestamp;
}

export type McpInvocationReservation =
  | { readonly kind: "reserved"; readonly entry: McpInvocationEntry }
  | { readonly kind: "settled"; readonly entry: McpInvocationEntry };

const EMPTY_FILE: InvocationFile = { version: 1, revision: 0, entries: [] };

export class McpInvocationStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpInvocationStoreError";
  }
}

export class McpInvocationStoreBusyError extends McpInvocationStoreError {
  constructor(path: string) {
    super(`MCP invocation store lock sedang aktif: ${path}.`);
    this.name = "McpInvocationStoreBusyError";
  }
}

export class McpInvocationConflictError extends McpInvocationStoreError {
  constructor(key: string) {
    super(`Idempotency key MCP dipakai untuk invocation yang berbeda: ${key}.`);
    this.name = "McpInvocationConflictError";
  }
}

export class McpInvocationOutcomeUncertainError extends McpInvocationStoreError {
  constructor(key: string, status: "reserved" | "uncertain") {
    super(
      `Invocation MCP ${key} berstatus ${status}; redispatch otomatis ditolak karena outcome remote mungkin sudah terjadi.`,
    );
    this.name = "McpInvocationOutcomeUncertainError";
  }
}

export class McpInvocationNotFoundError extends McpInvocationStoreError {
  constructor(key: string) {
    super(`Invocation MCP tidak ditemukan: ${key}.`);
    this.name = "McpInvocationNotFoundError";
  }
}

function readState(path: string): InvocationFile {
  if (!existsSync(path)) return { ...EMPTY_FILE, entries: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new McpInvocationStoreError(
      `MCP invocation store gagal dibaca: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    const state = InvocationFileSchema.parse(parsed);
    const keys = new Set<string>();
    for (const entry of state.entries) {
      if (keys.has(entry.idempotencyKey)) {
        throw new McpInvocationStoreError(
          `MCP invocation store memiliki idempotency key duplikat: ${entry.idempotencyKey}.`,
        );
      }
      keys.add(entry.idempotencyKey);
    }
    return state;
  } catch (error) {
    if (error instanceof McpInvocationStoreError) throw error;
    throw new McpInvocationStoreError(
      `MCP invocation store tidak valid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function writeState(path: string, state: InvocationFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${String(process.pid)}`;
  writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(tmpPath, path);
  chmodSync(path, 0o600);
}

function withLock<T>(path: string, fn: () => T): T {
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
      throw new McpInvocationStoreBusyError(lockPath);
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

function sameInvocation(
  entry: McpInvocationEntry,
  input: McpInvocationReservationInput,
): boolean {
  return (
    entry.serverId === input.serverId &&
    entry.toolName === input.toolName &&
    entry.argsDigest === input.argsDigest
  );
}

export class FileMcpInvocationStore {
  constructor(private readonly path: string) {}

  reserve(input: McpInvocationReservationInput): McpInvocationReservation {
    const normalized = InvocationEntrySchema.parse({
      ...input,
      status: "reserved",
      result: null,
      settledAt: null,
    });
    return withLock(this.path, () => {
      const state = readState(this.path);
      const prior = state.entries.find(
        (entry) => entry.idempotencyKey === normalized.idempotencyKey,
      );
      if (prior !== undefined) {
        if (!sameInvocation(prior, input)) {
          throw new McpInvocationConflictError(normalized.idempotencyKey);
        }
        if (prior.status === "settled") return { kind: "settled", entry: prior };
        throw new McpInvocationOutcomeUncertainError(normalized.idempotencyKey, prior.status);
      }
      writeState(this.path, {
        version: 1,
        revision: state.revision + 1,
        entries: [...state.entries, normalized],
      });
      return { kind: "reserved", entry: normalized };
    });
  }

  settle(idempotencyKey: string, result: unknown, now: Timestamp): McpInvocationEntry {
    const settledAt = TimestampSchema.parse(now);
    return withLock(this.path, () => {
      const state = readState(this.path);
      const index = state.entries.findIndex((entry) => entry.idempotencyKey === idempotencyKey);
      if (index < 0) throw new McpInvocationNotFoundError(idempotencyKey);
      const prior = state.entries[index]!;
      if (prior.status === "settled") return prior;
      const entry = InvocationEntrySchema.parse({
        ...prior,
        status: "settled",
        result,
        settledAt,
      });
      const entries = [...state.entries];
      entries[index] = entry;
      writeState(this.path, { version: 1, revision: state.revision + 1, entries });
      return entry;
    });
  }

  markUncertain(idempotencyKey: string): McpInvocationEntry {
    return withLock(this.path, () => {
      const state = readState(this.path);
      const index = state.entries.findIndex((entry) => entry.idempotencyKey === idempotencyKey);
      if (index < 0) throw new McpInvocationNotFoundError(idempotencyKey);
      const prior = state.entries[index]!;
      if (prior.status !== "reserved") return prior;
      const entry = InvocationEntrySchema.parse({ ...prior, status: "uncertain" });
      const entries = [...state.entries];
      entries[index] = entry;
      writeState(this.path, { version: 1, revision: state.revision + 1, entries });
      return entry;
    });
  }

  entries(): readonly McpInvocationEntry[] {
    return readState(this.path).entries;
  }
}
