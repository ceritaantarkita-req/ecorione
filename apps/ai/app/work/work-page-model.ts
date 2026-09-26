import type { TriggerDefinition } from "@ecorione/shared-schema";

export type WorkTab = "schedule" | "flows" | "runs";

export type TimeConfig = {
  cronExpression: string;
  timezone: string;
  catchupWindowMs: number;
  overlap: "SKIP" | "QUEUE_ONE";
};

export type ScheduleDraft = {
  id: string | null;
  revision: number | null;
  name: string;
  graphId: string;
  graphVersion: number;
  requestedAutonomy: "L0" | "L1" | "L2" | "L3";
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  catchupWindowMs: number;
  overlap: "SKIP" | "QUEUE_ONE";
};

export const EMPTY_DRAFT: ScheduleDraft = {
  id: null,
  revision: null,
  name: "",
  graphId: "",
  graphVersion: 1,
  requestedAutonomy: "L2",
  enabled: true,
  cronExpression: "0 8 * * *",
  timezone: "Asia/Jakarta",
  catchupWindowMs: 60_000,
  overlap: "SKIP",
};

export function errorMessage(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

export async function json<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || body === null) {
    throw new Error(errorMessage(body, `HTTP ${String(response.status)}`));
  }
  return body;
}

export function timeConfig(trigger: TriggerDefinition): TimeConfig | null {
  if (trigger.kind !== "time") return null;
  const config = trigger.configuration as Partial<TimeConfig>;
  if (
    typeof config.cronExpression !== "string" ||
    typeof config.timezone !== "string" ||
    typeof config.catchupWindowMs !== "number" ||
    (config.overlap !== "SKIP" && config.overlap !== "QUEUE_ONE")
  ) {
    return null;
  }
  return {
    cronExpression: config.cronExpression,
    timezone: config.timezone,
    catchupWindowMs: config.catchupWindowMs,
    overlap: config.overlap,
  };
}

export function draftFromTrigger(trigger: TriggerDefinition): ScheduleDraft {
  const config = timeConfig(trigger);
  if (config === null) return EMPTY_DRAFT;
  return {
    id: trigger.id,
    revision: trigger.revision,
    name: trigger.name,
    graphId: trigger.graphId,
    graphVersion: trigger.graphVersion,
    requestedAutonomy: trigger.requestedAutonomy,
    enabled: trigger.enabled,
    ...config,
  };
}

export function formatWhen(iso: string, timezone = "Asia/Jakarta"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}
