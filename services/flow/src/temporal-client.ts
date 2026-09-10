import { Connection, WorkflowClient, type WorkflowExecutionStatusName } from "@temporalio/client";
import type {
  FlowApprovalSignal,
  FlowGraphExecutionInput,
  FlowGraphNodeDecisionSignal,
  FlowGraphNodeInputSignal,
  FlowGraphRunState,
  FlowWorkflowInput,
  OperationId,
  WorkflowId,
} from "@ecorione/shared-schema";

export const FLOW_TASK_QUEUE = "ecorione-flow-v1";
export const FLOW_WORKFLOW_TYPE = "operationWorkflow";
export const FLOW_GRAPH_WORKFLOW_TYPE = "graphExecutionWorkflow";

export interface FlowTemporalClient {
  start(input: FlowWorkflowInput): Promise<void>;
  signal(flowId: WorkflowId, signal: FlowApprovalSignal): Promise<void>;
  operationId(flowId: WorkflowId): Promise<OperationId>;
  describe(flowId: WorkflowId): Promise<{ readonly status: WorkflowExecutionStatusName }>;
}
export interface FlowGraphTemporalClient {
  startGraph(input: FlowGraphExecutionInput): Promise<void>;
  signalGraphDecision(runId: WorkflowId, signal: FlowGraphNodeDecisionSignal): Promise<void>;
  signalGraphInput(runId: WorkflowId, signal: FlowGraphNodeInputSignal): Promise<void>;
  graphState(runId: WorkflowId): Promise<FlowGraphRunState>;
}
export type FlowServerTemporalClient = FlowTemporalClient & Partial<FlowGraphTemporalClient>;

export interface TemporalClientOptions {
  readonly address: string;
  readonly namespace: string;
  readonly taskQueue?: string | undefined;
}

export async function createFlowTemporalClient(options: TemporalClientOptions): Promise<FlowTemporalClient & FlowGraphTemporalClient> {
  const connection = await Connection.connect({ address: options.address });
  const client = new WorkflowClient({ connection, namespace: options.namespace });
  const taskQueue = options.taskQueue ?? FLOW_TASK_QUEUE;
  return {
    async start(input): Promise<void> {
      await client.start(FLOW_WORKFLOW_TYPE, { taskQueue, workflowId: input.flowId, args: [input] });
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
    async startGraph(input): Promise<void> {
      await client.start(FLOW_GRAPH_WORKFLOW_TYPE, { taskQueue, workflowId: input.runId, args: [input] });
    },
    async signalGraphDecision(runId, signal): Promise<void> {
      await client.getHandle(runId).signal("graphNodeDecision", signal);
    },
    async signalGraphInput(runId, signal): Promise<void> {
      await client.getHandle(runId).signal("graphNodeInput", signal);
    },
    async graphState(runId): Promise<FlowGraphRunState> {
      return client.getHandle(runId).query<FlowGraphRunState>("graphRunState");
    },
  };
}
