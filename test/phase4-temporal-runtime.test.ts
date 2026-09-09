import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FlowWorkflowInputSchema,
  assertId,
  type FlowApprovalSignal,
  type FlowStartResponse,
  type FlowWorkflowInput,
  type OperationId,
  type SandboxExecutionReceipt,
  type WorkflowId,
} from "../packages/shared-schema/src/index.js";
import { httpJson } from "../packages/shared-server/src/client.js";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it, vi } from "vitest";
import { buildConnectServer } from "../services/connect/src/http.js";
import type { FlowActivities } from "../services/flow/src/activities.js";
import { buildFlowServer } from "../services/flow/src/http.js";
import {
  FLOW_TASK_QUEUE,
  FLOW_WORKFLOW_TYPE,
  type FlowTemporalClient,
} from "../services/flow/src/temporal-client.js";
import { openHubDatabase } from "../services/hub/src/db.js";
import { buildHubServer } from "../services/hub/src/http.js";
import { openRndDatabase } from "../services/rnd/src/db.js";
import { buildRndServer } from "../services/rnd/src/http.js";
import { createSandboxControlPlane } from "../services/sandbox/src/clients.js";
import { SandboxExecutor } from "../services/sandbox/src/executor.js";
import { buildSandboxServer } from "../services/sandbox/src/http.js";
import { SandboxReceiptStore } from "../services/sandbox/src/receipt-store.js";

function input(): FlowWorkflowInput {
  return FlowWorkflowInputSchema.parse({
    flowId: assertId("workflow", "wf_runtime_restart_001"),
    operationId: assertId("operation", "op_runtime_restart_001"),
    scope: "personal",
    sensitivity: "INTERNAL",
    inputText: "  durable   restart   input ",
    delayMs: 0,
    approvalPrompt: "Approve after worker restart",
    aiTarget: "local",
    aiMessage: "Summarize",
    execution: {
      tier: "tier0",
      workspace: "/tmp/work",
      command: "pwd",
      wasmBase64: null,
      wasmExport: "run",
      wasmArgs: [],
    },
  });
}

function receipt(): SandboxExecutionReceipt {
  return {
    id: "sbx_runtime_restart_001",
    tier: "tier0",
    command: "pwd",
    exitCode: 0,
    durationMs: 1,
    operationId: assertId("operation", "op_runtime_restart_001-execution"),
    recordedAt: "2026-09-09T00:00:00.000Z",
    stdout: "/tmp/work\n",
    stderr: "",
  };
}

async function waitUntil(
  check: () => boolean | Promise<boolean>,
  label = "state",
): Promise<void> {
  for (let attempt = 0; attempt < 1600; attempt += 1) {
    if (await check()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

interface FastifyLike {
  listen(options: { port: number; host: string }): Promise<string>;
  close(): Promise<void>;
  server: { address(): string | { port: number } | null };
}

async function listen(app: FastifyLike): Promise<string> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string")
    throw new Error("Service address gagal.");
  return `http://127.0.0.1:${String(address.port)}`;
}

async function localProvider(): Promise<{
  readonly server: HttpServer;
  readonly baseUrl: string;
  readonly calls: () => number;
}> {
  let calls = 0;
  const server = createHttpServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404).end();
      return;
    }
    calls += 1;
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        model: "qwen3:8b-instruct-q4_K_M",
        choices: [{ message: { content: "AI vertical reply" } }],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Provider address gagal.");
  return {
    server,
    baseUrl: `http://127.0.0.1:${String(address.port)}/v1`,
    calls: () => calls,
  };
}

function temporalAdapter(env: TestWorkflowEnvironment): FlowTemporalClient {
  return {
    async start(workflow): Promise<void> {
      await env.client.workflow.start(FLOW_WORKFLOW_TYPE, {
        workflowId: workflow.flowId,
        taskQueue: FLOW_TASK_QUEUE,
        args: [workflow],
      });
    },
    async signal(flowId: WorkflowId, signal: FlowApprovalSignal): Promise<void> {
      await env.client.workflow.getHandle(flowId).signal("approval", signal);
    },
    async operationId(flowId: WorkflowId): Promise<OperationId> {
      return env.client.workflow.getHandle(flowId).query<OperationId>("operationId");
    },
    async describe(flowId: WorkflowId) {
      const description = await env.client.workflow.getHandle(flowId).describe();
      return { status: description.status.name };
    },
  };
}

