import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import { createFlowActivities } from "./activities.js";
import { createFlowGraphActivities, type FlowGraphActivityConfig } from "./graph-activities.js";
import { FLOW_TASK_QUEUE } from "./temporal-client.js";

export interface FlowWorkerOptions extends FlowGraphActivityConfig {
  readonly temporalAddress: string;
  readonly temporalNamespace: string;
  readonly taskQueue?: string | undefined;
}
function workflowsPath(): string {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return fileURLToPath(new URL(`./workflows.${extension}`, import.meta.url));
}
export async function createFlowWorker(options: FlowWorkerOptions): Promise<Worker> {
  const connection = await NativeConnection.connect({ address: options.temporalAddress });
  return Worker.create({
    connection,
    namespace: options.temporalNamespace,
    taskQueue: options.taskQueue ?? FLOW_TASK_QUEUE,
    workflowsPath: workflowsPath(),
    activities: { ...createFlowActivities(options), ...createFlowGraphActivities(options) },
    stickyQueueScheduleToStartTimeout: "1 second",
  });
}
