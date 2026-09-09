import { fileURLToPath } from "node:url";
import {
  FlowWorkflowInputSchema,
  assertId,
  type FlowWorkflowInput,
  type SandboxExecutionReceipt,
} from "@ecorione/shared-schema";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it, vi } from "vitest";
import type { FlowActivities } from "./activities.js";

function workflowInput(): FlowWorkflowInput {
  return FlowWorkflowInputSchema.parse({
    flowId: assertId("workflow", "wf_temporaltest001"),
    operationId: assertId("operation", "op_temporaltest001"),
    scope: "personal",
    sensitivity: "INTERNAL",
    inputText: "  durable   input  ",
    delayMs: 24 * 60 * 60 * 1000,
    approvalPrompt: "Approve test execution",
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
    id: "sbx_temporaltest001",
    tier: "tier0",
    command: "pwd",
    exitCode: 0,
    durationMs: 2,
    operationId: assertId("operation", "op_temporaltest001-execution"),
    recordedAt: "2026-09-09T00:00:00.000Z",
    stdout: "/tmp/work\n",
    stderr: "",
  };
}

describe("Temporal operationWorkflow", () => {
  it("survives durable delay, waits for approval signal, then runs AI/Sandbox/verification", async () => {
    const env = await TestWorkflowEnvironment.createTimeSkipping();
    try {
      const activities: FlowActivities = {
        requestApproval: vi.fn(async () => undefined),
        callAi: vi.fn(async () => ({ reply: "AI reply" })),
        executeSandbox: vi.fn(async () => receipt()),
        verifyExecution: vi.fn(async () => true),
        recordTrace: vi.fn(async () => undefined),
      };
      const taskQueue = "flow-workflow-test";
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
        activities,
      });
      const input = workflowInput();
      const result = await worker.runUntil(async () => {
        const handle = await env.client.workflow.start("operationWorkflow", {
          workflowId: input.flowId,
          taskQueue,
          args: [input],
        });
        await handle.signal("approval", { decision: "APPROVE", note: null });
        return handle.result();
      });
      expect(result).toEqual({
        flowId: input.flowId,
        operationId: input.operationId,
        transformed: "durable input",
        aiReply: "AI reply",
        sandboxReceiptId: "sbx_temporaltest001",
        verified: true,
      });
      expect(activities.requestApproval).toHaveBeenCalledTimes(1);
      expect(activities.callAi).toHaveBeenCalledTimes(1);
      expect(activities.executeSandbox).toHaveBeenCalledTimes(1);
      expect(activities.verifyExecution).toHaveBeenCalledTimes(1);
    } finally {
      await env.teardown();
    }
  }, 30_000);

  it("fails closed when the independent verifier rejects the execution proof", async () => {
    const env = await TestWorkflowEnvironment.createTimeSkipping();
    try {
      const activities: FlowActivities = {
        requestApproval: vi.fn(async () => undefined),
        callAi: vi.fn(async () => ({ reply: "AI reply" })),
        executeSandbox: vi.fn(async () => receipt()),
        verifyExecution: vi.fn(async () => false),
        recordTrace: vi.fn(async () => undefined),
      };
      const taskQueue = "flow-verifier-test";
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)),
        activities,
      });
      const input = workflowInput();
      await expect(
        worker.runUntil(async () => {
          const handle = await env.client.workflow.start("operationWorkflow", {
            workflowId: assertId("workflow", "wf_temporalverify002"),
            taskQueue,
            args: [{ ...input, flowId: assertId("workflow", "wf_temporalverify002") }],
          });
          await handle.signal("approval", { decision: "APPROVE", note: null });
          return handle.result();
        }),
      ).rejects.toThrow(/Verifier independen|FLOW_VERIFICATION_FAILED/);
    } finally {
      await env.teardown();
    }
  }, 30_000);
});
