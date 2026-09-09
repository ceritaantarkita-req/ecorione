import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OperationIdSchema, TimestampSchema } from "@ecorione/shared-schema";
import { afterEach, describe, expect, it } from "vitest";
import {
  FileMcpInvocationStore,
  McpInvocationConflictError,
  McpInvocationOutcomeUncertainError,
  McpInvocationStoreBusyError,
} from "./invocation-store.js";

const dirs: string[] = [];
function statePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ecorione-mcp-invocation-"));
  dirs.push(dir);
  return join(dir, "invocations.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const now = TimestampSchema.parse("2026-09-09T12:00:00.000Z");
const operationId = OperationIdSchema.parse("op_call1");
const digest = "a".repeat(64);
function input(key = "12345678abcdefgh") {
  return {
    idempotencyKey: key,
    operationId,
    serverId: "server-a",
    toolName: "write",
    argsDigest: digest,
    now,
  } as const;
}

describe("FileMcpInvocationStore", () => {
  it("persists settled result and deduplicates after restart", () => {
    const path = statePath();
    const store = new FileMcpInvocationStore(path);
    expect(store.reserve(input()).kind).toBe("reserved");
    store.settle("12345678abcdefgh", { content: [{ type: "text", text: "ok" }] }, now);
    const retried = new FileMcpInvocationStore(path).reserve(input());
    expect(retried.kind).toBe("settled");
    expect(retried.entry.result).toEqual({ content: [{ type: "text", text: "ok" }] });
  });

  it("blocks redispatch after reserved or uncertain outcome", () => {
    const path = statePath();
    const store = new FileMcpInvocationStore(path);
    store.reserve(input());
    expect(() => store.reserve(input())).toThrow(McpInvocationOutcomeUncertainError);
    store.markUncertain("12345678abcdefgh");
    expect(() => new FileMcpInvocationStore(path).reserve(input())).toThrow(
      McpInvocationOutcomeUncertainError,
    );
  });

  it("rejects the same idempotency key for a different invocation", () => {
    const store = new FileMcpInvocationStore(statePath());
    store.reserve(input());
    expect(() => store.reserve({ ...input(), toolName: "other" })).toThrow(
      McpInvocationConflictError,
    );
  });

  it("fails closed when lock exists", () => {
    const path = statePath();
    writeFileSync(`${path}.lock`, "held\n", { mode: 0o600 });
    expect(() => new FileMcpInvocationStore(path).reserve(input())).toThrow(
      McpInvocationStoreBusyError,
    );
  });
});
