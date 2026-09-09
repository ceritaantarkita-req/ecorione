/** Sandbox executor: Tier 0 guard, Tier 1.5 WASM, Tier 1 Docker hardening. */
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  SandboxExecutionReceiptSchema,
  type SandboxExecutionReceipt,
  type SandboxExecutionRequest,
} from "@ecorione/shared-schema";
import type { SandboxControlPlane } from "./clients.js";
import { nowIso } from "./clock.js";
import type { SandboxReceiptStore } from "./receipt-store.js";

const MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DESTRUCTIVE = new Set([
  "rm",
  "rmdir",
  "del",
  "erase",
  "format",
  "mkfs",
  "dd",
  "shutdown",
  "reboot",
  "poweroff",
]);
const SHELL_META = /[;&|><`$()]/;
const SAFE_GIT = new Set(["status", "diff", "log", "show"]);

export class SandboxBoundaryError extends Error {}
export class SandboxApprovalRequiredError extends Error {}

function assertWorkspace(root: string, requested: string): string {
  const rootAbs = resolve(root);
  const workspace = resolve(requested);
  const rel = relative(rootAbs, workspace);
  if (
    rel === ".." ||
    rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(rel)
  ) {
    throw new SandboxBoundaryError("Workspace berada di luar ECORIONE_SANDBOX_WORKSPACE_ROOT.");
  }
  if (!existsSync(workspace) || !statSync(workspace).isDirectory()) {
    throw new SandboxBoundaryError("Workspace tidak ditemukan atau bukan direktori.");
  }
  return workspace;
}

function tokenize(command: string): string[] {
  if (SHELL_META.test(command))
    throw new SandboxBoundaryError("Shell metacharacter ditolak Tier 0.");
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new SandboxBoundaryError("Command kosong.");
  for (const token of tokens) {
    if (token === ".." || token.includes("../") || token.includes("..\\")) {
      throw new SandboxBoundaryError("Path traversal ditolak Tier 0.");
    }
    if (DESTRUCTIVE.has(token.toLowerCase())) {
      throw new SandboxBoundaryError(`Verb destruktif ditolak Tier 0: ${token}`);
    }
  }
  return tokens;
}

function assertSafeHostCommand(tokens: readonly string[]): void {
  const [exe, sub, ...rest] = tokens;
  if (exe === "pwd" && tokens.length === 1) return;
  if (exe === "ls") return;
  if (exe === "cat" && rest.length === 0 && sub !== undefined && !sub.startsWith("/")) return;
  if (
    exe === "git" &&
    sub !== undefined &&
    SAFE_GIT.has(sub) &&
    !rest.some(
      (arg) => arg === "-C" || arg.startsWith("--git-dir") || arg.startsWith("--work-tree"),
    )
  ) {
    return;
  }
  throw new SandboxBoundaryError(
    "Tier 0 host hanya mengizinkan pwd, ls, cat path-relatif, dan git status/diff/log/show.",
  );
}

export interface DockerPlan {
  readonly executable: "docker";
  readonly args: readonly string[];
}

export function buildDockerPlan(
  workspace: string,
  command: string,
  image = "node:22-alpine",
): DockerPlan {
  tokenize(command);
  return {
    executable: "docker",
    args: [
      "run",
      "--rm",
      "--network=none",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--user=65532:65532",
      "--memory=512m",
      "--cpus=1",
      "--pids-limit=128",
      "--mount",
      `type=bind,src=${workspace},dst=/workspace`,
      "--workdir=/workspace",
      image,
      "sh",
      "-lc",
      command,
    ],
  };
}

async function runProcess(
  executable: string,
  args: readonly string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, [...args], { cwd, shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const append = (current: string, chunk: Buffer): string =>
      (current + chunk.toString("utf8")).slice(0, MAX_OUTPUT_BYTES);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

type WasmModuleHandle = object;
interface WasmRuntime {
  readonly Module: {
    new (bytes: Uint8Array): WasmModuleHandle;
    imports(module: WasmModuleHandle): readonly unknown[];
  };
  readonly Instance: new (
    module: WasmModuleHandle,
    imports: Record<string, never>,
  ) => { exports: Record<string, unknown> };
}

function wasmRuntime(): WasmRuntime {
  const runtime = (globalThis as unknown as { WebAssembly?: WasmRuntime }).WebAssembly;
  if (runtime === undefined) {
    throw new SandboxBoundaryError("Runtime WebAssembly tidak tersedia di Node ini.");
  }
  return runtime;
}

function runWasm(request: SandboxExecutionRequest): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  if (request.wasmBase64 === null)
    throw new SandboxBoundaryError("tier1.5 membutuhkan wasmBase64.");
  const wasm = wasmRuntime();
  const module = new wasm.Module(Buffer.from(request.wasmBase64, "base64"));
  if (wasm.Module.imports(module).length !== 0) {
    throw new SandboxBoundaryError("WASM dengan host imports ditolak: zero ambient authority.");
  }
  const instance = new wasm.Instance(module, {});
  const candidate = instance.exports[request.wasmExport];
  if (typeof candidate !== "function") {
    throw new SandboxBoundaryError(`Export WASM tidak ditemukan: ${request.wasmExport}`);
  }
  const result = (candidate as (...args: number[]) => unknown)(...request.wasmArgs);
  return { exitCode: 0, stdout: result === undefined ? "" : String(result), stderr: "" };
}

export class SandboxExecutor {
  constructor(
    private readonly workspaceRoot: string,
    private readonly control: SandboxControlPlane,
    private readonly receipts: SandboxReceiptStore,
  ) {}

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecutionReceipt> {
    const prior = this.receipts.get(request.idempotencyKey);
    if (prior !== null) return prior;
    const workspace = assertWorkspace(this.workspaceRoot, request.workspace);
    const verdict = await this.control.evaluate({
      operationId: request.operationId,
      module: "Sandbox",
      tool: `sandbox.${request.tier}`,
      actionClass: request.irreversible ? "IRREVERSIBLE_WRITE" : "EXECUTE",
      args: { tier: request.tier, workspace },
      scope: request.scope,
      sensitivity: request.sensitivity,
      autonomy: "L2",
      idempotencyKey: request.idempotencyKey,
    });
    if (verdict.outcome === "REQUIRE_APPROVAL") {
      throw new SandboxApprovalRequiredError(verdict.reason);
    }
    if (verdict.outcome === "DENY") throw new SandboxBoundaryError(verdict.reason);

    const recordedAt = nowIso();
    await this.control.trace({
      name: "sandbox.execution.requested",
      operationId: request.operationId,
      recordedAt,
      attributes: { tier: request.tier, workspace, irreversible: request.irreversible },
    });
    const start = process.hrtime.bigint();
    let result: { exitCode: number; stdout: string; stderr: string };
    if (request.tier === "tier0") {
      if (request.command === null)
        throw new SandboxBoundaryError("tier0 membutuhkan command.");
      const tokens = tokenize(request.command);
      assertSafeHostCommand(tokens);
      const [exe, ...args] = tokens;
      if (exe === undefined) throw new SandboxBoundaryError("Command kosong.");
      result = await runProcess(exe, args, workspace);
    } else if (request.tier === "tier1.5") {
      result = runWasm(request);
    } else {
      if (request.command === null)
        throw new SandboxBoundaryError("tier1 membutuhkan command.");
      const plan = buildDockerPlan(workspace, request.command);
      result = await runProcess(plan.executable, plan.args, workspace);
    }
    const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    const receipt = SandboxExecutionReceiptSchema.parse({
      id: `sbx_${request.operationId.slice("op_".length)}`,
      tier: request.tier,
      command: request.command,
      exitCode: result.exitCode,
      durationMs,
      operationId: request.operationId,
      recordedAt,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    this.receipts.put(request.idempotencyKey, receipt);
    await this.control.trace({
      name: "sandbox.execution.completed",
      operationId: request.operationId,
      recordedAt: nowIso(),
      attributes: {
        tier: request.tier,
        exitCode: result.exitCode,
        durationMs,
        receiptId: receipt.id,
      },
    });
    return receipt;
  }
}
