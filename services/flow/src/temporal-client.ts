import {
  Connection,
  ScheduleClient,
  ScheduleNotFoundError,
  ScheduleOverlapPolicy,
  WorkflowClient,
  type WorkflowExecutionStatusName,
} from "@temporalio/client";
import type {
  FlowApprovalSignal,
  FlowGraphExecutionInput,
  FlowGraphNodeDecisionSignal,
  FlowGraphNodeInputSignal,
  FlowGraphRunState,
  CompiledFlowGraphPlan,
  FlowWorkflowInput,
  OperationId,
  TriggerDefinition,
  WorkflowId,
} from "@ecorione/shared-schema";
import type { ScheduledTriggerWorkflowInput } from "./trigger-contract.js";

export const FLOW_TASK_QUEUE = "ecorione-flow-v1";
export const FLOW_WORKFLOW_TYPE = "operationWorkflow";
export const FLOW_GRAPH_WORKFLOW_TYPE = "graphExecutionWorkflow";
export const TRIGGER_SCHEDULE_WORKFLOW_TYPE = "scheduledTriggerWorkflow";

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
export interface TriggerScheduleTemporalClient {
  reconcileTimeTrigger(
    trigger: TriggerDefinition,
    plan: CompiledFlowGraphPlan,
  ): Promise<void>;
  pauseTimeTrigger(scheduleId: string): Promise<void>;
}
export type FlowServerTemporalClient = FlowTemporalClient &
  Partial<FlowGraphTemporalClient & TriggerScheduleTemporalClient>;

export interface TemporalClientOptions {
  readonly address: string;
  readonly namespace: string;
  readonly taskQueue?: string | undefined;
}

export async function createFlowTemporalClient(
  options: TemporalClientOptions,
): Promise<FlowTemporalClient & FlowGraphTemporalClient & TriggerScheduleTemporalClient> {
  const connection = await Connection.connect({ address: options.address });
  const client = new WorkflowClient({ connection, namespace: options.namespace });
  const schedules = new ScheduleClient({ connection, namespace: options.namespace });
  const taskQueue = options.taskQueue ?? FLOW_TASK_QUEUE;

  function scheduleOptions(trigger: TriggerDefinition, plan: CompiledFlowGraphPlan) {
    if (trigger.kind !== "time" || trigger.temporalScheduleId === null) {
      throw new Error("Trigger time membutuhkan Temporal schedule ID.");
    }
    const cfg = trigger.configuration as {
      cronExpression: string;
      timezone: string;
      catchupWindowMs: number;
      overlap: "SKIP" | "QUEUE_ONE";
    };
    const actionInput: ScheduledTriggerWorkflowInput = {
      triggerId: trigger.id,
      workspaceId: trigger.workspaceId,
      projectId: trigger.projectId,
      requestedAutonomy: trigger.requestedAutonomy,
      plan,
      input: null,
    };
    return {
      scheduleId: trigger.temporalScheduleId,
      action: {
        type: "startWorkflow" as const,
        workflowType: TRIGGER_SCHEDULE_WORKFLOW_TYPE,
        taskQueue,
        args: [actionInput],
      },
      spec: {
        cronExpressions: [cfg.cronExpression],
        timezone: cfg.timezone,
      },
      policies: {
        catchupWindow: cfg.catchupWindowMs,
        overlap:
          cfg.overlap === "SKIP"
            ? ScheduleOverlapPolicy.SKIP
            : ScheduleOverlapPolicy.BUFFER_ONE,
      },
    };
  }

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
    async startGraph(input): Promise<void> {
      await client.start(FLOW_GRAPH_WORKFLOW_TYPE, {
        taskQueue,
        workflowId: input.runId,
        args: [input],
      });
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
    async reconcileTimeTrigger(trigger, plan): Promise<void> {
      const options = scheduleOptions(trigger, plan);
      const handle = schedules.getHandle(options.scheduleId);
      try {
        await handle.describe();
        await handle.update(() => ({
          action: options.action,
          spec: options.spec,
          policies: options.policies,
          state: {
            paused: !trigger.enabled,
            note: trigger.enabled
              ? "ECORIONE Trigger enabled/reconciled"
              : "ECORIONE Trigger disabled/reconciled",
          },
        }));
      } catch (error) {
        if (!(error instanceof ScheduleNotFoundError)) throw error;
        await schedules.create({
          ...options,
          state: { paused: !trigger.enabled },
        });
        return;
      }
    },
    async pauseTimeTrigger(scheduleId): Promise<void> {
      await schedules.getHandle(scheduleId).pause("ECORIONE Trigger disabled");
    },
  };
}
