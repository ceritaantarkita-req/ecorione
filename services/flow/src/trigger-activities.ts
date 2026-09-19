import { createHash } from "node:crypto";
import {
  ProjectSchema,
  autonomyExceeds,
  type PolicyVerdict,
} from "@ecorione/shared-schema";
import { httpJson } from "@ecorione/shared-server";
import type { ScheduledTriggerAuthorizationInput } from "./trigger-contract.js";

export interface TriggerActivityConfig {
  readonly hubUrl: string;
  readonly token?: string | undefined;
}

export interface TriggerActivities {
  authorizeScheduledTrigger(input: ScheduledTriggerAuthorizationInput): Promise<void>;
}

function idempotencyKey(input: ScheduledTriggerAuthorizationInput): string {
  return createHash("sha256")
    .update(
      [
        input.triggerId,
        input.occurrenceWorkflowId,
        input.occurrenceRunId,
        input.plan.graph.id,
        String(input.plan.graphVersion),
      ].join(":"),
    )
    .digest("hex");
}

export function createTriggerActivities(config: TriggerActivityConfig): TriggerActivities {
  return {
    async authorizeScheduledTrigger(input): Promise<void> {
      if (input.plan.graph.workspaceId !== input.workspaceId) {
        throw new Error("Scheduled Trigger workspace tidak cocok dengan pinned Flow.");
      }
      if (input.plan.graph.projectId !== input.projectId) {
        throw new Error("Scheduled Trigger Project tidak cocok dengan pinned Flow.");
      }

      const project = ProjectSchema.parse(
        await httpJson(
          `${config.hubUrl}/v1/projects/${encodeURIComponent(input.projectId)}?workspaceId=${encodeURIComponent(input.workspaceId)}`,
          { token: config.token },
        ),
      );
      if (autonomyExceeds(input.requestedAutonomy, project.autonomyCeiling)) {
        throw new Error(
          `Trigger autonomy ${input.requestedAutonomy} melebihi Project ceiling ${project.autonomyCeiling}.`,
        );
      }

      const verdict = await httpJson<PolicyVerdict>(`${config.hubUrl}/v1/actions/evaluate`, {
        method: "POST",
        token: config.token,
        body: {
          operationId: input.operationId,
          module: "Flow",
          tool: "flow.trigger.time.dispatch",
          actionClass: "EXECUTE",
          args: {
            triggerId: input.triggerId,
            occurrenceWorkflowId: input.occurrenceWorkflowId,
            occurrenceRunId: input.occurrenceRunId,
            graphId: input.plan.graph.id,
            graphVersion: input.plan.graphVersion,
          },
          scope: input.plan.graph.scope,
          sensitivity: input.plan.graph.sensitivity,
          autonomy: input.requestedAutonomy,
          idempotencyKey: idempotencyKey(input),
        },
      });
      if (verdict.outcome !== "ALLOW") {
        throw new Error(`Scheduled Trigger policy tidak ALLOW: ${verdict.outcome}.`);
      }
    },
  };
}
