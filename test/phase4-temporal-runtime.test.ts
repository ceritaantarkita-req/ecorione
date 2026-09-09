import { fileURLToPath } from "node:url";
import {
  FlowWorkflowInputSchema,
  assertId,
  type FlowWorkflowInput,
  type SandboxExecutionReceipt,
} from "../packages/shared-schema/src/index.js";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it, vi } from "vitest";
import type { FlowActivities } from "../services/flow/src/activities.js";

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

async function waitUntil(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (check()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for Temporal workflow state.");
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
      const handle = await env.client.workflow.start("operationWorkflow", {
        workflowId: workflowInput.flowId,
        taskQueue,
        args: [workflowInput],
      });

      await waitUntil(() => requestApproval.mock.calls.length === 1);
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
});
