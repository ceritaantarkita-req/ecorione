import { describe, expect, it } from "vitest";
import type { ActionRequest } from "@ecorione/shared-schema";
import { evaluatePolicy, POLICY_RULES } from "./policy-engine.js";

function actionRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
  return {
    operationId: "op_test" as never,
    module: "Hub",
    tool: "chat.reply",
    actionClass: "READ",
    args: {},
    scope: "personal",
    sensitivity: "INTERNAL",
    autonomy: "L1",
    idempotencyKey: null,
    ...overrides,
  };
}

describe("evaluatePolicy", () => {
  it("aturan 1: IRREVERSIBLE_WRITE selalu REQUIRE_APPROVAL dalam plafon otonomi", () => {
    const { verdict, rule } = evaluatePolicy(
      actionRequest({ actionClass: "IRREVERSIBLE_WRITE", autonomy: "L0" }),
    );
    expect(verdict.outcome).toBe("REQUIRE_APPROVAL");
    expect(rule.id).toBe(POLICY_RULES.ALWAYS_GATED.id);
  });

  it.each(["SPEND", "EXTERNAL_SEND", "CREDENTIAL_ACCESS"] as const)(
    "aturan 1: %s juga REQUIRE_APPROVAL dalam plafon otonomi",
    (actionClass) => {
      const { verdict } = evaluatePolicy(actionRequest({ actionClass }));
      expect(verdict.outcome).toBe("REQUIRE_APPROVAL");
    },
  );

  it("aturan 2: otonomi melebihi plafon L3 → DENY, walau kelasnya reversible", () => {
    const { verdict, rule } = evaluatePolicy(
      actionRequest({ actionClass: "REVERSIBLE_WRITE", autonomy: "L4" }),
    );
    expect(verdict.outcome).toBe("DENY");
    expect(rule.id).toBe(POLICY_RULES.AUTONOMY_CEILING.id);
  });

  it("plafon L3 absolut: ALWAYS_GATED pada L4 tetap DENY, bukan approval escape hatch", () => {
    const { verdict, rule } = evaluatePolicy(
      actionRequest({ actionClass: "SPEND", autonomy: "L4" }),
    );
    expect(verdict.outcome).toBe("DENY");
    expect(rule.id).toBe(POLICY_RULES.AUTONOMY_CEILING.id);
  });

  it("aturan 3: READ selalu ALLOW", () => {
    const { verdict, rule } = evaluatePolicy(actionRequest({ actionClass: "READ" }));
    expect(verdict.outcome).toBe("ALLOW");
    expect(rule.id).toBe(POLICY_RULES.READ_ALWAYS_ALLOWED.id);
  });

  it("aturan 4: REVERSIBLE_WRITE dalam plafon otonomi → ALLOW default", () => {
    const { verdict, rule } = evaluatePolicy(
      actionRequest({ actionClass: "REVERSIBLE_WRITE", autonomy: "L3" }),
    );
    expect(verdict.outcome).toBe("ALLOW");
    expect(rule.id).toBe(POLICY_RULES.DEFAULT_ALLOW_L1_L3.id);
  });

  it("REQUIRE_APPROVAL membawa prompt yang bisa ditampilkan ke pengguna", () => {
    const { verdict } = evaluatePolicy(actionRequest({ actionClass: "SPEND" }));
    if (verdict.outcome !== "REQUIRE_APPROVAL") throw new Error("expected REQUIRE_APPROVAL");
    expect(verdict.prompt.length).toBeGreaterThan(0);
  });
});
