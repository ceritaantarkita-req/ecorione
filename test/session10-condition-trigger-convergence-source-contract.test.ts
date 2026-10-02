import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Session 10 deterministic Condition Trigger convergence", () => {
  const schema = readFileSync("packages/shared-schema/src/trigger.ts", "utf8");
  const db = readFileSync("services/flow/src/db.ts", "utf8");
  const http = readFileSync("services/flow/src/trigger-http.ts", "utf8");
  const page = readFileSync("apps/ai/app/automations/page.tsx", "utf8");

  it("activates condition as a bounded Trigger kind without L4 or a new scheduler", () => {
    expect(schema).toContain('ACTIVE_TRIGGER_KINDS = [...PE05_TRIGGER_KINDS, "condition"]');
    expect(schema).toContain('kind: z.literal("condition")');
    expect(schema).toContain("ConditionTriggerConfigurationSchema");
    expect(schema).toContain('message: "Trigger V1 tidak boleh meminta autonomy L4."');
    expect(db).toContain("('manual','time','event','webhook','condition')");
    expect(db).not.toContain("setInterval(");
  });

  it("uses a deterministic event predicate rather than polling or eval", () => {
    expect(http).toContain('trigger.kind !== "condition"');
    expect(http).toContain(
      'trigger.kind === "condition" && !conditionMatchesEvent(trigger, event)',
    );
    expect(http).toContain(
      'return { response: null, statusCode: 200, conditionMatched: false }',
    );
    expect(http).toContain("conditionFieldValue");
    expect(http).not.toContain("eval(");
    expect(http).not.toContain("new Function(");
    expect(http).not.toContain("setInterval(");
  });

  it("keeps false conditions side-effect free and true conditions on normal authority path", () => {
    const noMatch = http.indexOf(
      'trigger.kind === "condition" && !conditionMatchesEvent',
    );
    const authority = http.indexOf("await validateAuthority(options, trigger)", noMatch);
    expect(noMatch).toBeGreaterThan(-1);
    expect(authority).toBeGreaterThan(noMatch);
    expect(http).toContain("await evaluateTriggerPolicy(options");
    expect(http).toContain("await startGraphIdempotently(temporal");
  });

  it("productizes condition in Automation while keeping Schedule time-only", () => {
    expect(page).toContain('type AutomationKind = "event" | "webhook" | "condition"');
    expect(page).toContain("New condition");
    expect(page).toContain('aria-label="Condition field"');
    expect(page).toContain('aria-label="Condition operator"');
    expect(page).toContain('aria-label="Condition value"');
    expect(page).toContain("Condition hanya");
    expect(page).toContain("polling LLM");
    expect(page).toContain("Schedule tetap");
  });

  it("keeps condition fields bounded to payload/metadata and blocks prototype traversal", () => {
    expect(schema).toContain("^(payload|metadata)");
    expect(schema).toContain('"__proto__"');
    expect(schema).toContain('"prototype"');
    expect(schema).toContain('"constructor"');
    expect(schema).toContain('"CONTAINS"');
    expect(schema).toContain('"EXISTS"');
  });
});
