import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A-09 audited frontend decomposition coverage", () => {
  const ai = readFileSync("apps/ai/app/page.tsx", "utf8");
  const settings = readFileSync("apps/ai/app/settings/page.tsx", "utf8");
  const flow = readFileSync("apps/ai/app/flow/page.tsx", "utf8");
  const work = readFileSync("apps/ai/app/work/page.tsx", "utf8");
  const space = readFileSync("apps/ai/app/space/page.tsx", "utf8");

  it("keeps each audited surface on an explicit decomposition boundary", () => {
    expect(ai).toContain('from "./ChatPageSections"');
    expect(settings).toContain('from "./useSettingsController"');
    expect(flow).toContain('from "./FlowPageSections"');
    expect(flow).toContain('from "./flow-page-model"');
    expect(work).toContain('from "./ProjectPicker"');
    expect(work).toContain('from "./ScheduleCalendar"');
    expect(work).toContain('from "./work-calendar"');
    expect(space).toContain('from "./SpacePageBlocks"');
  });
});
