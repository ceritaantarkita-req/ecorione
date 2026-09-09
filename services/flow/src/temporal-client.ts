import {
  Connection,
  WorkflowClient,
  type WorkflowExecutionStatusName,
} from "@temporalio/client";
import type {
  FlowApprovalSignal,
  FlowWorkflowInput,
  OperationId,
  WorkflowId,
} from "@ecorione/shared-schema";

export const FLOW_TASK_QUEUE = "ecorione-flow-v1";
export const FLOW_WORKFLOW_TYPE = "operationWorkflow";

export interface FlowTemporalClient {
  start(input: FlowWorkflowInput): Promise<void>;
  signal(flowId: WorkflowId, signal: FlowApprovalSignal): Promise<void>;
  operationId(flowId: WorkflowId): Promise<OperationId>;
  describe(flowId: WorkflowId): Promise<{ readonly status: WorkflowExecutionStatusName }>;
}

export interface TemporalClientOptions {
  readonly address: string;
  readonly namespace: string;
  readonly taskQueue?: string | undefined;
}

export async function createFlowTemporalClient(
  options: TemporalClientOptions,
): Promise<FlowTemporalClient> {
  const connection = await Connection.connect({ address: options.address });
  const client = new WorkflowClient({ connection, namespace: options.namespace });
  const taskQueue = options.taskQueue ?? FLOW_TASK_QUEUE;
  return {
    async start(input): Promise<void> {
      await client.start(FLOW_WORKFLOW_TYPE, {
        taskQueue,
        workflowId: input.flowId,
        args: [input],
      });
    },
    async signal(flowId, signal): Promise<void> {
      await client.getHandle(flowId).signal("approval", signal);
    },
    async operationId(flowId): Promise<OperationId> {
      return client.getHandle(flowId).query<OperationId>("operationId");
    },
    async describe(flowId): Promise<{ readonly status: WorkflowExecutionStatusName }> {
      const description = await client.getHandle(flowId).describe();
      return { status: description.status.name };
    },
  };
}
