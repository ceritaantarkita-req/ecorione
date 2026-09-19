import type {
  AutonomyLevel,
  CompiledFlowGraphPlan,
  OperationId,
  ProjectId,
  TriggerId,
  WorkspaceId,
} from "@ecorione/shared-schema";

export interface ScheduledTriggerWorkflowInput {
  readonly triggerId: TriggerId;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly requestedAutonomy: AutonomyLevel;
  readonly plan: CompiledFlowGraphPlan;
  readonly input: unknown;
}

export interface ScheduledTriggerAuthorizationInput
  extends ScheduledTriggerWorkflowInput {
  readonly occurrenceWorkflowId: string;
  readonly operationId: OperationId;
}

function hash32(value: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function scheduledOccurrenceSuffix(value: string): string {
  return `sched_${hash32(value, 2166136261)}${hash32(value, 2246822519)}`;
}
