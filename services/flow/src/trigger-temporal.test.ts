import { fileURLToPath } from "node:url";
import {
  FlowGraphDocumentSchema,
  TriggerDefinitionSchema,
  type TriggerDefinition,
} from "@ecorione/shared-schema";
import { ScheduleOverlapPolicy } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it, vi } from "vitest";
import type { FlowGraphActivities } from "./graph-activities.js";
import { validateAndCompileFlowGraph } from "./node-registry.js";
import {
  reconcileTimeTriggerSchedule,
  type TriggerScheduleTemporalClient,
} from "./temporal-client.js";
import type { TriggerActivities } from "./trigger-activities.js";

async function waitUntil(
  check: () => boolean | Promise<boolean>,
  label: string,
): Promise<void> {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    if (await check()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function plan() {
  const graph = FlowGraphDocumentSchema.parse({
    id: "fg_triggerschedule01",
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: "Scheduled trigger graph",
    scope: "personal",
    sensitivity: "INTERNAL",
    maxParallelism: 1,
    nodes: [
      {
        id: "node_trigger1",
        kind: "trigger",
        version: 1,
        label: "Trigger",
        position: { x: 0, y: 0 },
        config: {},
      },
    ],
    edges: [],
  });
  const validated = validateAndCompileFlowGraph(graph, 1);
  if (!validated.valid || validated.plan === null) {
    throw new Error("Scheduled Trigger test graph failed compilation.");
  }
  return validated.plan;
}

function trigger(
  input: Partial<{
    enabled: boolean;
    catchupWindowMs: number;
    overlap: "SKIP" | "QUEUE_ONE";
  }> = {},
): TriggerDefinition {
  return TriggerDefinitionSchema.parse({
    id: "trg_temporalschedule01",
    workspaceId: "ws_personal",
    projectId: "prj_personal",
    name: "Morning schedule",
    kind: "time",
    graphId: "fg_triggerschedule01",
    graphVersion: 1,
    versionPolicy: "PINNED",
    requestedAutonomy: "L2",
    enabled: input.enabled ?? true,
    configuration: {
      cronExpression: "0 8 * * *",
      timezone: "Asia/Jakarta",
      catchupWindowMs: input.catchupWindowMs ?? 60_000,
      overlap: input.overlap ?? "SKIP",
    },
    temporalScheduleId: "ecorione-trigger-trg_temporalschedule01",
    revision: 1,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  });
}

function graphActivities(): FlowGraphActivities {
  return {
    authorizeGraphNode: vi.fn(async () => undefined),
    evaluateGraphNodePolicy: vi.fn(async () => ({
      outcome: "ALLOW" as const,
      reason: "test",
    })),
    requestGraphApproval: vi.fn(async () => "unused"),
    executeGraphNode: vi.fn(async ({ input }) => input),
    recordGraphTrace: vi.fn(async () => undefined),
    resolveSubflow: vi.fn(async () => {
      throw new Error("Subflow is not used.");
    }),
  };
}

async function awaitLatestScheduleAction(
  env: TestWorkflowEnvironment,
  scheduleId: string,
  count: number,
): Promise<void> {
  const handle = env.client.schedule.getHandle(scheduleId);
  await waitUntil(
    async () => (await handle.describe()).info.recentActions.length >= count,
    `schedule action #${String(count)}`,
  );
  const description = await handle.describe();
  const latest = description.info.recentActions.at(-1)?.action;
  if (latest?.type !== "startWorkflow") throw new Error("Expected schedule workflow action.");
  await env.client.workflow
    .getHandle(latest.workflow.workflowId, latest.workflow.firstExecutionRunId)
    .result();
}

describe("PE-03 Temporal Schedule runtime", () => {
  it("persists one schedule across worker/service reconciliation and dispatches unique occurrences", async () => {
    const env = await TestWorkflowEnvironment.createLocal();
    const taskQueue = "pe03-trigger-schedule-runtime";
    const triggerActivities: TriggerActivities = {
      authorizeScheduledTrigger: vi.fn(async () => undefined),
    };
    const graphs = graphActivities();
    const workflowsPath = fileURLToPath(new URL("./workflows.ts", import.meta.url));
    let workerOne: Worker | null = null;
    let workerTwo: Worker | null = null;
    let workerOneRun: Promise<void> | null = null;
    let workerTwoRun: Promise<void> | null = null;

    try {
      workerOne = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities: { ...graphs, ...triggerActivities },
      });
      workerOneRun = workerOne.run();

      const initial = trigger();
      const compiled = plan();
      await reconcileTimeTriggerSchedule(
        env.client.schedule,
        taskQueue,
        initial,
        compiled,
      );

      const handle = env.client.schedule.getHandle(initial.temporalScheduleId!);
      const created = await handle.describe();
      expect(created.state.paused).toBe(false);
      expect(created.spec.timezone).toBe("Asia/Jakarta");
      expect(created.policies.catchupWindow).toBe(60_000);
      expect(created.policies.overlap).toBe(ScheduleOverlapPolicy.SKIP);

      await handle.trigger(ScheduleOverlapPolicy.SKIP);
      await awaitLatestScheduleAction(env, initial.temporalScheduleId!, 1);
      expect(triggerActivities.authorizeScheduledTrigger).toHaveBeenCalledTimes(1);
      const firstAuth = vi.mocked(triggerActivities.authorizeScheduledTrigger).mock.calls[0]?.[0];
      expect(firstAuth?.occurrenceWorkflowId).toBeTruthy();
      expect(firstAuth?.occurrenceRunId).toBeTruthy();

      workerOne.shutdown();
      await workerOneRun;
      workerOne = null;
      workerOneRun = null;

      const paused = trigger({
        enabled: false,
        catchupWindowMs: 120_000,
        overlap: "QUEUE_ONE",
      });
      await reconcileTimeTriggerSchedule(env.client.schedule, taskQueue, paused, compiled);
      const reconciled = await handle.describe();
      expect(reconciled.state.paused).toBe(true);
      expect(reconciled.policies.catchupWindow).toBe(120_000);
      expect(reconciled.policies.overlap).toBe(ScheduleOverlapPolicy.BUFFER_ONE);

      const enabledAgain = trigger({
        enabled: true,
        catchupWindowMs: 120_000,
        overlap: "QUEUE_ONE",
      });
      await reconcileTimeTriggerSchedule(
        env.client.schedule,
        taskQueue,
        enabledAgain,
        compiled,
      );
      expect((await handle.describe()).state.paused).toBe(false);

      workerTwo = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath,
        activities: { ...graphs, ...triggerActivities },
      });
      workerTwoRun = workerTwo.run();

      await handle.trigger(ScheduleOverlapPolicy.BUFFER_ONE);
      await awaitLatestScheduleAction(env, initial.temporalScheduleId!, 2);
      expect(triggerActivities.authorizeScheduledTrigger).toHaveBeenCalledTimes(2);
      const secondAuth = vi.mocked(triggerActivities.authorizeScheduledTrigger).mock.calls[1]?.[0];
      expect(secondAuth?.occurrenceRunId).not.toBe(firstAuth?.occurrenceRunId);
    } finally {
      if (workerOne !== null) workerOne.shutdown();
      if (workerTwo !== null) workerTwo.shutdown();
      if (workerOneRun !== null) await workerOneRun.catch(() => undefined);
      if (workerTwoRun !== null) await workerTwoRun.catch(() => undefined);
      await env.teardown();
    }
  }, 120_000);
});
