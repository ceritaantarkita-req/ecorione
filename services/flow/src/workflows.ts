import {
  ApplicationFailure,
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
} from "@temporalio/workflow";
import type {
  FlowApprovalSignal,
  FlowWorkflowInput,
  FlowWorkflowResult,
  OperationId,
} from "@ecorione/shared-schema";
import type { FlowActivities } from "./activities.js";

const activities = proxyActivities<FlowActivities>({
  startToCloseTimeout: "2 minutes",
  retry: {
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumInterval: "10 seconds",
    maximumAttempts: 3,
  },
});

export const approvalSignal = defineSignal<[FlowApprovalSignal]>("approval");
export const operationIdQuery = defineQuery<OperationId>("operationId");

export function transformInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function operationWorkflow(flow: FlowWorkflowInput): Promise<FlowWorkflowResult> {
  let approval: FlowApprovalSignal | undefined;
  setHandler(operationIdQuery, () => flow.operationId);
  setHandler(approvalSignal, (value) => {
    approval = value;
  });

  const transformed = transformInput(flow.inputText);
  await activities.recordTrace({
    flow,
    name: "flow.started",
    attributes: { delayMs: flow.delayMs },
  });

  if (flow.delayMs > 0) await sleep(flow.delayMs);

  await activities.requestApproval({ flow, transformed });
  await activities.recordTrace({
    flow,
    name: "flow.approval.waiting",
    attributes: { operationId: flow.operationId },
  });

  await condition(() => approval !== undefined);
  const decision = approval;
  if (decision === undefined || decision.decision !== "APPROVE") {
    await activities.recordTrace({
      flow,
      name: "flow.rejected",
      attributes: { decision: decision?.decision ?? "UNKNOWN" },
    });
    throw ApplicationFailure.nonRetryable(
      "Workflow ditolak pada human approval.",
      "FLOW_REJECTED",
    );
  }

  await activities.recordTrace({
    flow,
    name: "flow.approval.approved",
    attributes: { operationId: flow.operationId },
  });

  const ai = await activities.callAi({ flow, transformed });
  await activities.recordTrace({
    flow,
    name: "flow.ai.completed",
    attributes: { operationId: flow.operationId },
  });

  const receipt = await activities.executeSandbox({ flow });
  await activities.recordTrace({
    flow,
    name: "flow.sandbox.completed",
    attributes: { receiptId: receipt.id, exitCode: receipt.exitCode },
  });

  const verified = await activities.verifyExecution({ flow, receipt });
  await activities.recordTrace({
    flow,
    name: "flow.verification.completed",
    attributes: { receiptId: receipt.id, verified },
  });
  if (!verified) {
    await activities.recordTrace({
      flow,
      name: "flow.verification.failed",
      attributes: { receiptId: receipt.id },
    });
    throw ApplicationFailure.nonRetryable(
      "Verifier independen tidak menemukan bukti eksekusi Sandbox yang cocok.",
      "FLOW_VERIFICATION_FAILED",
    );
  }

  await activities.recordTrace({
    flow,
    name: "flow.completed",
    attributes: { receiptId: receipt.id, verified: true },
  });
  return {
    flowId: flow.flowId,
    operationId: flow.operationId,
    transformed,
    aiReply: ai.reply,
    sandboxReceiptId: receipt.id,
    verified: true,
  };
}