function workerProcess(input: {
  temporalAddress: string;
  hubUrl: string;
  connectUrl: string;
  sandboxUrl: string;
  rndUrl: string;
}): ChildProcess {
  const root = fileURLToPath(new URL("../", import.meta.url));
  return spawn(process.execPath, ["--import", "tsx", "services/flow/src/worker-main.ts"], {
    cwd: root,
    env: {
      ...process.env,
      ECORIONE_TEMPORAL_ADDRESS: input.temporalAddress,
      ECORIONE_TEMPORAL_NAMESPACE: "default",
      ECORIONE_HUB_URL: input.hubUrl,
      ECORIONE_CONNECT_URL: input.connectUrl,
      ECORIONE_SANDBOX_URL: input.sandboxUrl,
      ECORIONE_RND_URL: input.rndUrl,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function assertWorkerAlive(child: ChildProcess, label: string): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    throw new Error(
      `${label} exited before recovery: exit=${String(child.exitCode)} signal=${String(child.signalCode)}`,
    );
  }
}

async function killWorker(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGKILL");
  await withTimeout(once(child, "exit"), `worker ${String(child.pid)} exit`, 5000);
}

async function auditTypes(hubUrl: string, operationId: string): Promise<string[]> {
  const result = await httpJson<{ events: Array<{ type: string }> }>(
    `${hubUrl}/v1/audit?operationId=${encodeURIComponent(operationId)}`,
  );
  return result.events.map((event) => event.type);
}

async function traceNames(rndUrl: string, operationId: string): Promise<string[]> {
  const result = await httpJson<{ traces: Array<{ name: string }> }>(
    `${rndUrl}/v1/traces?operationId=${encodeURIComponent(operationId)}&limit=100`,
  );
  return result.traces.map((trace) => trace.name);
}

describe("Fase 4 real Temporal restart acceptance", () => {
  it("keeps workflow durable across worker shutdown and resumes on a replacement worker", async () => {
    const env = await TestWorkflowEnvironment.createLocal();
    const taskQueue = "flow-runtime-restart";
    const requestApproval = vi.fn(async () => undefined);
    const callAi = vi.fn(async () => ({ reply: "AI after restart" }));
    const executeSandbox = vi.fn(async () => receipt());
    const verifyExecution = vi.fn(async () => true);
    const recordTrace = vi.fn(async () => undefined);
    const activities: FlowActivities = {
      requestApproval,
      callAi,
      executeSandbox,
      verifyExecution,
      recordTrace,
    };
    const workflowsPath = fileURLToPath(
      new URL("../services/flow/src/workflows.ts", import.meta.url),
    );

    let workerOneRun: Promise<void> | null = null;
    let workerTwoRun: Promise<void> | null = null;
    let workerOne: Worker | null = null;
    let workerTwo: Worker | null = null;
    try {
      workerOne = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities,
      });
      workerOneRun = workerOne.run();

      const workflowInput = input();
      const handle = await env.client.workflow.start(FLOW_WORKFLOW_TYPE, {
        workflowId: workflowInput.flowId,
        taskQueue,
        args: [workflowInput],
      });

      await waitUntil(() => requestApproval.mock.calls.length === 1, "approval activity");
      expect((await handle.describe()).status.name).toBe("RUNNING");

      workerOne.shutdown();
      await workerOneRun;
      workerOne = null;
      workerOneRun = null;

      expect((await handle.describe()).status.name).toBe("RUNNING");

      workerTwo = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities,
      });
      workerTwoRun = workerTwo.run();

      await handle.signal("approval", { decision: "APPROVE", note: "resume" });
      const result = await handle.result();

      expect(result).toEqual({
        flowId: workflowInput.flowId,
        operationId: workflowInput.operationId,
        transformed: "durable restart input",
        aiReply: "AI after restart",
        sandboxReceiptId: "sbx_runtime_restart_001",
        verified: true,
      });
      expect(requestApproval).toHaveBeenCalledTimes(1);
      expect(callAi).toHaveBeenCalledTimes(1);
      expect(executeSandbox).toHaveBeenCalledTimes(1);
      expect(verifyExecution).toHaveBeenCalledTimes(1);
    } finally {
      if (workerOne !== null) workerOne.shutdown();
      if (workerTwo !== null) workerTwo.shutdown();
      if (workerOneRun !== null) await workerOneRun.catch(() => undefined);
      if (workerTwoRun !== null) await workerTwoRun.catch(() => undefined);
      await env.teardown();
    }
  }, 60_000);

  it.skipIf(process.env.ECORIONE_PHASE4_PROCESS_ACCEPTANCE !== "1")(
    "survives forced worker crashes and completes through real Hub, Connect, Sandbox and RnD boundaries",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "ecorione-phase4-"));
      const workspace = join(root, "workspace");
      mkdirSync(workspace);
      const env = await TestWorkflowEnvironment.createLocal();
      const provider = await localProvider();
      const rndDb = openRndDatabase(":memory:");
      const hubDb = openHubDatabase(":memory:");
      const rnd = buildRndServer(rndDb);
      let connect: ReturnType<typeof buildConnectServer> | null = null;
      let hub: ReturnType<typeof buildHubServer> | null = null;
      let sandbox: ReturnType<typeof buildSandboxServer> | null = null;
      let flow: ReturnType<typeof buildFlowServer> | null = null;
      let childOne: ChildProcess | null = null;
      let childTwo: ChildProcess | null = null;
      let childThree: ChildProcess | null = null;

      try {
        const rndUrl = await listen(rnd);
        connect = buildConnectServer({
          localBaseUrl: provider.baseUrl,
          localModelTag: "qwen3:8b-instruct-q4_K_M",
        });
        const connectUrl = await listen(connect);
        hub = buildHubServer(hubDb, {
          contextUrl: "http://127.0.0.1:1",
          connectUrl,
          rndUrl,
        });
        const hubUrl = await listen(hub);
        const control = createSandboxControlPlane({ hubUrl, rndUrl });
        const executor = new SandboxExecutor(
          root,
          control,
          new SandboxReceiptStore(join(root, "receipts")),
        );
        sandbox = buildSandboxServer(executor);
        const sandboxUrl = await listen(sandbox);
        flow = buildFlowServer(temporalAdapter(env), { hubUrl });

        const runtime = {
          temporalAddress: env.address,
          hubUrl,
          connectUrl,
          sandboxUrl,
          rndUrl,
        };
        childOne = workerProcess(runtime);
        await once(childOne, "spawn");

        const start = await flow.inject({
          method: "POST",
          url: "/v1/flows",
          payload: {
            scope: "personal",
            sensitivity: "INTERNAL",
            inputText: "  real   vertical   flow ",
            delayMs: 3000,
            approvalPrompt: "Approve real vertical execution",
            aiTarget: "local",
            aiMessage: "Summarize the transformed input.",
            execution: {
              tier: "tier0",
              workspace,
              command: "pwd",
              wasmBase64: null,
              wasmExport: "run",
              wasmArgs: [],
            },
          },
        });
        expect(start.statusCode).toBe(202);
        const started = start.json() as FlowStartResponse;
        const handle = env.client.workflow.getHandle(started.flowId);

        await waitUntil(
          async () => (await traceNames(rndUrl, started.operationId)).includes("flow.started"),
          "flow.started trace",
        );
        expect((await handle.describe()).status.name).toBe("RUNNING");

        await killWorker(childOne);
        childOne = null;
        expect((await handle.describe()).status.name).toBe("RUNNING");

        childTwo = workerProcess(runtime);
        await once(childTwo, "spawn");
        await waitUntil(async () => {
          if (childTwo === null) throw new Error("Replacement worker #2 hilang.");
          assertWorkerAlive(childTwo, "Replacement worker #2");
          return (await auditTypes(hubUrl, started.operationId)).includes("APPROVAL_REQUESTED");
        }, "durable Hub approval");

        await killWorker(childTwo);
        childTwo = null;
        expect((await handle.describe()).status.name).toBe("RUNNING");
        expect(await auditTypes(hubUrl, started.operationId)).toContain("APPROVAL_REQUESTED");

        childThree = workerProcess(runtime);
        await once(childThree, "spawn");
        assertWorkerAlive(childThree, "Replacement worker #3");
        const decision = await withTimeout(
          flow.inject({
            method: "POST",
            url: `/v1/flows/${started.flowId}/decision`,
            payload: { decision: "APPROVE", note: "runtime acceptance" },
          }),
          "Flow decision commit + Temporal signal",
          10_000,
        );
        expect(decision.statusCode).toBe(200);

        const result = (await withTimeout(
          handle.result(),
          "Temporal workflow completion after replacement worker",
          30_000,
        )) as {
          transformed: string;
          aiReply: string;
          sandboxReceiptId: string;
          verified: boolean;
        };
        expect(result.transformed).toBe("real vertical flow");
        expect(result.aiReply).toBe("AI vertical reply");
        expect(result.sandboxReceiptId).toMatch(/^sbx_/);
        expect(result.verified).toBe(true);
        expect(provider.calls()).toBe(1);

        const rootAudit = await auditTypes(hubUrl, started.operationId);
        expect(rootAudit).toContain("APPROVAL_REQUESTED");
        expect(rootAudit).toContain("APPROVAL_DECIDED");
        const rootTraces = await traceNames(rndUrl, started.operationId);
        expect(rootTraces).toContain("flow.started");
        expect(rootTraces).toContain("flow.approval.waiting");
        expect(rootTraces).toContain("flow.completed");
        const executionTraces = await traceNames(rndUrl, `${started.operationId}-execution`);
        expect(executionTraces).toContain("sandbox.execution.requested");
        expect(executionTraces).toContain("sandbox.execution.completed");
      } finally {
        if (childOne !== null) await killWorker(childOne).catch(() => undefined);
        if (childTwo !== null) await killWorker(childTwo).catch(() => undefined);
        if (childThree !== null) await killWorker(childThree).catch(() => undefined);
        if (flow !== null) await flow.close();
        if (sandbox !== null) await sandbox.close();
        if (hub !== null) await hub.close();
        if (connect !== null) await connect.close();
        await rnd.close();
        hubDb.close();
        rndDb.close();
        provider.server.close();
        await withTimeout(
          once(provider.server, "close"),
          "local provider close",
          5000,
        ).catch(() => undefined);
        await withTimeout(env.teardown(), "Temporal test environment teardown", 10_000);
        rmSync(root, { recursive: true, force: true });
      }
    },
    120_000,
  );
});