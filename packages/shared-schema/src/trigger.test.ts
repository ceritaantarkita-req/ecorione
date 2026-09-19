import { describe, expect, it } from "vitest";
import {
  TriggerCreateRequestSchema,
  TimeTriggerConfigurationSchema,
} from "./trigger.js";

const base = {
  workspaceId: "ws_personal",
  projectId: "prj_personal",
  name: "Trigger",
  graphId: "fg_trigger01",
  graphVersion: 1,
  versionPolicy: "PINNED",
  requestedAutonomy: "L2",
  enabled: true,
};

describe("PE-03 Trigger schema", () => {
  it("activates only manual and time kinds in PE-03", () => {
    expect(
      TriggerCreateRequestSchema.safeParse({
        ...base,
        kind: "manual",
        configuration: {},
      }).success,
    ).toBe(true);
    expect(
      TriggerCreateRequestSchema.safeParse({
        ...base,
        kind: "time",
        configuration: {
          cronExpression: "0 8 * * *",
          timezone: "Asia/Jakarta",
        },
      }).success,
    ).toBe(true);
    for (const kind of ["event", "webhook", "condition"]) {
      expect(
        TriggerCreateRequestSchema.safeParse({
          ...base,
          kind,
          configuration: {},
        }).success,
      ).toBe(false);
    }
  });

  it("defaults catchup to 60 seconds and overlap to SKIP", () => {
    const parsed = TimeTriggerConfigurationSchema.parse({
      cronExpression: "0 8 * * *",
      timezone: "Asia/Jakarta",
    });
    expect(parsed.catchupWindowMs).toBe(60_000);
    expect(parsed.overlap).toBe("SKIP");
  });

  it("rejects invalid timezone, catchup above 24 hours, and L4 autonomy", () => {
    expect(
      TimeTriggerConfigurationSchema.safeParse({
        cronExpression: "0 8 * * *",
        timezone: "Not/A_Real_Timezone",
      }).success,
    ).toBe(false);
    expect(
      TimeTriggerConfigurationSchema.safeParse({
        cronExpression: "0 8 * * *",
        timezone: "UTC",
        catchupWindowMs: 24 * 60 * 60 * 1000 + 1,
      }).success,
    ).toBe(false);
    expect(
      TriggerCreateRequestSchema.safeParse({
        ...base,
        kind: "manual",
        requestedAutonomy: "L4",
        configuration: {},
      }).success,
    ).toBe(false);
  });

  it("accepts QUEUE_ONE as the only exposed buffered overlap policy", () => {
    expect(
      TimeTriggerConfigurationSchema.safeParse({
        cronExpression: "0 8 * * *",
        timezone: "UTC",
        overlap: "QUEUE_ONE",
      }).success,
    ).toBe(true);
    for (const overlap of ["BUFFER_ALL", "ALLOW_ALL", "CANCEL_OTHER", "TERMINATE_OTHER"]) {
      expect(
        TimeTriggerConfigurationSchema.safeParse({
          cronExpression: "0 8 * * *",
          timezone: "UTC",
          overlap,
        }).success,
      ).toBe(false);
    }
  });
});
